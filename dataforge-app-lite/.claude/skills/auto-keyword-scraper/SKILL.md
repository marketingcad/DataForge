---
name: auto-keyword-scraper
description: Complete rebuild specification for DataForge's auto-keyword Google Maps scraper — the keyword scheduler, the auto-run loop, the two-phase Maps scraper, and the three-layer dedup system. Use when the scraping/keyword code is damaged, lost, being restored from scratch, or when auditing whether a change preserved the algorithm's contract. Covers src/lib/scraping/, src/lib/keywords/, and src/app/api/scraping/cron/.
---

# Auto-Keyword Scraper — Rebuild Specification

This skill exists as an **insurance policy**. The auto-keyword scraper is DataForge's core
product and the most fragile thing in it. `CLAUDE.md` §C6 forbids touching it casually.
If it is ever destroyed, corrupted, or reverted by a bad session, this document contains
enough detail to rebuild it faithfully.

**This is a specification, not a suggestion.** Every constant, threshold, and ordering
below was arrived at by fixing a real failure. Reproduce them exactly; do not "improve"
them during a rebuild.

---

## 0. Read this first

**If the code still exists, do not use this skill to rewrite it.** Verify against it, then
stop. A rebuild is only justified when the files are missing or provably broken.

Golden test that the code is intact:

```bash
git diff --stat HEAD -- src/lib/scraping/google/    # must be empty
ls src/lib/scraping/{google,jobs,crawler} src/lib/keywords
```

**Before rebuilding, always try git first** — a restore is strictly better than a rewrite:

```bash
git log --oneline -- src/lib/scraping/google/maps-scraper.ts
git checkout <good-sha> -- src/lib/scraping src/lib/keywords src/app/api/scraping
```

Only fall through to this spec when no good commit exists.

---

## 1. What the system is

Five cooperating pieces. Rebuild them in this order — each depends only on the ones above it.

| # | File | Role |
|---|---|---|
| 1 | `src/lib/scraping/crawler/core.ts` | Chromium launch, stealth context, human-like pacing helpers |
| 2 | `src/lib/scraping/jobs/dedup-cache.ts` | On-disk copy of lead keys; the egress fix |
| 3 | `src/lib/scraping/google/maps-scraper.ts` | `scrapeGoogleMapsHeadless()` — the two-phase scraper |
| 4 | `src/lib/keywords/service.ts` | Scheduling: due keywords, search-term rolling, city rotation, backoff |
| 5 | `src/lib/scraping/jobs/processor.ts` | `processKeywordJob()` + `runKeywordAutoLoop()` — orchestration |
| — | `src/app/api/scraping/cron/route.ts` | The serverless tick that drives 4 + 5 |

Detail lives in the reference files — read the one you need, not all four:

- **`references/scheduling.md`** — keyword model, `getDueKeywords`, `pickSearchTerm`,
  `resolveRunLocation`, backoff, the cron tick, `runKeywordAutoLoop`.
- **`references/scraper.md`** — `scrapeGoogleMapsHeadless` phase by phase, DOM selectors,
  timeouts, CAPTCHA handling, stealth/browser setup.
- **`references/dedup.md`** — the three dedup layers, the cache protocol, the expression
  indexes, and the merge rules.
- **`references/processor.md`** — `processKeywordJob` control flow: retries, cancellation,
  insert chaining, email grab, completion accounting.

---

## 2. The contract — invariants that must survive any rebuild

These are the things that break silently. A rebuild that gets the flow right but any of
these wrong will look like it works and quietly lose leads or money.

### I1. The scraper's dedup interface is **synchronous**

`scrapeGoogleMapsHeadless` receives a plain `Set<string>` (`skipNames`) and a synchronous
predicate `isDuplicate(lead): boolean`. It never awaits a dedup check.

This is *the entire reason* `dedup-cache.ts` exists. Making the check async would mean
changing the scraper — which C6 forbids — so the keys must be in memory before the
scrape starts. Do not "simplify" this into a per-batch query.

### I2. Never `findMany` the whole `Lead` table in a job or request path

One full-table key fetch per job produced **86.6 GB of egress in one cycle** against a 5 GB
quota, and got the Supabase org restricted. `runKeywordAutoLoop` creates jobs continuously,
so the cost was effectively unbounded and grew with the table.

The only permitted full read is `fullLoad()` inside `dedup-cache.ts`, which runs at most
once per 24 hours per process.

### I3. Two dedup keys, checked on every insert: **phone OR business name**

Never email (one Wix telemetry address is on 860 leads; 9,032 rows share an email).
Never short-circuit on phone — an earlier version did, and the same business scraped with
two different numbers landed twice.

### I4. Duplicate resolution is a **merge**, never a bare delete

`LeadCommission.leadId` cascades on delete — deleting a duplicate destroys money data.
Reassign `LeadCommission`, `CallLog`, `GhlOpportunity`, `GhlAppointment` to the survivor
first, and refuse the merge when both copies carry a commission.

### I5. Phase 1 and Phase 2 are separate passes

Phase 1 reads *names only* while scrolling (no clicks, no network waits) and filters them
against `skipNames`. Phase 2 scrolls back to the top and opens detail panels **only** for
names that survived. Collapsing them into one pass means opening a detail page for every
business already in the database — the dominant cost of a scrape.

### I6. Every long-running loop has a deadline and a heartbeat

A Vercel function dies at ~300 s. Jobs that die mid-run leave a `running` row that blocks
the keyword forever. So: the scrape has `MAX_SCRAPE_MS`, the email phase has `FN_BUDGET_MS`,
the auto-loop has a 12-minute watchdog, and both the cron and the loop reap jobs whose
`updatedAt` is older than 3 minutes. Progress is written after every lead, which is what
makes the 3-minute staleness test valid.

### I7. Cancellation is polled from the database, not signalled in-process

The cancel API sets `status = "paused"`. `processKeywordJob` polls every 5 s and the
scraper checks `isCancelled()` in both loops. There is no other channel — the loop and the
HTTP request that started it may be in different processes.

### I8. Concurrency is capped in two independent places

The cron caps jobs per tick (`KEYWORD_SCRAPER_CONCURRENCY`, default 3, counting in-flight
jobs from earlier ticks). The auto-loop has its own in-process semaphore read live from
`AppSettings.scraperMaxConcurrency`. Each scrape is a Chromium holding a Google Maps page;
without both caps, turning on auto-run for many keywords OOMs the machine and exhausts the
DB pool.

### I9. Failure backoff exists at two levels and must not be removed

- **Per keyword failure**: 5 consecutive failures → `enabled = false`, `nextRunAt = null`,
  boss/admin notified.
- **Per keyword dryness**: a run that saves fewer than `max(3, ceil(maxLeads * 0.1))` new
  leads lengthens a dry streak → pause `30s · 2^(streak-1)`, capped at 10 minutes. Reset on
  the first productive run. Without this, a duplicate-saturated keyword hogs a concurrency
  slot forever for near-zero gain.

### I10. Anti-detection pacing is load-bearing

Randomised delays, shuffled query word order, geolocation pinned to the target city,
stealth init script, images/media/fonts aborted, `--disable-blink-features=AutomationControlled`.
CAPTCHA is detected at three points and always ends the scrape *saving what was collected*
— never discarding it.

---

## 3. Rebuild procedure

1. **Restore the schema first.** `ScrapingKeyword`, `ScrapingJob`, the relevant
   `AppSettings` columns — see `references/scheduling.md` §1. Then the three expression
   indexes via `scripts/migration/ensure-dedup-indexes.mjs` (they cannot be expressed in
   Prisma's schema language; `prisma db push` drops them — CLAUDE.md §C7).
2. **Rebuild bottom-up** in the order of the table in §1.
3. **Verify each layer against §2** before moving up. An invariant broken at layer 2 is
   invisible until layer 5 is running against production.
4. **Test on one keyword with `autoRun = false`** and `maxLeads = 10` first. Confirm:
   Phase 1 log line reports `N found, M already in DB → K to scrape`; the job reaches
   `completed`; `leadsProcessed + duplicatesFound` accounts for the leads emitted.
5. **Then** enable one auto-run keyword and watch a full cycle, including a dry run that
   should trigger the backoff pause.
6. **Update `CLAUDE.md`** if the rebuild changed anything — §2 of that file is the
   amendment process, and it applies to a rebuild just as much as to an edit.

---

## 4. Where the money is

Two failure modes here cost real money rather than just leads. Check them explicitly after
any rebuild:

- **Egress** (I2). A single reintroduced full-table read restarts the 86 GB problem.
  Verify: `grep -rn "lead.findMany" src/lib/scraping/` should hit `dedup-cache.ts` only.
- **Commission data** (I4). Verify `mergeDuplicates()` still reassigns all four children
  and still refuses two-commission merges.
