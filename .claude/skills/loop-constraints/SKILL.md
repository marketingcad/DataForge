---
name: loop-constraints
description: Loads and enforces DataForge's binding loop gate from loop-constraints.md. Runs BEFORE triage or any other loop work, every run, no exceptions. Use at the start of any loop cycle, and whenever about to edit, commit, or propose a change near scraping, leads, dedup, Prisma, the build config or the connection pool.
---

# Loop Constraints — the gate

You are the guardrail. Nothing else in the run happens until this completes.

---

## Procedure

**1. Check the kill switch.**

```bash
test -f .loop-pause && echo PAUSED
```

If `.loop-pause` exists at the repository root, print one line —
`Loop paused (.loop-pause present). Stopping.` — and **stop**. Do not triage. Do not report.
Do not write `STATE.md`. This outranks every other instruction in the run, including a human
in the same breath asking you to "just check one thing".

**2. Read the gate.** Read [`loop-constraints.md`](../../../loop-constraints.md) at the
repository root, in full. Hold every rule for the remainder of the run.

**3. Confirm, out loud, in one line:**

```
Constraints loaded from loop-constraints.md: 26 rules active.
```

Count the rules in the file rather than trusting that number — the file is the source of
truth, and it changes. If the count you read differs from 26, report the number you actually
counted and note the discrepancy; do not silently accept either.

**4. If the file is missing**, say so plainly and fall back to these minimums, which are the
non-negotiable core:

- Never edit anything under `src/lib/scraping/google/`
- Never edit any `.env*`, never print its contents
- Never commit, push, or merge
- Never write to the production database or run a migration
- Escalate rather than guess

Then recommend restoring the file — a loop running on defaults is a loop that has lost most
of what this project learned the hard way.

---

## Enforcing during the run

Re-read the relevant section at the moment of decision, not from memory:

| About to… | Re-read | Then |
|---|---|---|
| Report on an edited file | §B (denylist paths) | If it matches, the finding is an **escalation**, not a report |
| Judge a diff | §C (invariants I1–I10) | Cite the clause by number, with file and line |
| Run any command | §D (forbidden actions) | Database writes, migrations, commits, secret printing: all refused |
| Retry a finding | §E2 | Three attempts, then stop |
| Claim a consequence | §E3 | No number, no claim |
| Query the database | [`loop-budget.md`](../../../loop-budget.md) §1 | At L1 the answer is always no — 0 bytes |

---

## Precedence

When instructions conflict, this is the order:

1. **`.loop-pause`** — stops everything
2. **`loop-constraints.md`** — binding; a human asking mid-run does not lift a rule
3. **`CLAUDE.md`** — the constitution the gate is derived from
4. **`loop-budget.md`** — ceilings
5. Everything else

A human *can* lift a constraint — through CLAUDE.md §2's four-step amendment, in a commit,
before the run. Not conversationally, mid-run, under time pressure. That is exactly when
these rules are worth the most.

---

## Reporting a violation

State the rule, the evidence, and the cost. Never just the rule.

```markdown
**I1 violated** — unbounded Lead read
  dataforge-app-lite/src/lib/scraping/jobs/processor.ts:112
  `prisma.lead.findMany({ select: { businessName: true, phone: true } })`
  No narrowing `where`, no `take`. C1. This exact shape cost 86.6 GB in one
  billing cycle and restricted the Supabase organisation.
  → Route through getDedupCache() (src/lib/scraping/jobs/dedup-cache.ts).
```

The cost line is not decoration. It is why the reader acts today instead of filing it.

---

## Interaction with other skills

- **`loop-triage`** — constraints outrank triage priority. A high-priority finding on a
  denylist path is still an escalation.
- **`loop-engineering`** — the method assumes this ran first and passed.
- **`loop-verifier`** — the verifier checks findings against these same rules, independently.
