# `processKeywordJob()` — the per-run orchestrator

File: `src/lib/scraping/jobs/processor.ts`.

Shared by the cron route and the `/process` API route, so the cron can call it directly via
`waitUntil` instead of an unreliable server-to-server HTTP hop.

```ts
export async function processKeywordJob(
  job: Awaited<ReturnType<typeof getJobById>>,
  sharedBrowser?: import("playwright-core").Browser,   // caller owns its lifecycle
)
```

CLAUDE.md §C6 permits changing exactly one thing in here: **where the dedup key sets come
from**. Everything else is off-limits without the developer asking by name.

---

## 1. Setup

```ts
const jobStartMs = Date.now();
const FN_BUDGET_MS = 285 * 1000;   // ~15 s margin under Vercel's 300 s function limit
await updateJobStatus(id, "running", { startTime: new Date() });
```

**Cancellation poll** — every 5 s, read `status`; anything other than `running` sets
`cancelledFlag`. This is what lets a scrape stuck *between* leads still stop promptly.
`clearInterval` after the retry loop.

**Dedup keys** — `const { skipNames, knownPhones } = await getDedupCache();` and the
synchronous `isDuplicate` predicate (see `dedup.md` §6).

**Counters:** `collectedLeads[]`, `savedCount`, `dupCount`, `insertFailures`,
`firstInsertError`, `insertChain: Promise<void>`, `pendingEmailGrabs[]`.

**Keyword** — fetched once (`getKeywordById(job.keywordId!)`) so retries can re-roll the
search term. A deleted keyword leaves `kw = null` and the job still completes.

**Category routing** — if `job.industry` names a real `Industry` (case-insensitive, and not
`"Uncategorized"`), resolve `getOrCreateUngroupedFolder(kw?.createdById ?? industry.userId,
industry.id, null)` and use it as `categoryFolderId`, so leads stay grouped under their
category instead of becoming globally unfiled. Any failure falls back to unfiled.

**Run constants:**

```ts
const MAX_RETRIES   = 2;
const MAX_SCRAPE_MS = 200 * 1000;
const boost = (await getSettings().catch(() => null))?.scrapingBoost ?? false;
```

**Location** — resolved **once** for the whole run so retries stay on the same city:
`const { location: runLocation, coords: runCoords } = kw ? resolveRunLocation(kw) : { location: job.location }`.
The resolved city is written back to `job.location` (fire-and-forget) so run history shows
where the scrape actually went.

---

## 2. The retry loop

```ts
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  if (cancelledFlag) { wasCancelled = true; break; }
  if (savedCount >= job.maxLeads) break;

  const searchTerm = (attempt === 0 || !kw) ? job.industry : pickSearchTerm(kw);
  const remaining  = job.maxLeads - savedCount;
  ...
}
```

Retries **re-roll the extra keywords** — a different query, not the same one again. That is
the point: the first term exhausted its new results, so repeating it would return the same
duplicates. Progress messages during retries are prefixed `[Retry n/2]`.

The call:

```ts
const attemptLeads = await scrapeGoogleMapsHeadless(
  searchTerm, runLocation, remaining,
  onLog, onLead, MAX_SCRAPE_MS,
  isDuplicate, skipNames, () => cancelledFlag,
  runCoords, sharedBrowser, boost,
);
```

`onLog` writes the message into `errorMessage` via
`updateMany({ where: { id, status: "running" } })` — **scoped to `status: "running"`** so a
cancelled job's final message is never overwritten by a late log line. All progress writes
are fire-and-forget `.catch(() => {})`.

**Error triage** after the call:

| Thrown message | Meaning |
|---|---|
| `__CANCELLED__` (or `cancelledFlag`) | user stopped it → `wasCancelled = true` |
| `__LIMIT_REACHED__` | target met → `hitLimit = true` |
| anything else | `fatalError = msg` |

Then `await insertChain` **always** — flush inserts before deciding whether to retry.
Break on `wasCancelled`, on `hitLimit`, or on `savedCount >= job.maxLeads`.

---

## 3. `onLead` — the insert chain

Inserts are serialised through a promise chain so they cannot interleave, while the scraper
keeps moving.

```ts
async (lead, count) => {
  await insertChain;                                   // back-pressure
  if (cancelledFlag) throw new Error("__CANCELLED__"); // propagates out of the scraper
  collectedLeads.push(lead);
  insertChain = insertChain.then(async () => {
    try {
      const result = await insertLead({
        businessName: lead.businessName,
        phone: lead.phone ?? "N/A",
        email: lead.email, website: lead.website, address: lead.address,
        city: lead.city, state: lead.state,
        category: job.industry,
        source: `GoogleMaps:keyword_${job.keywordId}`,
        keywordId: job.keywordId ?? undefined,
        folderId: categoryFolderId,
      });
      if (result.status === "duplicate") {
        dupCount++;
        const idx = collectedLeads.indexOf(lead);
        if (idx !== -1) collectedLeads.splice(idx, 1);   // keep discovered count honest
      } else {
        savedCount++;
        rememberLead(lead.businessName, lead.phone);     // ← the cache append
        if (kw?.grabEmail && lead.website && !lead.email && result.status === "created") {
          pendingEmailGrabs.push({ leadId: result.id, website: lead.website });
        }
      }
    } catch (insertErr) {
      insertFailures++;
      if (!firstInsertError) firstInsertError = String(insertErr?.message ?? insertErr);
    }
    // heartbeat — this write is what makes the 3-minute staleness reaper valid
    prisma.scrapingJob.updateMany({ where: { id, status: "running" },
      data: { leadsDiscovered: collectedLeads.length,
              leadsProcessed: savedCount, duplicatesFound: dupCount } }).catch(() => {});
  }).catch(() => {});
}
```

Notes worth preserving:

- `phone: lead.phone ?? "N/A"` — the field is required downstream.
- `source: "GoogleMaps:keyword_<id>"` — the email re-grab job queries on this prefix.
- Email grabs are **queued, not run inline**, so the scrape is never blocked by a slow site.
- An insert failure never aborts the run; it is counted and surfaced in the final message.

---

## 4. Email-grab phase

Runs sequentially **after** the main loop, using `makeGrabContextProvider(sharedBrowser)` —
a **lazy** provider that only creates a browser context the first time a JS-rendered fallback
is actually needed, so a grab phase where every site resolves via plain fetch never launches a
browser. It closes the browser only if it launched one (`owned`).

Per lead:

1. Re-read `status`; anything but `running` → `wasCancelled = true`, break.
2. **Hard deadline**: `Date.now() - jobStartMs > FN_BUDGET_MS` → write
   `"Grabbed X/Y emails — stopped at time limit (rest keep their websites; use Re-grab emails later)."`
   and break. Without this the function is killed mid-grab and the job is frozen at `running`.
3. `Promise.race([grabEmailFromWebsite(website, { getContext }), sleep(20_000) → null])` —
   a per-lead cap so one hanging site cannot stall the phase.
4. On success, re-read the lead's scoring fields, recompute
   `calculateDataQualityScore` with the new email, and write
   `dataQualityScore: Math.max(existing.dataQualityScore, newScore)` — **monotonic**.
   If the lead vanished, just write the email.
5. Update progress: `Grabbing emails — ${gi+1} / ${total} done…`. Per-lead failures are
   ignored.

`await grab.cleanup()` afterwards, unconditionally.

---

## 5. Completion

**Cancelled path** — re-read the status; if it is no longer `running`, return without
touching it. Otherwise write `status: "completed"` with
`errorMessage: "Stopped by user — ${savedCount} saved so far"`. A user stop is a
**completion**, not a failure: it must not feed the 5-strike disable counter.

**Normal path** — re-read the status and bail if another actor already finished the job.

```ts
const isSuccess  = savedCount > 0 || dupCount > 0;   // all-duplicates still counts as success
const finalLeads = leads.length > 0 ? leads : collectedLeads;
```

Message selection, in order:

| Condition | Message |
|---|---|
| `savedCount > 0` | `Done — N new[, M duplicates]`; append `(2 retries — could not reach X)` when short of `maxLeads`; append `⚠ K failed: <first error>` |
| `dupCount > 0` | `No new leads — M duplicates[ ⚠ K failed: …]` |
| `fatalError` | the error itself |
| `insertFailures > 0` | `⚠ All K inserts failed: <first error>` |
| otherwise | `No leads found after retries — try a different location or keyword` |

Final write: `status`, `completedTime`, `leadsDiscovered: finalLeads.length`,
`leadsProcessed`, `duplicatesFound`, `pendingLeads` (or null), `errorMessage`.

Then `revalidatePath("/leads")` and `revalidatePath("/scraping")`, and:

- **success** → re-fetch the keyword, `onKeywordJobSuccess(id, intervalMinutes)`
  (advances `nextRunAt`, `extraKeywordsIndex`, `cityIndex`; clears failures), then
  `notifyKeywordSuccess(...)`.
- **failure** → `handleKeywordFailure(keywordId, completionMsg)`.

Both are wrapped so a deleted keyword cannot throw out of a finished job.

---

## 6. Notifications

`notifyKeywordSuccess(keywordId, savedCount, dupCount, discovered)` builds a message that
distinguishes the three outcomes — new leads saved / all duplicates / nothing usable — and
mentions how many results Google Maps actually returned when that number is suspiciously
low. Type is `success` when leads were saved, else `info`. Sent to the creator and to all
boss/admin users.

`handleKeywordFailure(keywordId, error)` calls `onKeywordJobFailure`, then notifies:
`warning` with the attempt count below the threshold; `error` ("Keyword scraper disabled")
to the creator **and** boss/admin at 5 failures.

`MAX_KEYWORD_FAILURES = 5` — must match `MAX_FAILURES` in `keywords/service.ts`.

---

## 7. Sibling jobs in the same file

Not part of the auto-keyword loop, but they live here and share the grab-context provider:

- **`processEmailRegrabJob(job)`** — second-pass email lookup for a keyword's leads. Selects
  `source: { startsWith: "GoogleMaps:keyword_<id>" }`, `website != null`, empty email, and
  **only `{ id, website }`** — the minimum needed; full scoring fields are fetched only for
  leads where an email is actually found. Progress reads
  `Re-grabbing emails — i / total done… ✅ G grabbed · ❌ N not found`.
- **`processFolderEmailRegrabJob(job)`** — same, over lead IDs stashed in `job.pendingLeads`
  at creation time.

Both poll `status` before every lead, cap each site at 20 s, keep scores monotonic, and
always `grab.cleanup()` in `finally`.
