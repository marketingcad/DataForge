# Loop Budget — DataForge

Two budgets, not one. Tokens are the cost of thinking; **egress is the cost of looking** —
and on this project egress is the one that has actually caused damage.

---

## 1. Egress — the hard budget

| | |
|---|---|
| Plan | Supabase **Free** |
| Quota | **5 GB per billing cycle**, unified across Database, Auth, Storage, Realtime and Functions |
| Blast radius | Restrictions apply to the **whole organisation**, not one project — every project returns HTTP 402 and the database refuses pooler connections |
| Precedent | **86.6 GB** in one cycle (1,732%) from a single full-table read in a hot path |

### Per-level allowance

| Level | Database access | Allowance |
|---|---|---|
| **L1** (current) | **None.** The loop reads the repository and nothing else. | 0 bytes |
| L2 | Read-only, bounded queries only, each with an explicit `take` | ≤ 5 MB per run |
| L3 | Not authorised on this project | — |

### Rules

1. At L1 the loop **makes no database call of any kind**. A finding that needs live data is
   reported as *"needs a measurement"* and handed to the human — it does not go and measure.
2. Any query the loop proposes must state its expected row count and payload size **before**
   it runs. A query whose cost cannot be estimated does not run (mirrors `loop-constraints`
   E3).
3. `node scripts/backup.mjs --estimate` before any dump, always. A full dump moves roughly
   the entire database over the wire.
4. Never `findMany` the `Lead` table without a narrowing `where` **and** a `take`. This is
   constraint I1, restated here because it is the specific shape that blew the budget.

---

## 2. Tokens — the soft budget

| Level | Per run | Per day |
|---|---|---|
| L1 report | ~25k | ~75k |
| L2 assisted | ~80k | ~250k |

### Rules

5. **Read the diff, not the repository.** Triage works from `git diff` and `git log`, not
   from re-reading source files that have not changed. The scraper alone is ~46 KB in one
   file; reading it speculatively costs more than most runs are worth.
6. Use progressive disclosure. `SKILL.md` routes; `references/` carries detail and is loaded
   only when a finding actually needs it.
7. One finding at a time through the verifier. Batching findings makes a REJECT ambiguous
   about which one failed.
8. If a run exceeds its per-run allowance, finish the current finding, write `STATE.md`, and
   stop. A partial report that persists is worth more than a complete one that dies
   mid-thought.

---

## 3. Stopping

The loop halts and escalates when any of these is true:

- `.loop-pause` exists at the repository root (constraint A1)
- The daily token allowance is exhausted
- Any egress would be spent at L1
- Three consecutive runs produce no actionable finding — that is a signal the loop is
  miscalibrated, not that the repository is healthy

---

## 4. Estimating

Upstream ships a cost estimator:

```bash
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1
```

Treat its output as an order of magnitude, not a forecast — it has no model of this repo's
diff sizes. The numbers in §2 come from this project's own runs and should be corrected as
evidence accumulates. Record real figures in [`STATE.md`](STATE.md) under **Run log**.
