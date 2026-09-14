---
name: loop-engineering
description: The method for running a DataForge loop — discover, decide, verify, persist. Use when running a loop cycle, when asked to "run the loop", "do a constitution check", "check the working tree before I commit", or when setting up or changing how a loop operates. Defines the L1/L2/L3 ladder and what graduates a loop between levels.
---

# Loop Engineering — the method

A loop is a system that discovers work, hands it to an agent, verifies the result, and
persists what it learned — so the next run starts from evidence instead of from your memory.
You are not being asked to answer a question. You are being asked to **run one cycle**.

Adapted from [loop-engineering](https://github.com/cobusgreyling/loop-engineering) (MIT).
Project configuration lives in [`LOOP.md`](../../../LOOP.md).

---

## Before anything else

**Load the gate.** Invoke the `loop-constraints` skill, or read
[`loop-constraints.md`](../../../loop-constraints.md) directly and hold all 26 rules for the
whole run. A cycle that starts without the gate loaded is not a loop run — it is improvising
near production code that has already cost this project 86.6 GB.

Check `.loop-pause` first. If it exists, print one line and stop (rule A1).

---

## The four phases

### 1. Discover

Find candidate work. **Cheaply** — read the diff, not the repository (`loop-budget.md` §2,
rule 5).

At L1 the sources are the repository only, no database:

```bash
git status --short
git diff                    # unstaged
git diff --staged           # staged
git log --oneline -10
git diff --stat HEAD~1      # what the last commit moved
```

Use the `loop-triage` skill for what to look for and how to rank it.

### 2. Decide

For each candidate, choose exactly one:

| Decision | When |
|---|---|
| **Report** | It is a real finding. Goes in `STATE.md` with file, line and the clause breached. |
| **Escalate** | It touches a denylist path (§B), or it needs a measurement the loop may not take (E3). Describe what you *would* do and stop. |
| **Ignore** | Looked at, not worth a human's attention. Say so briefly — silence looks like a miss. |

At **L1 there is no fourth option.** The loop does not edit code. If a fix is obvious, the
finding says what the fix would be; a human applies it.

### 3. Verify

Anything the loop proposes goes to the `loop-verifier` agent — a separate role, default
stance **REJECT**. The maker never grades its own work; that separation is the point of the
split, not a formality.

At L1 the verifier checks the *finding*, not a diff: is the citation real, is the line
number right, does the clause actually say what the operator claims it says. A finding that
misquotes CLAUDE.md is worse than no finding, because it trains the reader to stop believing
the loop.

### 4. Persist

Write [`STATE.md`](../../../STATE.md). This is the loop's memory and the only artifact a
human is guaranteed to read.

Rules for `STATE.md`:

- **Overwrite it, don't append.** It is current state, not a log. The run log at the bottom
  is the only cumulative part.
- Carry forward anything still open from the previous run, with its age. A finding that has
  been open for three runs is a different signal from a fresh one.
- Never put a secret, connection string or token in it (rule D4).
- If the run found nothing, say that explicitly with the date. An empty file is
  indistinguishable from a loop that never ran.

---

## The ladder

| Level | May do | May not |
|---|---|---|
| **L1 — report** *(current)* | Read, judge, write `STATE.md` | Edit code, commit, touch the database |
| **L2 — assisted** | Propose a diff in an isolated git worktree | Merge. A human merges, always. |
| **L3 — unattended** | — | **Not authorised on this project** |

**Graduation is evidence, not elapsed time.** A week of *correct* verifier verdicts promotes
a loop. A quiet week does not — three consecutive runs with no actionable finding means the
loop is miscalibrated, and the response is to fix its discovery, not to trust it more
(`loop-budget.md` §3).

Demotion is immediate and needs no ceremony: one wrong verdict that would have landed a bad
change drops the loop back to L1.

---

## Running a cycle

```
Use the loop-operator agent to run a Constitution Watch cycle.
```

The operator loads the gate, runs discovery, ranks findings, sends anything it proposes to
the verifier, and writes `STATE.md`. You read `STATE.md` and decide what to act on.

---

## What makes a finding worth reporting

A good finding is **mechanical, invariant-shaped, and invisible at the moment of the
change** — exactly the class a human reviewer misses. The canonical example is the line that
caused this project's outage:

```ts
const existingLeads = await prisma.lead.findMany({ select: { businessName: true, phone: true } });
```

It passed review. It worked correctly. It cost 86.6 GB against a 5 GB quota and restricted
the whole Supabase organisation, and nothing broke at the moment it was written.

A bad finding is a style opinion, a refactor suggestion, or anything the loop cannot tie to a
numbered rule. If you cannot cite the clause, it is not a finding — it is a preference, and
preferences do not go in `STATE.md`.

---

## Anti-patterns

| Anti-pattern | Why it is wrong here |
|---|---|
| Fixing what you find, at L1 | The loop's credibility comes from being right, not from being fast. Report it. |
| Reading source files that did not change | Burns tokens for nothing. The diff is the work. |
| Batching findings through the verifier | A REJECT becomes ambiguous about which finding failed. |
| Grading your own proposal | Maker/checker exists because self-review does not work. |
| Reporting "no issues" without saying so | Indistinguishable from a broken loop. |
| Proposing an amendment without a number | CLAUDE.md §2 step 2. If you cannot measure it, say so and stop. |
