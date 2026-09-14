# Loop State — DataForge

Last run: 2026-09-15 (Constitution Watch, L1 report-only) · **revised after verifier REJECT**
Constraints: 26 rules active · Egress this run: 0 bytes

Gate: `.loop-pause` absent. Rule count recounted from `loop-constraints.md` —
A(1) + B(8) + C(10) + D(4) + E(3) = **26**, matches the file's header.

**This repository is public** — `github.com/marketingcad/DataForge` (remote confirmed via
`git remote -v`; public visibility verified by the coordinator via `gh`). Every credential
named below is in public git history. That fact is load-bearing for both High findings.

Scope note: **no source file is modified in the working tree.** The diff against `HEAD` is
13 paths, all Markdown or editor config. `git diff --name-only HEAD` against the denylist
pattern returns empty — **B1–B8 are clean in the working tree.** Both High findings below
are in committed state, not in pending work.

---

## High Priority

- **C9 breached — a live credential is committed in a tracked doc**
  `GHL_SYNC_PLAN.md:22` (as it stands in `HEAD`)
  The line is a full GoHighLevel webhook URL of the form
  `POST https://services.leadconnectorhq.com/hooks/<locationId>/webhook-trigger/<triggerId>`
  with both path segments populated with live values. It entered the repo in commit
  `91a67fa` ("feat: marketing management — badges with image upload, challenges,
  commissions") and is still present at `HEAD`.
  CLAUDE.md **C9**: *"Secrets never enter committed files… Never print a live connection
  string into a commit, a doc, or a shared transcript."* The developer has already reached
  the same conclusion in the working tree — the unstaged edit to this file replaces the
  value with placeholders and adds the line *"The live URL is a credential (C9): it lives in
  `AppSettings.ghlWebhookUrl`, never in a doc."*
  Cost: **exposure not quantifiable from the repository** (per `loop-constraints.md` E3,
  stated rather than guessed) — but the repository is **public**, so the reachable audience
  is everyone, not just repo collaborators. What the doc states outright is that the endpoint
  returns `{"status":"Success: test request received"}` HTTP 200 and is used for pushing
  leads *to* GHL. That it accepts those POSTs **without authentication is an inference**, not
  a documented fact — the doc says an API key is needed for the separate read path, and says
  nothing explicit about the webhook's auth model. Redaction in the working tree does not
  remove the value from history either way.
  → Two steps, not one: (1) commit the redaction that is already sitting unstaged;
  (2) treat the value as burned and rotate it in GHL, because step 1 does not reach
  `91a67fa`. See **Escalations** — the rotate/history decision is a human call.

- **C9 breached again — six committed Postgres connection strings with embedded passwords**
  Six lines across four tracked files, all present at `HEAD` and all unmodified in the
  working tree:

  | File | Lines |
  |---|---|
  | `dataforge-app-lite/scripts/get-feedback.mjs` | 3 |
  | `dataforge-app-lite/setup-vercel-env.sh` | 24, 25 |
  | `dataforge-app/scripts/get-feedback.mjs` | 3 |
  | `dataforge-app/setup-vercel-env.sh` | 24, 25 |

  Each is a populated `postgresql://` URL carrying a `neondb_owner` password against a
  `neon.tech` host. Values withheld per **D4** — locations and counts only. Confirmed with
  `git grep -lE 'postgres(ql)?://[^:]+:[^@]{6,}@' HEAD`.
  CLAUDE.md **C9**: *"Secrets never enter committed files."* These are **legacy pre-Supabase
  Neon credentials** — which is the likely reason they survived earlier sweeps, including my
  own first pass, which scanned only `.env*` coverage and the newly added docs and wrongly
  concluded from that narrow evidence that C9 held. **C9 states no legacy exemption.**
  Cost: the repository is **public**, so these have been world-readable for as long as they
  have been committed. Whether the Neon project still accepts them is **not determinable
  from the repository** (E3) — see Escalations. Note the asymmetry with the current stack:
  `src/lib/prisma.ts:13` still branches to `PrismaNeon` for any connection string containing
  `neon.tech`, so the Neon path is live code, not dead code.
  → Rotate or decommission the Neon credentials first; scrubbing the files second. **Two of
  the four files are under `dataforge-app/`, which is B7** (frozen backup, never edit), so
  editing those two is an **escalation by E1**, not loop work — the rotation, however, is
  outside the repo entirely and is not constrained by B7.

---

## Watch

- **CLAUDE.md §5 item 1 is now stale — the constitution disagrees with the repository.**
  `CLAUDE.md:241-243` still reads *"No repeatable backup… A `scripts/backup.mjs`
  counterpart to `restore-backup.mjs` is the highest-value work left."* That script exists:
  `dataforge-app-lite/scripts/backup.mjs`, added in commit `c561c65` ("Add
  scripts/backup.mjs; let duplicate resolve keep the other copy"). CLAUDE.md §2 step 4
  requires the constitution to be updated *in the same commit* as the change it describes.
  Cost: a stale §5 sends the next session to re-solve the highest-value open item.
  → Strike or rewrite §5 item 1. (Age: 1 run — first observation.)

- **I9 — three of the four pool floors are breached on the local-connection branch.**
  `dataforge-app-lite/src/lib/prisma.ts`, all inside one `new Pool({...})`:

  | Setting | Line | Local value | I9 floor |
  |---|---|---|---|
  | `idleTimeoutMillis` | 34 | `10_000` | ≥ 60000 |
  | `keepAlive` | 36 | `false` (`!isLocal`) | must be true |
  | `max` | 45 | `10` | ≥ 15 |

  The **production path is fully compliant** (60 000 / true / 15, same lines), and C8's
  measured failure — *"`getAgentProfile` fires 12 parallel queries; a pool of 10 produced
  'timeout exceeded when trying to connect'"* — was on the remote path. `isLocal` is
  `localhost`, `127.0.0.1`, or an `sslmode` of `disable`/`prefer` (lines 21–24).
  A fourth setting, `connectionTimeoutMillis: isLocal ? 0 : 30_000` (line 42), is literally
  under the ≥ 30000 floor but in the harmless direction — `0` means wait indefinitely, not a
  short budget — so the 12-wide `Promise.all` queues against a pool of 10 rather than
  throwing. That mitigation is why this stays **Watch** and not High: the cost is
  serialisation on a dev machine, not an outage.
  → Either raise the local branch to the floors or amend I9 to scope them to the remote path
  (the latter needs CLAUDE.md §2's four steps). `prisma.ts` is not in the diff; unchanged
  this run. (Age: 1 run.)

- **Known gap 4 open — `getAgentProfile` fan-out.** `dataforge-app-lite/src/lib/marketing/agent.service.ts:190`,
  `Promise.all` at line 201 destructuring **12** results — exactly the 12 C8 names. Inside
  it: 5 × `callLog.count` (lines 211–215) and 3 × `callLog.aggregate` (227–229), followed by
  a `$queryRaw` (233) and a `callLog.findMany` (242) outside the batch — **10 CallLog round
  trips for one profile page.** CLAUDE.md §4 describes this as *"six `callLog.count()`
  calls"*; the file has five `.count()` plus three `.aggregate()`, so the constitution's
  count is slightly off while its point stands.
  Cost: CLAUDE.md §4 — *"Every serious problem here has been an access-pattern problem."*
  → One query with `FILTER`, per the `src/lib/dashboard/service.ts` model named in §4. Not a
  denylist path; safe to fix. (Age: 1 run.)

- **Known gap 6 open, and wider than §5 records it.** `CODEBASE_MAP.md:13` still lists
  *"Neon PostgreSQL (serverless — sleeps after 5 min on free tier)"*, with `@prisma/adapter-neon`
  at :14 and Neon env vars at :357–358. CLAUDE.md §5 item 6 names this file only — but
  `REPORT.md:4` also reads *"**Stack:** Next.js 15 · Prisma · Neon PostgreSQL · shadcn/ui ·
  Tailwind CSS"* and is flagged nowhere. The new docs handle `CODEBASE_MAP.md` well
  (`README.md:49`, `docs/CODEBASE_GUIDE.md:7` and `:17`, `docs/ARCHITECTURE.md:387`) and
  `REPORT.md` not at all. Note `docs/ARCHITECTURE.md:136-138` correctly documents the live
  Neon fallback branch in `createPrismaClient()` — that one is accurate, not stale.
  Cost: the trap CLAUDE.md §0 was written to prevent — a session trusting the wrong stack
  table. → Add `REPORT.md` to §5 item 6, or mark it historical at its head. (Age: 1 run.)

- **Known gap 3 open — nothing prunes `DbNotification`.** The only deletion in app code is
  `dataforge-app-lite/src/lib/notifications/service.ts:73` —
  `prisma.dbNotification.deleteMany({ where: { userId } })` — a per-user clear-all, not an
  age-based prune. No scheduled job touches the table.
  Cost: CLAUDE.md §5 item 3 — **77k+ rows and growing**. → An age-based prune. (Age: 1 run.)

- **11 staged deletions under `.claude/`, staged but uncommitted.** Five agent definitions
  and the `auto-keyword-scraper` skill with its four `references/` files, plus
  `.claude/settings.local.json` — 1,897 deletions in the index with no commit behind them.
  **Confirmed intentional by the developer**, so this is not a loss event; it is flagged only
  because a staged-but-uncommitted index is transient state. The matching `.gitignore` edit
  that makes the `settings.local.json` deletion stick (`**/settings.local.json`, correctly
  justified with a C9 reference) is *unstaged*, so a partial commit could reintroduce the
  file. → Commit the two together. (Age: 1 run.)

---

## Noise (looked at, dismissed)

- **No tracked `.env` file exists anywhere in the repo**, and `git check-ignore` confirms both apps' env paths are ignored (`dataforge-app-lite/.gitignore:34` is `.env*`; root `.gitignore` covers `dataforge-app/.env*`). That is the *only* claim this evidence supports — it is **not** evidence that C9 holds. See High #2.
- `README.md:129` and `docs/OPERATIONS.md:161` contain `postgresql://` strings — both placeholders, neither carries the project ref or a credential.
- `README.md` names the Supabase project ref — already public in CLAUDE.md §0; an identifier, not a secret.
- `vercel.json:2` still chains `node scripts/migration/ensure-dedup-indexes.mjs` after `prisma db push`. **I8 holds.**
- `dedup-cache.ts:60` `FULL_REBUILD_MS` = 24 h and `:67` `OVERLAP_MS` = 5 min, both still applied (`:175`, `:201`, `:209`). **I6 holds.**
- 2,054 lines of new docs in `7db602e` scanned for secret-shaped strings and for guidance contradicting C1–C9. Clean apart from the Neon/`REPORT.md` item above.
- `LOOP.md`, `loop-constraints.md`, `loop-budget.md`, `.claude/` untracked — this loop's own setup, added deliberately.
- I1–I5, I7, I10 not assessed against a diff: no code changed. Spot-checks above found nothing contradicting them.

---

## Escalations (need a human decision)

- **Rotate the GHL webhook, and decide about history.** Committing the pending redaction
  does not remove the value from `91a67fa`, and the repository is public. Whether to rotate
  the trigger in GHL, rewrite history, or accept the exposure is a human decision, and sizing
  the blast radius needs access to the GHL account — **a measurement the loop may not take at
  L1** (`loop-constraints.md` E3, `loop-budget.md` §1 rule 1). Reported, not guessed.

- **Are the six committed `neondb_owner` credentials still live?** Not determinable from the
  repository — answering it means attempting a connection to the Neon host, which is both a
  database call (**0-byte allowance at L1**, `loop-budget.md` §1) and an unquantifiable claim
  under **E3**. The loop reports the exposure and stops. Two of the four affected files are
  under `dataforge-app/` (**B7**, frozen backup), so scrubbing those is an **E1 escalation**
  as well — the loop describes the change and does not make it. Rotation itself happens in
  the Neon console, outside the repo and outside B7.

- **Known gap 5 — `scrapingMaxRunMinutes` defaults to `0`, no ceiling on the auto-run loop.**
  `dataforge-app-lite/prisma/schema.prisma:492` — `scrapingMaxRunMinutes Int @default(0)`;
  consumed at `dataforge-app-lite/src/lib/keywords/service.ts:237`
  (`const maxMinutes = settings?.scrapingMaxRunMinutes ?? 0;`). That consumer is
  **`loop-constraints.md` B3** (`keywords/service.ts`, C6 — scheduling and `enforceMaxAutoRunTime`),
  so any fix escalates by E1 regardless of how safe it looks. The loop is **not** proposing
  a change; it is reporting that the default leaves the auto-run loop unbounded and that the
  remedy lives behind a denylist boundary. Cost not quantified — bounding it would need job
  run-time data from the database (0-byte allowance at L1).

---
## Run log
- 2026-09-15 — 1 high, 6 watch, 2 escalations · First run. No source changed and no denylist path touched; the one urgent item is a live GHL webhook credential committed at `GHL_SYNC_PLAN.md:22` (C9), already redacted unstaged but still in history. Remaining findings are constitution drift (§5 item 1 stale) and four known gaps confirmed still open against real lines.
- 2026-09-15 — **revised after verifier REJECT** · 2 high, 6 watch, 3 escalations. Verifier caught a critical miss: my C9 sweep covered only `.env*` and the new docs, and concluded "C9 holds" — false. Six committed `neondb_owner` connection strings across four tracked files (two under B7) promoted to High, and the repo is **public**, which re-costs both High findings. Also widened the I9 item from one breached floor to three, fixed a truncated `REPORT.md:4` quote, and marked the GHL endpoint's auth model as inferred rather than documented. Lesson for the next run: a negative C9 claim needs a repo-wide credential-shaped grep at `HEAD`, not an `.env` check.
