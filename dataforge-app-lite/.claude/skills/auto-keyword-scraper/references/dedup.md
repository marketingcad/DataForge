# Deduplication — three layers, the cache, and the indexes

Files: `src/lib/scraping/jobs/dedup-cache.ts`, `src/lib/utils/dedup.ts`,
`src/lib/leads/service.ts`, `scripts/migration/ensure-dedup-indexes.mjs`.

---

## 1. The three layers

Each has a distinct job. **Do not remove one to "simplify".** The cache is allowed to be
stale *precisely because* the other two are authoritative.

| Layer | Job | Cost if stale/missing |
|---|---|---|
| Local copy (`dedup-cache.ts`) | Skip a business before opening its detail page | Wasted scraping only — **never** a duplicate row |
| `checkDuplicate()` at insert | Catch everything already committed, merge into it | Duplicates across sessions |
| Unique expression indexes | Settle ties between concurrent writers | Two people scraping the same business simultaneously both insert |

---

## 2. The uniqueness rule

**A lead is a duplicate when EITHER key matches: phone (digits-only) OR business name
(case-insensitive, trimmed).** Both are checked on every insert, not in priority order.

**Never email.** In the real data one Wix Sentry address appears on **860 leads**,
`user@domain.com` on **629**, and **9,032 rows** share an email with another lead. Keying on
it merges unrelated businesses. This was tried and reverted.

**Never short-circuit on phone.** An earlier version checked name only when no phone was
present, so a lead carrying a phone number was never name-checked — the same business
scraped with two different numbers landed twice.

**Never make `businessName` globally unique.** 16 names legitimately belong to different
businesses (two `bp` filling stations with different numbers), and directory scrapes
routinely produce several leads sharing one site-derived name. The unique *name* index is
scoped to rows **with no usable phone**, where zero names collide.

---

## 3. `checkDuplicate(prisma, normalizedPhone, businessName)`

One raw query, so both comparisons hit their indexes. Prisma's `mode: "insensitive"`
compiles to `ILIKE`, which no btree index can serve — that would seq-scan the whole table on
every insert.

```ts
const phone   = normalizedPhone?.trim() ?? "";
const nameKey = businessName?.toLowerCase().trim() ?? "";
if (!phone && !nameKey) return { isDuplicate: false };

const rows = await prisma.$queryRaw<{ id: string }[]>`
  SELECT "id" FROM "Lead"
  WHERE (${phone}::text <> '' AND "phone" = ${phone}::text)
     OR (${nameKey}::text <> '' AND lower(btrim("businessName")) = ${nameKey}::text)
  LIMIT 1
`;
return rows.length > 0 ? { isDuplicate: true, existingId: rows[0].id } : { isDuplicate: false };
```

Two details that are **not** optional:

- The `::text` casts. Without them both sides of `$1 <> ''` are untyped to Postgres and it
  fails with *"could not determine data type of parameter"*.
- The empty-string guards. **6,951 leads have a blank phone**, so an unguarded
  `"phone" = ''` reports every one of them as a duplicate.

---

## 4. `insertLead()` — merge, race recovery, monotonic score

1. Normalize `phone`, `email`, `website`.
2. `checkDuplicate()`.
3. **Duplicate** → load the existing row, union `industriesFoundIn` with `raw.category`,
   recompute the score, write back
   `dataQualityScore: Math.max(existing.dataQualityScore, newScore)` (**scores only ever
   increase**), set `duplicateFlag: true`, move folder only if one was explicitly given.
   Return `{ status: "duplicate", existingId }`.
4. **New** → geocode, create, return `{ status: "created", id }`.
5. **Race recovery** — catch Prisma `P2002` (checked structurally via `err.code === "P2002"`,
   without importing the error class). `checkDuplicate` reads committed rows only, so two
   concurrent scrapers can both pass it; the indexes are what actually guarantee one row
   survives. Re-run `checkDuplicate` to find the winner and return it as a duplicate rather
   than throwing.

---

## 5. The expression indexes — and why `prisma db push` drops them

| Index | Definition | Re-asserted after `db push`? |
|---|---|---|
| `Lead_phone_normalized_key` | unique on the normalized phone (`regexp_replace(...)`) | yes |
| `Lead_business_name_key_idx` | non-unique on `lower(btrim("businessName"))` — serves `checkDuplicate`'s name arm | yes |
| `Lead_name_nophone_key` | unique on `lower(btrim("businessName"))`, **partial: only rows with no usable phone** | **no — see below** |

These use SQL expressions **Prisma's schema language cannot represent**, so they live only in
raw SQL migrations. `vercel.json` runs `scripts/migration/ensure-dedup-indexes.mjs` after the
build's `prisma db push`. **Keep that step wired in.** (CLAUDE.md §C7.)

⚠ **Known gap:** that script re-asserts only the first two. `Lead_name_nophone_key` exists
solely in `prisma/migrations/20260826000001_add_lead_name_nophone_unique/` and is absent from
both `ensure-dedup-indexes.mjs` and `scripts/migration/new-project-schema.sql`. Since every
deploy runs `prisma db push --accept-data-loss`, a drift drop would remove it permanently and
silently — taking with it the concurrent-insert backstop for leads that have no phone. Verify
with `\d "Lead"` before assuming it is present; adding a third statement to the ensure script
is the fix.

If the build ever moves to `prisma migrate deploy` — preferred, the history is baselined —
verify it from a network where the Prisma CLI can actually reach the database first. Port
5432 is blocked on this developer's ISP.

---

## 6. The local copy — `dedup-cache.ts`

Replaced a per-job `prisma.lead.findMany({ select: { businessName, phone } })` that was
**~7.6 MB on the wire** at 130k leads, ran once per job, and — with the auto-run loop
creating jobs continuously — became **~86 GB of egress in one billing cycle** against a 5 GB
quota, growing quadratically with the table.

```ts
export type DedupCache = {
  skipNames: Set<string>;    // lower-cased, trimmed business names
  knownPhones: Set<string>;  // digits-only phone numbers
};
```

**Constants:**

```ts
const FILE_VERSION   = 1;
const REFRESH_MS     = max(0, Number(process.env.DEDUP_REFRESH_MS) || 60_000);       // delta re-sync
const FULL_REBUILD_MS= max(0, Number(process.env.DEDUP_REBUILD_MS) || 24*60*60*1000); // full rebuild
const OVERLAP_MS     = 5 * 60 * 1000;                                                // delta look-back
const PERSIST        = !process.env.VERCEL && process.env.DEDUP_CACHE_PERSIST !== "0";
```

Cache file: `${DEDUP_CACHE_DIR || LOCALAPPDATA|APPDATA|homedir}/DataForge/cache/lead-dedup-cache.json`,
holding `{ version, lastSync, builtAt, names[], phones[] }`.

### `getDedupCache()`

```
if (cache && now - syncedAt < REFRESH_MS)  → return cache
if (inflight)                              → return inflight   // concurrent jobs share one round trip
inflight = async () => {
  if (cache) return (builtAt older than FULL_REBUILD_MS) ? fullLoad() : deltaLoad(cache)
  onDisk = readFromDisk()
  if (onDisk && age(builtAt) <= FULL_REBUILD_MS) { restore sets; return deltaLoad(restored) }
  return fullLoad()
}
```

`deltaLoad` queries `dateCollected > (lastSync - OVERLAP_MS)` — a few KB in normal operation.

`fullLoad` is the **only** permitted full-table read, at most once per day per process.

### The two rules that are not optional

**The 24-hour full rebuild.** Leads are **hard-deleted** in six places. Without the rebuild
the local copy keeps deleted names forever and — because it drives the scraper's early skip —
those businesses are silently never collected again.

**The 5-minute overlap window.** Each delta re-reads the last 5 minutes rather than using a
strict `>` cursor. Concurrent inserts can commit with a `dateCollected` behind one already
observed; a strict cursor skips them permanently.

### Writes and durability

`rememberLead(businessName, phone)` appends what this process just inserted (normalizing the
phone) so the rest of the run skips it without another round trip.
`scheduleFlush()` coalesces the burst of appends into one write every 10 s (timer `unref`'d).
`writeToDisk()` writes to `${file}.tmp` then renames, so a crash mid-write cannot leave a
truncated cache. Every disk error is swallowed — a cache that cannot be persisted is still
correct in memory, and must never fail a scrape.

`flushDedupCache()` writes pending appends on shutdown. `invalidateDedupCache()` clears
memory and disk. `dedupCacheStatus()` reports `{ loaded, names, phones, lastSync, builtAt,
persisted }` to the settings/fleet UI.

`PERSIST` is false on Vercel: serverless containers have no durable disk and are recycled
constantly.

### How the processor consumes it

```ts
const { skipNames, knownPhones } = await getDedupCache();
const isDuplicate = (lead: SerpLead): boolean => {
  if (lead.phone) {
    const p = normalizePhone(lead.phone);
    if (p && knownPhones.has(p)) return true;
  }
  if (lead.businessName && skipNames.has(lead.businessName.toLowerCase().trim())) return true;
  return false;
};
```

The 2026-08 egress fix changed **exactly one line** in `processKeywordJob` —
`await getDedupCache()` in place of the full-table `findMany` — plus swapping the two
set-mutation lines for `rememberLead()`. The `isDuplicate` body was left byte-identical and
verified with a diff against `HEAD`. Hold any future change to that same standard.

---

## 7. Resolving duplicates in the UI is a **merge**, never a delete

| Child of `Lead` | On delete | Damage |
|---|---|---|
| `LeadCommission.leadId` (`@unique`) | **CASCADE** | commission record destroyed — money data |
| `CallLog.leadId` | SET NULL | call history orphaned |
| `GhlOpportunity` / `GhlAppointment` | SET NULL | GHL links broken |

`mergeDuplicates()` reassigns all four to the survivor **first**, and **refuses** when two
copies both carry a commission — `LeadCommission.leadId` is unique, so one would have to be
dropped. Keep that refusal.

---

## 8. Verifying dedup after a rebuild

```bash
# Only the cache may read the whole table:
grep -rn "lead.findMany" src/lib/scraping/     # → dedup-cache.ts only

# Indexes present:
#   \d "Lead"  → Lead_phone_normalized_key, Lead_name_nophone_key, Lead_business_name_key_idx
```

Then run one keyword with `maxLeads = 10` and confirm the Phase 1 log reads
`N found, M already in DB → K to scrape` with a plausible `M`. `M = 0` on a mature database
means the cache is not loading.
