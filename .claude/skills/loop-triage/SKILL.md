---
name: loop-triage
description: DataForge-specific discovery and ranking for a loop run — what to scan in a diff, which patterns are real findings, and how to rank them for STATE.md. Use during the discover phase of a loop cycle, or when asked what changed and whether any of it is risky.
---

# Loop Triage — DataForge

Produce a short, ranked, evidence-backed list of things a human should look at today.
Signal, not invention. You are not reviewing style and you are not proposing refactors.

Assumes [`loop-constraints`](../loop-constraints/SKILL.md) already ran and the gate is loaded.

---

## Sources (L1 — repository only, no database)

```bash
git status --short                 # staged/unstaged/untracked — and anything unexplained
git diff                           # unstaged changes
git diff --staged                  # staged changes
git log --oneline -10              # recent history
git diff --stat HEAD~1             # what the last commit moved
```

**Read the diff, not the repository.** Open a source file only when a hunk is ambiguous
without its surroundings. The scraper is ~46 KB in a single file; reading it speculatively
costs more than most runs are worth (`loop-budget.md` §2 rule 5).

---

## The scan

Work through these in order. Each maps to a numbered rule in
[`loop-constraints.md`](../../../loop-constraints.md).

### 1. Denylist paths (§B) — always first, always an escalation

Any hunk under `src/lib/scraping/google/`, `jobs/processor.ts`, `keywords/service.ts`, the
cron route, `prisma/migrations/`, `.env*`, `dataforge-app/`, or generated Prisma output.

```bash
git diff --name-only HEAD | grep -E 'scraping/google/|jobs/processor\.ts|keywords/service\.ts|api/scraping/cron|prisma/migrations/|\.env|^dataforge-app/|generated/prisma/'
```

`src/lib/scraping/google/` is the sharp one: **if that diff is non-empty, something has gone
wrong**, regardless of how reasonable the change looks. Report it at the top.

### 2. Egress shapes (I1) — the failure that actually happened

Grep the diff, not the tree:

```bash
git diff -U0 HEAD | grep -nE '^\+.*(findMany|\$queryRaw)' | grep -vE 'take:|where:'
```

Flag a `lead.findMany` with no narrowing `where` **and** no `take`. Also flag: a new
`count()` fan-out where one query with `FILTER` would do, a page-level aggregate added
without `unstable_cache` + tag, and any large payload added to a page's initial load rather
than fetched on demand.

### 3. Dedup invariants (I2–I7)

| Look for | Rule |
|---|---|
| `email` appearing in a uniqueness check, unique index, or `checkDuplicate` | I2 |
| `@@unique` or a unique index on `businessName` without a phone-scoped `WHERE` | I3 |
| An early `return` in `checkDuplicate()` that skips the name check | I4 |
| A dedup layer removed, or `getDedupCache()` swapped back to a direct query | I5 |
| `DEDUP_REBUILD_MS`, `FULL_REBUILD_MS` or `OVERLAP_MS` weakened or removed | I6 |
| `lead.delete` outside `mergeDuplicates`, or the commission refusal removed | I7 |

### 4. Schema and build (I8)

Changes to `vercel.json` that drop `ensure-dedup-indexes.mjs`. New migrations that would drop
or rename `Lead_phone_normalized_key`, `Lead_name_nophone_key`, `Lead_business_name_key_idx`,
or `Lead_dateCollected_idx`. Any `onDelete` change on a child of `Lead` — especially
`LeadCommission`, which cascades into money data.

### 5. Pool and client (I9, I10)

Any edit to `src/lib/prisma.ts`. Check the floors hold — `max` ≥ 15,
`idleTimeoutMillis` ≥ 60000, `keepAlive` true, `connectionTimeoutMillis` ≥ 30000 — and that
`CLIENT_VERSION` was bumped if construction changed.

### 6. Secrets (D4)

Any `.env*` in the diff. Any connection string, key or token pasted into a tracked file,
a doc, or a commit message. Report the *location*, never the value.

### 7. Unexplained working-tree state

Staged deletions, a dirty tree with no matching recent commit, an untracked directory that
looks like build output or a stray clone. Not a constitutional violation — but it is how
work gets lost, so it belongs in the report.

---

## Ranking

**High** — act today. A rule in §C is broken, or a §B path is touched. Something is already
wrong, or is one commit from being wrong.

**Watch** — true but not urgent: a known gap (`DbNotification` pruning, `getAgentProfile`
fan-out, `scrapingMaxRunMinutes` at 0), a finding carried from a previous run that has not
moved, or a pattern trending the wrong way.

**Noise** — looked at, decided against. List it in one line each. Silence is
indistinguishable from a miss, so say what you dismissed.

When in doubt, **Watch** rather than High. A loop that cries wolf gets ignored, and an
ignored loop is worse than no loop.

---

## Output

Feeds [`STATE.md`](../../../STATE.md) directly.

```markdown
## High Priority
- **I1 violated** — unbounded Lead read
  `path/to/file.ts:112` — `prisma.lead.findMany({ select: {...} })`, no where, no take.
  C1. This shape cost 86.6 GB in one cycle.
  → Route through `getDedupCache()`.

## Watch
- Working tree has 11 staged deletions under `.claude/` with no matching commit (3 runs open).

## Noise
- README.md reflowed — prose only.
```

Rules:

- **Every finding cites a rule, a file and a line.** No citation, no finding.
- **Every High carries its cost** — the number from the constitution, not an adjective.
- One line of evidence per finding. The reader is scanning under time pressure.
- Never propose an architectural overhaul. This skill produces signal.
- If nothing was found, say so with the date. Never leave the section blank.
