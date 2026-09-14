# DataForge — Operations Runbook

> Environment, local setup, deployment, desktop packaging, backup/restore, the egress
> budget, and the failures that have actually happened.

---

## 1. Environment variables

`.env*` is **gitignored and must stay that way**. Nothing here ever goes into a commit, a
doc, or a shared transcript (CLAUDE.md C9).

The app reads `.env.local` first, then `.env` (dotenv does not override already-set vars,
so the first file loaded wins and the second only fills gaps). `prisma.config.ts`
deliberately mirrors that precedence so the Prisma CLI targets the **same** database the
app does. On Vercel both files are absent and the dashboard-injected vars are used as-is.

### Required

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | app, scripts | Supabase **transaction pooler, port 6543**. Port 5432 is blocked on the developer's ISP. |
| `POSTGRES_PRISMA_URL` | app, scripts | Preferred over `DATABASE_URL` when set (Vercel Postgres convention). Resolution order in `src/lib/prisma.ts`: `POSTGRES_PRISMA_URL` → `DATABASE_URL`. |
| `POSTGRES_URL_NON_POOLING` | Prisma CLI only | Direct connection for migrations. `prisma.config.ts` prefers it. Unreachable from the developer's network. |
| `AUTH_SECRET` | NextAuth | Falls back to a dev placeholder — **set it in production**. |

### Integrations

| Variable | Used by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Storage uploads (`documents` bucket) — `/api/upload/document`, `documents.actions.ts` |
| `ANTHROPIC_API_KEY` | Forger fallback key and `/api/scraping/image`. The boss-registered `AppSettings.forgerApiKey` takes precedence for Forger. |
| `CRON_SECRET` | `/api/scraping/cron` when not called by Vercel's own cron |
| `SERPAPI_API_KEY` | Legacy SerpAPI discovery; omit to disable that path |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs in emails/links |

### Tuning

| Variable | Default | Effect |
|---|---|---|
| `KEYWORD_SCRAPER_CONCURRENCY` | 3 | Cron's concurrent keyword-job cap. The in-process loop uses `AppSettings.scraperMaxConcurrency` instead. |
| `DEDUP_REFRESH_MS` | 60 000 | Dedup cache delta re-sync interval |
| `DEDUP_REBUILD_MS` | 86 400 000 | Full rebuild interval. **Do not disable** — see [`SCRAPING_PIPELINE.md` §7](SCRAPING_PIPELINE.md#7-deduplication--three-layers-three-different-jobs). |
| `DEDUP_CACHE_DIR` | `%LOCALAPPDATA%\DataForge\cache` | Where the local copy lives |
| `DEDUP_CACHE_PERSIST` | on | `0` forces in-memory only |
| `PLAYWRIGHT_BROWSERS_PATH` | — | Where the packaged desktop app keeps Chromium (writable, survives updates) |

### Build / desktop / scripts

| Variable | Purpose |
|---|---|
| `BUILD_TARGET=desktop` | Switches `next.config.ts` to `output: "standalone"` with pinned tracing root |
| `DATAFORGE_PORT` | Desktop server port (default 3000) |
| `DATAFORGE_ATTACH=1` | Desktop window attaches to an already-running dev server instead of spawning one |
| `TARGET_DATABASE_URL` | `restore-backup.mjs` target; read from `.env.migrate` if not in the environment |

---

## 2. Local development

```bash
cd dataforge-app-lite
npm install
npx playwright install chromium     # only if you will run scrapes locally

# create .env.local with at least DATABASE_URL and AUTH_SECRET

npx prisma generate
npm run dev                         # tsx server.ts -> http://localhost:3000
```

> **Quit the desktop app first.** It binds the same port 3000, serves a *pre-built* bundle
> (so your changes silently do not appear), and holds DB connections from whenever it
> launched (so after an env change it keeps using the old database). This caused three
> rounds of confusion in one session.

Seeding a first account: `npx tsx prisma/seed.ts` creates `boss@dataforge.dev` /
`Password1234`. **Change it immediately anywhere but local dev.**
`scripts/create-boss.ts` and `scripts/reset-password.ts` are the ongoing equivalents.

### npm scripts

| Script | What it does |
|---|---|
| `dev` | `tsx server.ts` — Next + Socket.io, 4 GB heap |
| `build` | `prisma generate && next build` |
| `start` | Production `server.ts` |
| `lint` | ESLint |
| `desktop` | Run Electron against the current build |
| `desktop:build-web` | Standalone Next build for Electron (`BUILD_TARGET=desktop`, webpack) |
| `desktop:browsers` | `playwright install chromium` |
| `desktop:assemble` | Stage `.next/standalone` + copy `.env*` into it |
| `desktop:pack` | `electron-builder --win` |
| `desktop:dist` | browsers → build-web → assemble → pack (local build, no publish) |
| `desktop:publish` | same, then publish to the private releases repo (needs `GH_TOKEN`) |

---

## 3. Deployment — web

Vercel, configured entirely by `vercel.json`:

```json
{
  "buildCommand": "prisma generate && prisma db push --accept-data-loss && node scripts/migration/ensure-dedup-indexes.mjs && next build",
  "regions": ["sin1"],
  "crons": [{ "path": "/api/scraping/cron", "schedule": "* * * * *" }]
}
```

* **`regions: ["sin1"]`** puts functions beside the database (`ap-southeast-1`). Do not
  move them without measuring.
* **`prisma db push --accept-data-loss`** runs on every deploy. This is [known gap
  §2](ARCHITECTURE.md#8-known-architectural-gaps): moving to `prisma migrate deploy` is
  preferred (the history is baselined) but must first be verified from a network where the
  Prisma CLI can reach port 5432.
* **`ensure-dedup-indexes.mjs` is not optional.** `db push` drops the three expression
  indexes as drift because Prisma's schema language cannot represent them. The script is
  `IF NOT EXISTS` and never fails the build.
* Socket.io does not run on Vercel; notification delivery degrades to page revalidation.

---

## 4. Deployment — desktop

### Releasing (the normal path)

Desktop releases are **tag-triggered**. Ordinary pushes to `main` never reach installed
apps — only a version tag does.

```bash
# 1. Bump the version. The tag and package.json MUST agree or the build fails loudly;
#    electron-updater compares versions, so a mismatch breaks updates silently on
#    every installed machine.
npm version 0.3.0 --no-git-tag-version   # in dataforge-app-lite/
git commit -am "Desktop v0.3.0"

# 2. Tag and push. .github/workflows/desktop-release.yml does the rest.
git tag v0.3.0
git push origin main --tags
```

The workflow builds on `windows-latest`, asserts the tag matches `package.json`, writes
`.env` from the `DESKTOP_ENV_FILE` secret, packages, and publishes to the **private**
releases repo. Installed apps pick it up within 4 hours, or on their next launch.

Use **Run workflow** in the Actions tab with `dry_run: true` to build without publishing.

### Where releases live, and why

Installers go to **`marketingcad/DataForge-releases` (private)** — *not* to this repo.
`marketingcad/DataForge` is public, and `electron/assemble.mjs` bakes `.env` into the
package, so a public release asset would put `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
and `AUTH_SECRET` on an unauthenticated URL. CLAUDE.md C9.

### Required secrets

| Where | Name | Scope |
|---|---|---|
| Actions secret on `DataForge` | `RELEASE_TOKEN` | Fine-grained PAT, **`contents: write`** on `DataForge-releases` only |
| Actions secret on `DataForge` | `DESKTOP_ENV_FILE` | The full `.env` contents, including `UPDATE_FEED_TOKEN` |
| Inside `DESKTOP_ENV_FILE` | `UPDATE_FEED_TOKEN` | Fine-grained PAT, **`contents: read`** on `DataForge-releases` only |

`UPDATE_FEED_TOKEN` ships **inside the installer** — the app needs it to read a private
feed. Its blast radius is "can download DataForge installers", not "owns the database",
but it is still a secret in a distributed artifact and **cannot be rotated without
shipping a new build**. Keep its scope minimal and never reuse it for anything else.

### How the update behaves

Download is silent and in the background; the user is notified when it is ready; it
installs **on quit**. The app never restarts itself.

That last point matters more than it sounds: DataForge **hides to the tray rather than
quitting**, so a machine left running may not quit for weeks and `autoInstallOnAppQuit`
would never fire. The tray therefore grows a **"Restart & update now"** item once an
update has downloaded — that, and the notification, are the real delivery mechanism;
quit-install is the fallback. Restarting does stop a running scrape, which is acceptable
only because the user asked: the job's row goes stale and the 3-minute reaper cleans it up.

`electron/updater.js` is defensive by design — it no-ops in dev, when
`electron-updater` is missing, and when `UPDATE_FEED_TOKEN` is unset. A failed update
check must never cost a launch or a scrape.

### Building locally

```bash
npm run desktop:dist      # build + package, no publish
npm run desktop:publish    # build + package + publish to the private repo (needs GH_TOKEN)
```

Output lands in `dist/` (gitignored — it contains bundled secrets and the installer).
Installer: NSIS, per-user, install directory changeable.

> ⚠️ **`signExecutable` is `false`.** Windows SmartScreen warns on **every** update, not
> just the first. Users learning to click through that warning is a habit worth avoiding;
> a code-signing certificate is the only real fix.

> **`electron/assemble.mjs` copies `.env.local` and `.env` into the packaged app.**
> Rotating the database password therefore breaks **every installed desktop app** until
> each one is rebuilt and redistributed. Plan rotations accordingly.

Runtime behaviour worth knowing:

* The window loads `http://localhost:3000` served by a child Next standalone process
  launched with Electron's own Node (`ELECTRON_RUN_AS_NODE=1`) — no system Node needed.
* Closing the window **hides to the tray** so scraping continues; only tray → Quit exits.
* Chromium for scraping downloads on first scrape into a persistent, writable per-user
  path (app resources are read-only and would be wiped by updates).
* Startup milestones: `<userData>/launch-timing.log`.

---

## 5. Backup and restore

There is **no automated backup** on the Supabase Free plan. `scripts/backup.mjs` is the
only repeatable path.

```bash
# 1. ALWAYS estimate first — row counts + on-disk sizes, near-zero egress
node scripts/backup.mjs --estimate

# 2. Dump (default output: Desktop/dataforge-backup-<timestamp>/)
node scripts/backup.mjs --exclude=DbNotification

# 3. Validate, then restore into a target
node scripts/restore-backup.mjs --dir="<backup dir>" --dry-run
node scripts/restore-backup.mjs --dir="<backup dir>" --url="postgresql://...:6543/postgres"
```

Layout: `_manifest.json` (createdAt, host/db — never credentials, counts) plus one
`<Table>.ndjson` per table.

Operational notes:

* A full dump moves roughly the whole database over the wire, and **egress is metered**
  (5 GB/month shared across Database/Auth/Storage/Realtime). Estimate before spending it.
* **Run with the auto-keyword loop stopped.** Each table is internally consistent but
  there is no cross-table snapshot; a dump taken mid-scrape can hold a child row whose
  parent landed in a table already written. The restore's FK ordering +
  `ON CONFLICT DO NOTHING` turns that into a few skipped rows, not a failure.
* Restore is re-runnable and resumable. `--truncate` is destructive; `--only=A,B` for
  partial restores.
* **Never list every target column.** Passing `NULL` for a column absent from the backup
  overrides its DEFAULT — this is what broke `AppSettings` (its backup predated
  `timezone`). `restore-backup.mjs` names only the columns each batch actually carries.
* Backup directories are gitignored (`dataforge-backup-*/`) — they contain lead data and
  password hashes.

### Bootstrapping a fresh project

1. Apply `scripts/migration/new-project-schema.sql` in the SQL Editor as one transaction
   (generated by `prisma migrate diff --from-empty --to-schema prisma/schema.prisma
   --script`). This route exists because `prisma migrate deploy` needs port 5432.
2. Load data with `restore-backup.mjs`.
3. Run `ensure-dedup-indexes.mjs`.
4. Baseline `_prisma_migrations` by hand (mark all migrations applied).
5. **Create the `documents` storage bucket** — it was not migrated in 2026-08 because it
   was empty, and `documents.actions.ts` expects it.

> `prisma.config.ts` loads dotenv, which prints `[dotenv@17.3.1] injecting env…` to
> **stdout**. Piping `prisma migrate diff` straight to a file captures those lines and
> produces invalid SQL. Filter them.

---

## 6. The egress budget

Supabase **Free: 5 GB unified egress** per cycle, covering Database, Auth, Storage,
Realtime and Functions together. Restrictions apply to the **whole organisation**, not one
project — every project returns HTTP 402 and the database refuses pooler connections.

Treat egress as a first-class budget:

* Never read the whole `Lead` table in a request or job path (CLAUDE.md C1).
* One query with `FILTER` beats N `count()` calls.
* Cache page aggregates with `unstable_cache` + tag, purged by `updateTag`.
* Pull heavy optional payloads on demand (`/api/leads/locations`).
* `node scripts/backup.mjs --estimate` before any dump.

### What happened in 2026-08

| | |
|---|---|
| Cause | One `prisma.lead.findMany({ select: { businessName, phone } })` per scraping job |
| Cost per job | 4.6 MB payload ≈ **7.6 MB on the wire** |
| Volume | 11,614 jobs |
| Total | **86.6 GB against a 5 GB quota — 1,732%** |
| Shape | Self-amplifying: each job added leads, so the next read was bigger — **quadratic** |
| Consequence | Whole Supabase org restricted; project transfer is itself a restricted action, so recovery meant restoring a backup into a fresh project |
| Fix | `src/lib/scraping/jobs/dedup-cache.ts` — a local disk copy with delta sync. Cold start 4,456 ms → **561 ms** |

Full narrative: [`../HANDOVER.md`](../HANDOVER.md).

---

## 7. The network

This is environmental, not a bug in the code:

* TCP connect to `ap-southeast-1` measures **545–2700 ms**, with roughly **one failure in
  six**.
* **Port 5432 is blocked entirely** by the developer's ISP — both the direct connection
  and the session pooler are unreachable, and `pg_dump` is unsupported through the 6543
  transaction pooler. That is why backups are client-side and schema changes go through
  the SQL Editor.
* Expect intermittent `P1001` / `ETIMEDOUT` / `ENOTFOUND`.

**Any script written against this database needs connect retries.** In app code use
`withDbRetry`, especially around `Promise.all`.

---

## 8. Runtime settings (`AppSettings` singleton)

Changed from `/settings` by the boss; no deploy required.

| Setting | Default | Effect |
|---|---|---|
| `scrapingGlobalPause` | false | Stops all scraping |
| `scrapingDefaultMaxLeads` | 50 | New-keyword default |
| `scrapingDefaultInterval` | 1440 min | New-keyword default |
| `scrapingBoost` | false | ~25% pacing delays — faster, higher CAPTCHA/block risk |
| `scrapingMaxRunMinutes` | **0 (disabled)** | Force-stops a keyword auto-running longer than this. 0 means **no ceiling on the auto-run loop** — known gap. |
| `scraperMaxConcurrency` | 3 | Simultaneous auto-run scrapes (each is a Chromium). 8 GB → 2–3, 32 GB → 6–8. Re-read every loop iteration. |
| `leadQualityGoodThreshold` / `MediumThreshold` | 70 / 40 | Quality badge cutoffs |
| `timezone` | `America/New_York` | IANA zone aligning day/week/month boundaries with GHL |
| `commissionCurrency` | `₱` | Display currency |
| `disabledFeatures` | `[]` | Hides whole app areas |
| `ghlApiKey`, `ghlSubAccountApiKey`, `ghlLocationId`, `ghlInboundSecret` | — | GHL credentials, rotatable from the UI |
| `balloonEnabled`, `balloonApptsPerPoint` | true, 1 | Balloon game rules |
| `forgerApiKey`, `forgerModel`, `forgerMaxRequestTokens` | —, —, 6000 | Forger config and per-request cost guard |
| `reportsShareToken` | — | Token for `/share/reports/[token]` |

---

## 9. Troubleshooting

| Symptom | First thing to check |
|---|---|
| Code changes not appearing | Desktop app running on port 3000 serving a pre-built bundle. Quit it. |
| App using the wrong database after an env change | Same — the desktop app holds connections from launch. |
| `P1001` / `ETIMEDOUT` / `ENOTFOUND` | The network (§7). Retry; verify with `/api/health/db`. |
| *timeout exceeded when trying to connect* | Pool `max` too low for a `Promise.all` fan-out. It is 15 for a reason. |
| Dev serving a stale Prisma client | Bump `CLIENT_VERSION` in `src/lib/prisma.ts`. |
| Duplicate leads appearing | Are the three expression indexes present? `ensure-dedup-indexes.mjs` should have run after `db push`. |
| A known business never gets scraped | Stale dedup local copy holding a deleted name — the 24 h rebuild clears it. Check `dedupCacheStatus()`. |
| Jobs frozen at `running` | Function timeout; reaped after 3 min by the cron (web) or the auto-loop (desktop). |
| Keyword silently stopped | 5 consecutive failures → `enabled: false`. Check `lastError`. |
| Invalid SQL from `prisma migrate diff` | The dotenv banner on stdout. Filter it. |
| Document upload fails | The `documents` storage bucket does not exist in the project. |
| An animation "doesn't work" | Lite Mode (`data-lite` on `<html>`) freezes animation by design. |
| Phone renders as a fake US area code | `formatPhone()` assumes North America; 498 Philippine landlines start with `0`. |

---

## 10. Changing a rule in CLAUDE.md

The rules in [`../CLAUDE.md`](../CLAUDE.md) are trade-offs, not laws — but amending one
takes four steps, in order:

1. **State which rule and why it no longer holds** — reference code or data, not a hunch.
2. **Quantify the consequence.** Measure it. Every rule came from a number (86.6 GB, 860
   leads on one email, 16 colliding names, 12 parallel queries).
3. **Get explicit developer sign-off**, naming the rule.
4. **Update `CLAUDE.md` in the same commit** as the code change.

If you cannot complete step 2, you are guessing. Say so and stop.
