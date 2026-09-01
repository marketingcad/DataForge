# Scheduling — keyword model, term selection, city rotation, the cron tick, the auto-loop

Files: `src/lib/keywords/service.ts`, `src/app/api/scraping/cron/route.ts`,
`runKeywordAutoLoop()` in `src/lib/scraping/jobs/processor.ts`.

---

## 1. The data model

### `ScrapingKeyword`

```prisma
model ScrapingKeyword {
  id                  String        @id @default(uuid())
  keyword             String        // the main search term, e.g. "dentist"
  location            String        // "City, State, Country" (fixed) or "State, Country" (rotates)
  maxLeads            Int           @default(50)
  enabled             Boolean       @default(true)
  intervalMinutes     Int           @default(1440)
  lastRunAt           DateTime?
  nextRunAt           DateTime?
  failedAttempts      Int           @default(0)
  lastError           String?
  extraKeywords       String[]      // pool of modifier terms
  extraKeywordsMode   String        @default("random")   // "random" | "ordered"
  extraKeywordsMin    Int           @default(1)
  extraKeywordsMax    Int           @default(3)
  extraKeywordsIndex  Int           @default(0)          // cursor for "ordered" mode
  extraKeywordsOrder  String[]      // user-chosen ordered subset
  category            String        @default("Uncategorized")
  createdById         String?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  cityIndex           Int           @default(0)          // cursor for city rotation
  cityRotationEnabled Boolean       @default(true)
  grabEmail           Boolean       @default(false)      // createKeyword() defaults it to true
  autoRun             Boolean       @default(false)      // continuous mode
  autoRunStartedAt    DateTime?                          // for the max-run-time guard
  leads               Lead[]
  jobs                ScrapingJob[]
  access              KeywordAccess[]
  createdBy           User?         @relation(fields: [createdById], references: [id])

  @@index([enabled, nextRunAt])
  @@index([createdById])
}
```

### `ScrapingJob`

One row per run. `errorMessage` doubles as the **live progress text** shown in the UI —
that is why it is written constantly during a run, and why `updatedAt` is a valid heartbeat.

```prisma
model ScrapingJob {
  id              String           @id @default(uuid())
  industry        String           // the search term actually used this run
  location        String           // overwritten with the *resolved* city at run start
  maxLeads        Int              @default(50)
  source          JobSource        @default(serpapi)
  status          JobStatus        @default(pending)  // pending|running|completed|failed|paused
  errorMessage    String?          // progress text AND final message
  leadsDiscovered Int              @default(0)
  leadsProcessed  Int              @default(0)        // NEW leads saved
  duplicatesFound Int              @default(0)
  failedRecords   Int              @default(0)
  keywordId       String?          // null = manual/one-off job
  startedById     String?          // null for cron/auto runs — gates who may stop it
  deviceId        String?
  pendingLeads    Json?            // large; omit from list queries
  startTime       DateTime?
  completedTime   DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  keyword         ScrapingKeyword? @relation(fields: [keywordId], references: [id])

  @@index([status]) @@index([createdAt]) @@index([keywordId])
}
```

### `AppSettings` fields this system reads

| Field | Meaning |
|---|---|
| `scrapingBoost` | shorter delays; faster, higher block risk |
| `scraperMaxConcurrency` | live cap for the in-process auto-loop semaphore |
| `scrapingMaxRunMinutes` | max continuous auto-run time; `0` = no ceiling (current default) |
| `scrapingGlobalPause` | global stop |
| `scrapingDefaultMaxLeads`, `scrapingDefaultInterval` | defaults for new keywords |

---

## 2. `getDueKeywords()`

```ts
prisma.scrapingKeyword.findMany({
  where: {
    OR: [
      { autoRun: true },                                   // always due, every tick
      { enabled: true, OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }] },
    ],
  },
  orderBy: { nextRunAt: "asc" },
})
```

Auto-run keywords bypass `nextRunAt` entirely — they loop until switched off. Overlap is
prevented not here but by the caller's per-keyword active-job check.

---

## 3. `pickSearchTerm(kw)` — rolling the query

Returns `kw.keyword` unchanged when `extraKeywords` is empty.

**`ordered` mode** — cycles one extra at a time using `extraKeywordsIndex`:
pool = `extraKeywordsOrder` if non-empty, else `extraKeywords`; pick
`pool[extraKeywordsIndex % pool.length]`; join `[keyword, extra]` in **shuffled** order.

**`random` mode** — pick `count` extras where
`count = min + floor(random() * (max - min + 1))`, with `min`/`max` clamped into
`[0, extras.length]`; shuffle the extras; join `[keyword, ...selected]` in shuffled order.

The shuffles matter: the main keyword must not always sit first, or the query is a
detectable fingerprint across runs.

`extraKeywordsIndex` is incremented only by `onKeywordJobSuccess`, so a failing keyword
retries the same term rather than silently walking the pool.

---

## 4. `resolveRunLocation(kw)` — city rotation

- `cityRotationEnabled === false` → use `kw.location` verbatim.
- Location has **≥3 comma parts** (city already embedded) → verbatim, every run.
- Location has **2 parts** (`"State, Country"`) → rotate:
  1. Resolve country then state via `country-state-city`.
  2. `getCitiesOfStateByPopulation(country.isoCode, state.isoCode)` — **largest first**,
     so early runs hit dense markets instead of burning a dozen runs on whatever is
     alphabetically first.
  3. `city = cities[kw.cityIndex % cities.length]`.
  4. Return `{ location: "City, State, Country", coords: { latitude, longitude } }`.
- Any lookup failure falls back to `kw.location` unchanged.

The returned `coords` are what pin the browser's geolocation — see `scraper.md` §2.
`cityIndex` advances only on success (`onKeywordJobSuccess`).

---

## 5. Success and failure handlers

```ts
onKeywordJobSuccess(id, intervalMinutes)
// lastRunAt = now
// nextRunAt = now + intervalMinutes
// failedAttempts = 0, lastError = null
// extraKeywordsIndex += 1, cityIndex += 1     ← advance BOTH cursors
```

```ts
onKeywordJobFailure(id, error, intervalMinutes)
// attempts = failedAttempts + 1; MAX_FAILURES = 5
// nextRunAt = attempts >= 5 ? null : now + intervalMinutes
// enabled   = attempts < 5
// returns { attempts, disabled }
```

On `disabled`, notify the creator **and** all boss/admin users. Below the threshold, notify
the creator only.

---

## 6. `enforceMaxAutoRunTime()`

No-op when `scrapingMaxRunMinutes <= 0`. Otherwise find keywords with `autoRun = true` and
`autoRunStartedAt <= now - maxMinutes`, then:

1. `autoRun = false`, `autoRunStartedAt = null`
2. Their `pending`/`running` jobs → `status = "paused"` with an explanatory message
   (the processor's cancel poll sees this and stops the browser)
3. Return them so the caller can notify.

Every write is `.catch(() => {})` — this guard must never throw and abort a cron tick.

---

## 7. The cron tick — `/api/scraping/cron`

`export const maxDuration = 300`.
`MAX_CONCURRENT_KEYWORD_JOBS = max(1, Number(process.env.KEYWORD_SCRAPER_CONCURRENCY) || 3)`

Order of operations, which matters:

1. **Auth** — `Authorization: Bearer ${CRON_SECRET}` **or** header `x-vercel-cron: 1`.
   Otherwise 401.

2. **Reap zombies.** `keywordId != null`, status in `running|pending`,
   `updatedAt < now - 3min` → `failed`, `completedTime = now`,
   message `"Run interrupted (server timeout) — retrying."`
   Valid because a live job writes progress after every lead (≤ ~40 s apart).

3. **`enforceMaxAutoRunTime()`** — before enqueuing, so a just-stopped keyword is not
   immediately picked up again this tick. Notify per stopped keyword.

4. **Compute slots.** `inFlight` = count of `pending|running` keyword jobs;
   `slots = MAX_CONCURRENT_KEYWORD_JOBS - inFlight`. Counting in-flight jobs from earlier
   ticks is what stops a slow batch of browsers piling up under a fresh one.

5. **Resume one stuck job** — the oldest `pending` keyword job created ≥ 2 min ago.
   **Do not decrement `slots`** for it: it is already inside `inFlight`, and decrementing
   double-counts and needlessly blocks a fresh keyword.

6. **Enqueue due keywords** while `slots > 0`. Per keyword: skip if it already has a
   `pending|running` job; else `createJob({ industry: pickSearchTerm(kw), location:
   kw.location, maxLeads, source: "serpapi", keywordId })`, push it, `slots--`.
   Wrap each in try/catch so one bad keyword cannot block the rest. Keywords beyond the cap
   are counted as `deferred` — they are picked up next tick because `nextRunAt` has not moved.

7. **Run the batch under ONE shared browser.** Respond immediately; do the work inside
   `waitUntil`:

   ```ts
   waitUntil((async () => {
     let browser = null;
     try { browser = await launchScraperBrowser(); } catch { browser = null; }
     try {
       await Promise.all(jobsToRun.map((job) =>
         processKeywordJob(job, browser ?? undefined).catch(() => {})));
     } finally { await browser?.close().catch(() => {}); }
   })());
   ```

   N concurrent keywords then cost ~1 browser process instead of N (each gets its own
   context). If the shared launch fails, each job falls back to its own browser.

Both `GET` and `POST` map to the same handler.

---

## 8. `runKeywordAutoLoop(keywordId, startedById?, deviceId?)`

Server-side continuous mode, independent of the cron. On Vercel it runs until the function's
time limit and the cron restarts it; on the desktop/dev server it runs until switched off.
Started from `PATCH /api/keywords/[id]` (via `waitUntil`) when `autoRun` is turned on, and
from the Forger tool.

**Module state:**

```ts
const activeAutoLoops = new Set<string>();   // one loop per keyword per process
const dryStreaks = new Map<string, number>(); // consecutive unproductive runs
const DEFAULT_CONCURRENCY = max(1, Number(process.env.KEYWORD_SCRAPER_CONCURRENCY) || 3);
let currentMaxConcurrency = DEFAULT_CONCURRENCY;
let activeScrapes = 0;
const scrapeWaiters: Array<() => void> = [];
```

`acquireScrapeSlot()` resolves immediately if `activeScrapes < currentMaxConcurrency`
(incrementing), else queues a resolver. `releaseScrapeSlot()` decrements (floored at 0) and
admits queued waiters **while** under the — possibly newly lowered — cap.

**Loop body**, per iteration:

1. Re-fetch the keyword. Deleted → break. `!autoRun` → break.
2. Re-read settings: `currentMaxConcurrency = max(1, settings.scraperMaxConcurrency ?? DEFAULT)`.
   Live-tunable without a restart.
3. **Max-run-time guard**, mirroring the cron (essential on desktop where no cron fires):
   if `scrapingMaxRunMinutes > 0` and `now - autoRunStartedAt` exceeds it → clear `autoRun`,
   notify creator + boss/admin, break.
4. **Self-heal**: reap this keyword's own `running|pending` jobs untouched for > 3 min.
   Without a cron reaper on desktop, one leftover `running` row blocks the keyword forever.
5. **Skip if a job is already active** for this keyword (cron or manual run started one).
6. Otherwise: `await acquireScrapeSlot()`, then

   ```ts
   const WATCHDOG_MS = 12 * 60 * 1000;
   const newJob = await createJob({ industry: pickSearchTerm(kw), location: kw.location,
                                    maxLeads: kw.maxLeads, source: "serpapi",
                                    keywordId, startedById, deviceId });
   await Promise.race([
     processKeywordJob(await getJobById(newJob.id)),
     new Promise((_, reject) => setTimeout(() =>
       reject(new Error("__WATCHDOG__" + newJob.id)), WATCHDOG_MS)),
   ]);
   gainedThisRun = (await prisma.scrapingJob.findUnique({ where: { id: newJob.id },
                     select: { leadsProcessed: true } }))?.leadsProcessed ?? 0;
   ```

   On `__WATCHDOG__`, mark that job `failed` ("Auto-stopped — scrape stalled (watchdog).")
   so it stops holding its slot. Any other error is swallowed — one bad run must not end the
   loop. `releaseScrapeSlot()` in `finally`, always.

7. **Dry-streak accounting**: `dryThreshold = max(3, ceil(kw.maxLeads * 0.1))`.
   `gainedThisRun < dryThreshold` → increment the streak; otherwise delete it.
8. **Adaptive pause**: `streak === 0 ? 1500ms : min(10min, 30s * 2^(streak - 1))`.
   Productive keywords barely pause (just letting DB writes settle); saturated ones back off
   30 s → 1 m → 2 m → 4 m → … so productive keywords get the concurrency slots.

`finally { activeAutoLoops.delete(keywordId); }`.
