# DataForge — Handover Notes

**Written 2026-08-26.** Covers the Supabase account migration, the egress incident that
forced it, the lead-deduplication architecture, and the risks worth knowing before you
change anything. The active app is `dataforge-app-lite/`; `dataforge-app/` is an old
backup and should not be edited.

---

## 1. The database moved to a new Supabase account

**Old project:** `kukfxmbpqpgcvrcjtebc` (`aws-1-ap-southeast-1`) — restricted, do not rely on it.
**New project:** `pbvwxyqbzmwoftxkzpoh` (`aws-0-ap-southeast-1`, Postgres 17.6) — current.

### Why it moved

The old organisation blew its Free Plan egress quota — **86.6 GB against 5 GB (1,732%)** —
and Supabase applied Fair Use restrictions: every project in the org returned HTTP 402 and
the database refused pooler connections. Note that restrictions apply to the whole
**organisation**, not one project, and that Supabase egress is **unified** (Database, Auth,
Storage, Realtime and Edge Functions all draw from the same quota).

Project *transfer* is on the restricted list, so the move was done by restoring a backup
into a fresh project instead.

### How it was done

1. An NDJSON backup (`dataforge-backup-2026-08-20T21-51-28/`, 189 MB, one file per table
   plus `_manifest.json`) was the only usable copy. It was validated first: every file's
   line count matched the manifest exactly.
2. Schema was applied from `scripts/migration/new-project-schema.sql` — generated with
   `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` — pasted
   into the SQL Editor as one transaction. This was necessary because `prisma migrate
   deploy` needs the port-5432 direct connection, which this network blocks.
3. Data was loaded with **`scripts/restore-backup.mjs`** (kept in the repo; see its header
   for options). It derives insert order from the target's real foreign-key graph, batches
   inserts, uses `ON CONFLICT DO NOTHING` so it is re-runnable, and retries transient
   connection failures.

### Result

**42 of 43 tables matched the manifest exactly; 260,958 rows.** The single difference was
`Lead` at 132,661 vs 132,662 — one duplicate phone number correctly rejected by the new
unique index.

Verified afterwards: 13 users with bcrypt hashes intact (logins work), 0 orphaned
`Lead.folderId` references, 0 duplicate normalized phones, relations traversable through
the app's own Prisma client.

### Things to know

- `ForgerConversation` / `ForgerMessage` were absent from the backup because they never
  existed in the old database — they were in `schema.prisma` with no migration, created
  only by `prisma db push`. They now have a real migration
  (`20260824000000_add_forger_tables`) and exist (empty) in the new project.
- `AppSettings` in the backup predated four columns (`timezone`, `forgerModel`,
  `forgerApiKey`, `forgerMaxRequestTokens`). They now hold their schema defaults.
- The `documents` storage bucket was **not** migrated because it was empty
  (`NoteFile` and `ScriptFile` are both 0 rows). **It must be created in the new project**
  before document uploads will work — `src/actions/documents.actions.ts` expects it.
- `_prisma_migrations` was baselined by hand (all 30 migrations marked applied), because
  the schema was applied as raw SQL rather than through Prisma.
- Data is current as of **2026-08-20 21:51 UTC**. The last write before that was 03:35 UTC
  the same day — scraping had already stopped when the restriction hit — so the gap is
  believed to be near-empty, but it was never verified against the old project.

---

## 2. The egress incident — cause and fix

### Cause

One line, `src/lib/scraping/jobs/processor.ts`:

```ts
const existingLeads = await prisma.lead.findMany({ select: { businessName: true, phone: true } });
```

It read **every lead in the table** into memory to build a duplicate-skip set, and it ran
**once per scraping job**. Measured against real data: 4.6 MB of payload, **≈7.6 MB on the
wire**. `runKeywordAutoLoop` is an infinite loop that creates jobs back to back while
`autoRun` is on, and there are 16,644 `ScrapingJob` rows.

`11,614 jobs × 7.6 MB = 86.6 GB` — the entire overage, from this one query.

Worse, it was **self-amplifying**: every job added leads, making the next job's read
bigger. Cost scaled quadratically with the lead count.

### Fix

`src/lib/scraping/jobs/dedup-cache.ts` (new) replaced the per-job read with a **local copy
on disk** that syncs deltas:

- First use loads the local copy from `%LOCALAPPDATA%\DataForge\cache\lead-dedup-cache.json`
  (override with `DEDUP_CACHE_DIR`), then asks the database only for leads added since it
  last synced — a few KB, index-backed by `Lead_dateCollected_idx`.
- Every unique insert is appended locally by `rememberLead()`.
- The delta re-syncs every 60 s (`DEDUP_REFRESH_MS`) so leads added by *other* people and
  devices appear within a minute, not only after a restart.
- **A full rebuild every 24 h (`DEDUP_REBUILD_MS`) is not optional.** Leads are
  hard-deleted in six places; without the rebuild the local copy keeps deleted names
  forever and, because it drives the scraper's early skip, those businesses would be
  silently skipped on every future scrape.
- Each delta re-reads the last 5 minutes rather than using a strict cursor: concurrent
  inserts can commit with a `dateCollected` slightly behind one already observed, and a
  strict cursor would skip them permanently.
- Disabled on Vercel (no durable disk); falls back to in-memory.

Measured: **cold 4,456 ms → 561 ms on restart**, and the full-table read is gone from both
the per-job and per-restart paths.

**The scraping algorithm was not touched.** `src/lib/scraping/google/` has zero changes;
the scraper still receives the same synchronous `skipNames` set and `isDuplicate`
predicate.

---

## 3. Lead deduplication — three layers

Uniqueness is **phone number OR business name (case-insensitive)**. It is enforced in three
places, deliberately:

| Layer | What it does | Failure mode if it alone were missing |
|---|---|---|
| Local copy (`dedup-cache.ts`) | Lets the scraper skip a business before opening its detail page | Wasted scraping only — never a duplicate row |
| `checkDuplicate()` (`src/lib/utils/dedup.ts`) | One indexed query per insert; catches everything already committed and **merges** into the existing lead | Duplicates from separate sessions |
| Unique indexes | Settle genuine ties between concurrent writers | Two people scraping the same business at the same instant both insert |

### A bug that was fixed along the way

`checkDuplicate` used an else-if chain: if a lead had a phone, it was matched on phone
**only** and the business name was never checked. So the same business scraped with two
different numbers landed twice. Name uniqueness existed only in the in-memory set, which a
second concurrent job could not see. It now checks both keys on every insert, as one raw
query so both comparisons hit their indexes (Prisma's `mode: "insensitive"` compiles to
`ILIKE`, which no btree index can serve).

### The indexes, and why they are scoped the way they are

- `Lead_phone_normalized_key` — **UNIQUE**, partial (`>= 7` digits), on
  `regexp_replace(phone, '\D', '', 'g')`. Covers 125,710 leads (94.8%).
- `Lead_name_nophone_key` — **UNIQUE**, on `lower(btrim("businessName"))`, but **only where
  there is no usable phone**. Covers the remaining 6,951 (5.2%).
- `Lead_business_name_key_idx` — non-unique, serves the name half of `checkDuplicate`.
- `Lead_dateCollected_idx` — serves the local copy's delta sync.

**Do not make business name globally unique.** 16 names in the data are shared by different
businesses — two `bp` filling stations with different numbers, for instance — and directory
scrapes routinely yield several leads sharing one site-derived name. That is why the name
constraint is scoped to phoneless rows, where zero names collide.

**Email is deliberately not a uniqueness key.** Scraped emails are frequently template or
telemetry addresses: one Wix Sentry address appears on 860 leads, `user@domain.com` on 629,
and 9,032 rows share an email with another lead. Keying on it collapses distinct businesses.

These indexes are **expression indexes**, which Prisma's schema language cannot represent.
They exist only in raw SQL migrations, so `prisma db push` can drop them as drift. That is
why `vercel.json` runs `scripts/migration/ensure-dedup-indexes.mjs` after the push — it
re-asserts them with `CREATE INDEX IF NOT EXISTS` and never fails the build.

---

## 4. Duplicate review UI

Since the indexes prevent identical rows, what remains are the cases a machine cannot
judge: same name with different phones, or same phone with different names. Those surface
in a banner on `/leads` (admin only) with a review dialog:
`src/components/leads/DuplicatesBanner.tsx`, `src/lib/leads/duplicates.ts`,
`src/actions/duplicates.actions.ts`.

Resolution is a **merge, not a delete**, and this matters:

| Child of `Lead` | On delete | Consequence of a naive delete |
|---|---|---|
| `LeadCommission.leadId` (`@unique`) | **CASCADE** | the commission record is destroyed — money data |
| `CallLog.leadId` | SET NULL | call history orphaned |
| `GhlOpportunity` / `GhlAppointment` | SET NULL | GHL links broken |

`mergeDuplicates()` reassigns all four to the survivor, copies over fields only the other
copies had, unions `industriesFoundIn`, keeps the highest quality score, then deletes. It
**refuses** when two copies both carry a commission, since `LeadCommission.leadId` is unique
and silently dropping one would delete money data.

The banner count is cached (`unstable_cache`, 5 min, tag `duplicate-lead-count`) because the
two aggregations cost ~570 ms warm; `updateTag` purges it after a merge.

---

## 5. Connection pooling and the network

`src/lib/prisma.ts` was tuned after the dashboard and profile pages began timing out:
`max: 15`, `idleTimeoutMillis: 60s`, `keepAlive: true`, `connectionTimeoutMillis: 30s`.

The reasons are worth keeping in mind:

- `pg` defaults to a **10-second** idle timeout, so connections were discarded and re-dialled
  constantly. On this network a cold connect costs 0.5–2.7 s.
- `max` must exceed the widest `Promise.all` in the app. `getAgentProfile` fires **12**
  parallel queries; a pool of 10 produced *"timeout exceeded when trying to connect"*.
- Server `max_connections` is 60 (3 reserved), so 15 is comfortable.

**The underlying problem is the network path, not the code.** TCP connect to
`ap-southeast-1` measured 545–2700 ms across the three load-balancer IPs, with roughly one
failure in six, and port 5432 is blocked outright by the ISP. Production on Vercel `sin1`
does not have this problem — the functions sit beside the database. Expect the first page
load after a restart to take several seconds locally, then ~100 ms.

---

## 6. Risks, ranked

1. **There is no repeatable backup.** The NDJSON dump that made this migration possible was
   produced by something that is *not in this repo*, and the Free Plan has no automated
   backups. The new project is currently the only copy of everything. A `scripts/backup.mjs`
   counterpart to `restore-backup.mjs`, run on a schedule, is the single highest-value
   thing left to do.
2. **`prisma db push --accept-data-loss` runs on every Vercel deploy.** It is what created
   the Forger tables outside the migration history, and it is what would drop the dedup
   indexes if the guard script were removed. The migration history is baselined, so moving
   to `prisma migrate deploy` is ready when someone can verify it from a network where the
   Prisma CLI can reach the database.
3. **Desktop builds bake in the env file.** `electron/assemble.mjs` copies `.env.local`
   (or `.env`) into the package, so rotating the database password breaks every installed
   desktop app until it is rebuilt and reinstalled.
4. **The desktop app and the dev server both bind port 3000.** The desktop app serves a
   pre-built bundle, so it will happily show stale code while you wonder why your changes
   are missing. Quit it before running `npm run dev`.
5. **`DbNotification` has 77,176 rows and nothing prunes it.**
6. **Fan-out queries.** `getAgentProfile`'s 12 parallel queries include six
   `callLog.count()` variants that could collapse into one `FILTER` query, the way
   `src/lib/dashboard/service.ts` already does. This is the pattern that caused the
   timeouts.

### Still to do by hand (dashboard work, cannot be scripted)

- Rotate the database password (the one used during the migration was shared in a chat
  transcript), then update `.env`, `.env.local`, and Vercel.
- Point the Vercel env vars at the new project — `POSTGRES_PRISMA_URL`,
  `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`, `SUPABASE_URL` — and redeploy. Watch the build
  log for `[dedup-indexes] all indexes in place`.
- Create the empty `documents` storage bucket and fill in `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY`.
- Keep the old project until the new one has been exercised properly.

---

## 7. Where things live

| Path | What |
|---|---|
| `scripts/restore-backup.mjs` | Restores an NDJSON backup into any Postgres/Supabase target |
| `scripts/migration/new-project-schema.sql` | Complete schema for a fresh project (45 tables, 105 indexes, 63 FKs) |
| `scripts/migration/ensure-dedup-indexes.mjs` | Re-asserts the expression indexes after `db push`; wired into `vercel.json` |
| `src/lib/scraping/jobs/dedup-cache.ts` | The on-disk local copy of lead keys and its delta sync |
| `src/lib/utils/dedup.ts` | `checkDuplicate` — the write-time uniqueness check |
| `src/lib/leads/duplicates.ts` | Finding and merging ambiguous duplicates |
| `src/lib/prisma.ts` | Client construction and pool tuning; `withDbRetry` |
| `prisma/migrations/2026082[456]*` | The four migrations added during this work |

### Useful commands

```bash
# validate a backup without touching a database
node scripts/restore-backup.mjs --dir="<backup dir>" --dry-run

# restore into a target (reads TARGET_DATABASE_URL from .env.migrate)
node scripts/restore-backup.mjs --dir="<backup dir>"

# rebuild the desktop app (also re-bakes the env file)
npm run desktop:build-web && npm run desktop:assemble && npm run desktop:pack
```

---

## 8. Advice for whoever picks this up

The data is small — 261k rows, under 500 MB. There was never a scale problem here, only an
access-pattern one. Before optimising anything, check how many round trips a page makes and
how much each one returns; that is where every problem in this system has come from.

And read the comments. Several of them record decisions that are not obvious from the code
and would be easy to undo by accident — the note in `dedup.ts` about directory scrapes is
the clearest example, and it is the reason business names are not globally unique.
