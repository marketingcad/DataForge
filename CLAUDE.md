# CLAUDE.md — DataForge

Read this before touching anything. It records decisions that are **load-bearing but not
obvious from the code**, and the traps that have already cost real money and real data.

Companion documents:
- **`HANDOVER.md`** — the 2026-08 Supabase migration, the egress incident, and the risks.
- **`CODEBASE_MAP.md`** — file-by-file tour. ⚠️ Written 2026-04 and **partly stale**: it says
  the database is Neon. It is **Supabase** (since 2026-08). Treat its stack table with
  suspicion; trust `prisma.config.ts` and `.env` instead.

---

## 0. Ground truth

| | |
|---|---|
| **The app you edit** | `dataforge-app-lite/` |
| **Do not edit** | `dataforge-app/` — frozen backup, kept deliberately |
| Stack | Next.js 16 (App Router, Turbopack), TypeScript strict, Prisma 7, NextAuth v5, Tailwind v4, shadcn/ui |
| Database | Supabase Postgres 17, project `pbvwxyqbzmwoftxkzpoh`, region `ap-southeast-1` |
| Connection | **Transaction pooler, port 6543.** Port 5432 is blocked on the developer's ISP |
| Deploy | Vercel, functions pinned to `sin1` (beside the database) |
| Desktop | Electron wrapping the Next standalone server |
| Plan | Supabase **Free** — 5 GB unified egress covering Database, Auth, Storage, Realtime and Functions |

---

## 1. The Constitution

These are not style preferences. Each one exists because violating it broke something.
**Do not change any of them silently.** The amendment process is in §2.

### C1. Never read the whole `Lead` table in a request or job path

This single line cost **86.6 GB of egress in one billing cycle** and got the entire Supabase
organisation restricted:

```ts
// FORMER BUG — do not reintroduce in any shape
const existingLeads = await prisma.lead.findMany({ select: { businessName: true, phone: true } });
```

It ran once per scraping job (~7.6 MB on the wire), and `runKeywordAutoLoop` creates jobs
continuously. Cost also grew with the table, so it was quadratic.

Anything that needs "all the leads" must go through
`src/lib/scraping/jobs/dedup-cache.ts`, which keeps a local copy on disk and syncs deltas.
**Treat egress as a first-class budget**, not an afterthought.

### C2. Lead uniqueness is phone **OR** business name — never email

- **Never make `businessName` globally unique.** 16 names in the data legitimately belong to
  different businesses (two `bp` filling stations with different numbers), and directory
  scrapes routinely produce several leads sharing one site-derived name. The unique name
  index is deliberately scoped to rows **with no usable phone**, where zero names collide.
- **Never key deduplication on email.** One Wix telemetry address appears on **860 leads**,
  `user@domain.com` on 629, and 9,032 rows share an email with another lead. Keying on it
  merges unrelated businesses. This was tried and reverted.
- `checkDuplicate()` must check **both** keys on every insert. It previously short-circuited
  on phone, so a lead carrying a phone number was never name-checked — the same business
  scraped with two different numbers landed twice.

### C3. The three dedup layers each have a distinct job

| Layer | Purpose | If it is stale/missing |
|---|---|---|
| Local copy (`dedup-cache.ts`) | Skip a business before opening its detail page | Wasted scraping only — **never** a duplicate row |
| `checkDuplicate()` | Catch everything already committed, and merge into it | Duplicates across sessions |
| Unique indexes | Settle ties between concurrent writers | Two people scraping the same business at once both insert |

Do not "simplify" by removing a layer. The local copy is allowed to be stale *precisely
because* the other two are authoritative.

### C4. The local copy must keep its 24-hour full rebuild and its overlap window

- Leads are **hard-deleted** in six places. Without the daily rebuild, the local copy keeps
  deleted names forever and — because it drives the scraper's early skip — those businesses
  are silently never collected again.
- Each delta re-reads the last 5 minutes rather than using a strict `>` cursor. Concurrent
  inserts can commit with a `dateCollected` behind one already observed; a strict cursor
  skips them permanently.

### C5. Resolving duplicate leads is a **merge**, never a bare delete

| Child of `Lead` | On delete | Damage |
|---|---|---|
| `LeadCommission.leadId` (`@unique`) | **CASCADE** | commission record destroyed — money data |
| `CallLog.leadId` | SET NULL | call history orphaned |
| `GhlOpportunity` / `GhlAppointment` | SET NULL | GHL links broken |

`mergeDuplicates()` reassigns all four to the survivor first, and **refuses** when two copies
both carry a commission (`LeadCommission.leadId` is unique, so one would have to be dropped).
Keep that refusal.

### C6. `src/lib/scraping/google/` is off-limits without explicit approval

The scraping algorithm is the product's core and the hardest thing to debug. Dedup and
egress work belongs in `src/lib/scraping/jobs/`. The scraper's contract — a **synchronous**
`skipNames: Set<string>` and `isDuplicate(lead)` predicate — must be preserved; that
constraint is why a cache exists instead of per-batch queries.

### C7. The dedup indexes are expression indexes and `prisma db push` will drop them

`Lead_phone_normalized_key`, `Lead_name_nophone_key` and `Lead_business_name_key_idx` use
SQL expressions (`lower(btrim(...))`, `regexp_replace(...)`) that **Prisma's schema language
cannot represent**. They live only in raw SQL migrations.

`vercel.json` therefore runs `scripts/migration/ensure-dedup-indexes.mjs` after the build's
`prisma db push`. **Keep that step wired in.** If you ever move the build to
`prisma migrate deploy` (preferred — the history is baselined), verify it from a network
where the Prisma CLI can actually reach the database first.

### C8. Pool configuration is tuned for a slow link — do not tighten it

In `src/lib/prisma.ts`: `max: 15`, `idleTimeoutMillis: 60_000`, `keepAlive: true`,
`connectionTimeoutMillis: 30_000`.

- `max` **must exceed the widest `Promise.all` in the app.** `getAgentProfile` fires 12
  parallel queries; a pool of 10 produced *"timeout exceeded when trying to connect."*
- `pg` defaults to a 10-second idle timeout. On this network a cold connect costs
  0.5–2.7 s, so the default meant constant re-dialling.
- Bump `CLIENT_VERSION` in that file when you change pool/client construction, or dev
  hot-reload keeps the old singleton.

### C9. Secrets never enter committed files

`.env*` is gitignored. `electron/assemble.mjs` **bakes the env file into desktop builds**, so
rotating the database password breaks every installed desktop app until it is rebuilt. Never
print a live connection string into a commit, a doc, or a shared transcript.

---

## 2. Amending the Constitution

A rule here may be changed — several are trade-offs, not laws of nature. But an amendment
requires all four steps, in order:

1. **State which rule and why it no longer holds.** Reference the code or data, not a hunch.
2. **Quantify the consequence.** Measure it. Every rule above came from a number
   (86.6 GB, 860 leads on one email, 16 colliding names, 12 parallel queries).
3. **Get explicit developer sign-off.** Not inferred from "sounds good" on an adjacent
   topic. Name the rule you are asking to change.
4. **Update this file in the same commit** as the code change, so the next session inherits
   the new reasoning instead of a mystery.

If you cannot complete step 2, you are guessing. Say so and stop.

---

## 3. Traps that have already bitten

Every one of these actually happened. Check them before debugging from scratch.

**The desktop app and dev server both bind port 3000.** The desktop app serves a *pre-built*
bundle, so it happily shows stale code while you wonder why your change is missing. It also
holds its own DB connections from whenever it launched — after an env change it keeps using
the old database. **Quit it before `npm run dev`.** This caused three rounds of confusion in
one session.

**The network is genuinely bad, and it is not your bug.** TCP connect to `ap-southeast-1`
measures 545–2700 ms with roughly one failure in six; port 5432 is blocked entirely. Expect
`P1001` / `ETIMEDOUT` / `ENOTFOUND` intermittently. **Any script you write against this
database needs connect retries.** `withDbRetry` exists for app code — use it, especially
around `Promise.all`.

**`prisma.config.ts` loads dotenv, which prints a banner to stdout.** Piping
`prisma migrate diff` to a file captures `[dotenv@17.3.1] injecting env…` lines and produces
invalid SQL. Filter them.

**Restoring data: never list every target column.** Passing `NULL` for a column absent from
the backup **overrides its DEFAULT**. This broke `AppSettings` (whose backup predated
`timezone`). `scripts/restore-backup.mjs` names only the columns each batch actually carries.

**Next.js 16 changed the cache API.** `revalidateTag(tag)` now requires a second argument;
inside a Server Action use **`updateTag(tag)`** for read-your-own-writes.

**React lint blocks `setState` in an effect** (`react-hooks/set-state-in-effect`). For DOM or
external state — a `data-*` attribute, a "mounted" flag — use `useSyncExternalStore`.
`ThemeToggle.tsx` is the reference implementation.

**A `{/* comment */}` before the root element of a `return (` breaks JSX** (two siblings).
Put the comment above the `return`.

**`formatPhone()` assumes North America.** 498 leads are Philippine landlines starting with
`0`, which it renders as a fake US area code — `0277395300` → `(027) 739-5300`. The
duplicates UI has a local `displayPhone` guard. The shared helper is still wrong; fix it at
the source if you touch that area.

**Enums are narrow.** `CallStatus` is `completed | missed | voicemail | no_answer` — not
`answered`. Read `enum_range` before writing test data.

**Lite Mode (`data-lite` on `<html>`) freezes all animation** by design. If an animation
"doesn't work", check that first — it is a user setting, not a bug.

---

## 4. Working habits that fit this codebase

- **Count the round trips.** Every serious problem here has been an access-pattern problem,
  not a scale one. The data is small: ~261k rows, under 500 MB.
- **Prefer one query with `FILTER` over N counts.** `src/lib/dashboard/service.ts` is the
  model; `getAgentProfile` is the outstanding offender (six `callLog.count()` calls).
- **Cache page-level aggregates.** `unstable_cache` with a tag, purged by `updateTag` on
  write. See `getDuplicateGroupCount`.
- **Match the existing comment style:** explain *why*, especially for anything a future
  reader would be tempted to "clean up". The note in `src/lib/utils/dedup.ts` about
  directory scrapes prevented a genuinely bad index from being added.
- **Verify against real data before shipping a rule.** Every constitutional number above
  came from querying the actual database. Do the same.
- **Server actions** guard with `requireDepartment(...)` from `src/lib/rbac/guards`.

---

## 5. Known gaps (not yet fixed)

1. **No repeatable backup.** The NDJSON dump that saved the 2026-08 migration was produced
   by a script that is *not in this repo*, and the Free plan has no automated backups. A
   `scripts/backup.mjs` counterpart to `restore-backup.mjs` is the highest-value work left.
2. `prisma db push --accept-data-loss` runs on every deploy (see C7).
3. `DbNotification` has 77k+ rows and nothing prunes it.
4. `getAgentProfile` fan-out (see §4).
5. `scrapingMaxRunMinutes` defaults to `0` — no ceiling on the auto-run loop.
6. `CODEBASE_MAP.md` still describes Neon as the database.
