# Loop Constraints — DataForge

**Binding.** Every loop run loads this file *before* any other work and enforces every rule
in it. A rule here is not advice; a run that cannot satisfy one stops and escalates.

Derived from [`CLAUDE.md`](CLAUDE.md) — the constitution. Where a rule cites `C1`–`C9`, that
is the constitutional clause it enforces. **Changing a rule here requires the same four-step
amendment process as changing CLAUDE.md itself** (CLAUDE.md §2): name the rule, quantify the
consequence, get explicit sign-off, update both files in the same commit.

**26 rules active.**

---

## A. Kill switch (1 rule)

**A1.** If a file named `.loop-pause` exists at the repository root, **stop immediately** —
do not triage, do not report, do not write `STATE.md`. Print one line saying the loop is
paused and exit. This is the emergency brake; it outranks every other instruction, including
a human asking the loop to "just check one thing".

---

## B. Paths the loop must never edit (8 rules)

Reading these is always fine. Proposing an edit to one is an **escalation**, never an action
— even at L2, even with a passing verifier, even when the change looks obviously correct.

| # | Path | Why |
|---|---|---|
| **B1** | `dataforge-app-lite/src/lib/scraping/google/**` | The Google Maps scraper. C6. If `git diff` here is non-empty, the loop has failed. |
| **B2** | `dataforge-app-lite/src/lib/scraping/jobs/processor.ts` | `processKeywordJob` / `runKeywordAutoLoop` control flow. C6. |
| **B3** | `dataforge-app-lite/src/lib/keywords/service.ts` | Scheduling, rotation, failure backoff. C6. |
| **B4** | `dataforge-app-lite/src/app/api/scraping/cron/route.ts` | Enqueue policy and concurrency cap. C6. |
| **B5** | `dataforge-app-lite/prisma/migrations/**` | Applied migrations are immutable. The history is baselined by hand; editing one desynchronises `_prisma_migrations`. |
| **B6** | Any `.env*` file, anywhere | C9. Also never *print* their contents — see D4. |
| **B7** | `dataforge-app/**` | Frozen backup, kept deliberately. |
| **B8** | `dataforge-app-lite/src/generated/prisma/**` | Generated output. Regenerate, never edit. |

> **The one permitted exception, and its exact shape.** Inside B2, *where the dedup key sets
> come from* may change — that is how the 2026-08 egress fix landed: one line swapped to
> `await getDedupCache()`, plus two set-mutation lines swapped for `rememberLead()`, with the
> `isDuplicate` body left byte-identical and verified with a diff against `HEAD`. Any proposal
> in B2 that is not that shape is an escalation. Dedup and egress work belongs in
> `dataforge-app-lite/src/lib/scraping/jobs/dedup-cache.ts`, `src/lib/utils/dedup.ts` and
> `src/lib/leads/`.

---

## C. Invariants the loop must flag when a diff breaks them (10 rules)

These are the failure modes that have already cost money or data. The loop reports a
violation with file, line and the clause breached — it does not fix them silently.

| # | Invariant | Clause | The number behind it |
|---|---|---|---|
| **I1** | No unbounded read of the `Lead` table in a request or job path — a `prisma.lead.findMany` with no narrowing `where` and no `take` | C1 | 86.6 GB in one cycle, 1,732% of quota |
| **I2** | `email` must never become a deduplication key | C2 | One address on 860 leads; 9,032 rows share an email |
| **I3** | `businessName` must not become globally unique | C2 | 16 names legitimately belong to different businesses |
| **I4** | `checkDuplicate()` must check phone **and** name on every insert — never short-circuit | C2 | A phone-bearing lead was never name-checked; same business landed twice |
| **I5** | All three dedup layers remain: local cache, `checkDuplicate()`, unique indexes | C3 | Each catches what the others cannot |
| **I6** | The dedup cache keeps its 24-hour full rebuild **and** its 5-minute overlap window | C4 | Leads are hard-deleted in six places; a strict cursor skips concurrent inserts permanently |
| **I7** | Lead de-duplication resolves by **merge**; `mergeDuplicates()` keeps its refusal when both copies carry a commission | C5 | `LeadCommission.leadId` is unique and cascades — money data |
| **I8** | `ensure-dedup-indexes.mjs` stays in the `vercel.json` build command | C7 | `prisma db push` drops all three expression indexes as drift |
| **I9** | Pool floors hold: `max` ≥ 15, `idleTimeoutMillis` ≥ 60000, `keepAlive` true, `connectionTimeoutMillis` ≥ 30000 | C8 | `getAgentProfile` fires 12 parallel queries; a pool of 10 timed out |
| **I10** | `CLIENT_VERSION` is bumped whenever pool or client construction changes | C8 | Otherwise dev hot-reload serves the stale singleton |

---

## D. Actions the loop must never take (4 rules)

**D1.** Never `commit`, `push`, `merge`, or open a pull request. At every level, landing code
is a human action.

**D2.** Never run a command that **writes** to the production database. This includes seeds,
`scripts/create-boss.ts`, `scripts/reset-password.ts` and any ad-hoc `UPDATE`.

**D3.** Never run `prisma db push`, `prisma migrate`, or anything under `scripts/migration/`.

**D4.** Never print, echo, cat, or paste the contents of any `.env*` file, connection string,
API key or token — into a report, a commit, a `STATE.md`, or a transcript. C9. Listing
variable *names* is fine; values never are.

---

## E. Escalation (3 rules)

**E1.** Any finding that would require touching a §B path escalates to the human. The loop
describes the change it *would* make and stops.

**E2.** After **3** failed attempts at the same finding, stop and escalate. Do not try a
fourth angle.

**E3.** If a claim cannot be quantified, say so and stop — do not guess. Every rule in
CLAUDE.md came from a measured number, and an unmeasured proposal cannot amend one
(CLAUDE.md §2, step 2).

---

## Egress is a constraint, not a preference

The Supabase Free plan meters **5 GB of unified egress** across Database, Auth, Storage,
Realtime and Functions together, and restrictions apply to the whole **organisation**. Read
[`loop-budget.md`](loop-budget.md) before any run that would query the database. At **L1 the
loop makes no database calls at all** — it reads the repository and nothing else.
