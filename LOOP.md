# LOOP.md — How DataForge is operated with loops

Adapted from [loop-engineering](https://github.com/cobusgreyling/loop-engineering) (MIT,
Cobus Greyling). The patterns, the L1→L2→L3 ladder and the maker/checker split are theirs;
the constraints, the invariants and the egress budget are this project's.

> **Stop prompting. Design the loop.** A loop discovers work, hands it to an agent, verifies
> the result, and persists state — so the next run starts from what the last one learned
> instead of from your memory.

---

## The one active loop

### Constitution Watch — **L1, report-only**

| | |
|---|---|
| **Question it answers** | *Does the current working tree break a rule that has already cost us money?* |
| **Cadence** | On demand, and before any commit that touches scraping, leads, dedup, Prisma or the build config |
| **Level** | **L1 — reads and reports. Never edits code. Never commits.** |
| **Discovery** | `git diff`, `git diff --staged`, `git log` — the repository only, **no database calls** |
| **Judged against** | [`loop-constraints.md`](loop-constraints.md) — 26 binding rules derived from [`CLAUDE.md`](CLAUDE.md) C1–C9 |
| **Agents** | [`loop-operator`](.claude/agents/loop-operator.md) discovers and reports; [`loop-verifier`](.claude/agents/loop-verifier.md) independently checks anything the operator proposes |
| **State** | [`STATE.md`](STATE.md) |
| **Budget** | [`loop-budget.md`](loop-budget.md) — **0 bytes of egress at L1** |
| **Kill switch** | `touch .loop-pause` at the repo root |

**Run it:**

```
Use the loop-operator agent to run a Constitution Watch cycle.
```

Or invoke the method directly with the `loop-engineering` skill.

---

## Why this loop first

Upstream's canonical starter is `daily-triage` — scan issues and PRs, write `STATE.md`. It is
a good pattern and a poor fit here: DataForge has two contributors and almost no PR traffic,
so the loop would be exercising the reference implementation rather than earning its keep.

The failure mode that actually hurt this project was different. A single line —
`prisma.lead.findMany({ select: { businessName: true, phone: true } })` — passed review,
worked correctly, and quietly spent **86.6 GB against a 5 GB quota**, restricting the entire
Supabase organisation. Nobody noticed for a billing cycle, because nothing broke.

That is precisely the class of problem a loop is good at and a human reviewer is bad at:
mechanical, invariant-shaped, invisible at the moment of the change, expensive later.
So the first loop watches the constitution.

---

## Candidate loops — not yet enabled

Do not turn these on casually. Loop-engineering's rule, which this project adopts: **one loop
at a time, report-only for a week, and the verifier has to have been right that whole week
before anything graduates.**

| Loop | Level | What it would do | Blocked on |
|---|---|---|---|
| **Scraper health watch** | L1 | Zombie jobs, keywords disabled after 5 failures, dry-streak saturation, stale dedup cache | Needs database reads — an egress budget decision (see `loop-budget.md` §1) |
| **Migration safety** | L1 | Flag schema changes that would drop an expression index or cascade into `LeadCommission` | Fine as-is; sequence it after Constitution Watch has a week of runs |
| **Desktop release** | L2 | Assert the git tag matches `package.json` version; check `.env` is not about to ship to a public release | Waiting on the auto-update work |
| **Daily triage** | L1 | Upstream's pattern: issues, PRs, failing workflows | Low value until PR traffic exists |

---

## The ladder

| Level | What the loop may do | How you leave it |
|---|---|---|
| **L1 — report** | Read, judge, write `STATE.md`. No code edits, ever. | A week of runs where the findings were real and the misses were none |
| **L2 — assisted** | Propose a diff in an isolated git worktree. A verifier must APPROVE. A human merges. | Not planned. Would need an explicit decision. |
| **L3 — unattended** | Commits within an allowlist. | **Not authorised on this project.** C6 puts the scraper off-limits, and a silent bad change here costs real money. |

Graduation is evidence-based, not time-based: a week of *correct* verifier verdicts, not a
week of *elapsed* time. A loop that found nothing for a week has not proven itself — it has
proven it is miscalibrated (`loop-budget.md` §3).

---

## Gates

- **Never auto-merge.** Landing code is a human action at every level (`loop-constraints.md` D1).
- **Never write to the production database** (D2), never run migrations (D3), never print a
  secret (D4).
- **Denylist**: `src/lib/scraping/google/`, `processKeywordJob` / `runKeywordAutoLoop`,
  `keywords/service.ts`, the cron route, applied migrations, `.env*`, `dataforge-app/`,
  generated Prisma output. Touching one is an escalation, not an action (§B).
- **Escalate, don't guess.** An unquantifiable claim stops the run (E3).

---

## Files

```
LOOP.md                      ← you are here: which loops run, at what level, behind what gates
STATE.md                     ← what the last run found; the loop's memory between sessions
loop-constraints.md          ← the 26 binding rules; loaded before any other work
loop-budget.md               ← token and egress ceilings
.claude/
  agents/
    loop-operator.md         ← runs a cycle
    loop-verifier.md         ← independent checker, default REJECT
  skills/
    loop-engineering/        ← the method: discover → decide → verify → persist
    loop-constraints/        ← loads and enforces the gate
    loop-triage/             ← DataForge-specific discovery and ranking
```

---

## Provenance

Upstream concepts used here: the loop anatomy (discover / decide / verify / persist), the
L1–L3 ladder, the maker/checker split, `STATE.md` as durable loop memory, `loop-constraints`
as a binding pre-flight gate, and the kill switch.

Adapted for DataForge: the constraints are derived from this repo's constitution rather than
generic safety defaults, and **egress is promoted to a first-class budget** — a concept
upstream does not have, because upstream never had a query cost it 86.6 GB.
