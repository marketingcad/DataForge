# DataForge — Codebase Guide

> A file-by-file tour of `dataforge-app-lite/`, plus the conventions that hold across it.
> Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first for the layering this guide assumes.
>
> This supersedes the root `CODEBASE_MAP.md`, written 2026-04. Its stack table was
> corrected on 2026-09-15, but the rest of that file has **not** been re-verified against
> the current code. The database is **Supabase** (since 2026-08).

---

## 1. Repository layout

```
DataForge/
├── CLAUDE.md               ← the Constitution: rules that broke something when violated
├── HANDOVER.md             ← the 2026-08 Supabase migration + egress incident
├── CODEBASE_MAP.md         ← ⚠️ body unverified since 2026-04; superseded by this file
├── DATAFORGE_PRD.md        ← product brief
├── GHL_SYNC_PLAN.md        ← GoHighLevel integration, as-built (shipped; not a plan)
├── DataForge-SOP.pdf/html  ← operator SOP
├── docs/                   ← this documentation set
├── dataforge-app/          ← ⛔ frozen backup. Do not edit.
└── dataforge-app-lite/     ← ✅ THE APP
    ├── electron/           ← desktop shell
    ├── prisma/             ← schema, 30 migrations, seed
    ├── public/
    ├── scripts/            ← backup, restore, migration, admin utilities
    ├── src/
    ├── server.ts           ← custom Next + Socket.io server (dev, start, desktop)
    ├── next.config.ts      ← desktop build is opt-in via BUILD_TARGET=desktop
    ├── prisma.config.ts    ← loads .env.local then .env for the Prisma CLI
    └── vercel.json         ← build command, sin1 region, 1-minute cron
```

---

## 2. `src/` at a glance

| Path | What it holds |
|---|---|
| `src/app/(app)/**` | Authenticated pages (Server Components) |
| `src/app/(auth)/**` | Sign-in / sign-up |
| `src/app/share/**` | Public token-gated read-only pages |
| `src/app/api/**` | Route handlers — webhooks, SSE, cron, uploads, non-React clients |
| `src/actions/*.actions.ts` | Server actions, one file per domain |
| `src/lib/<domain>/` | Services — all business logic and every query |
| `src/lib/utils/` | Pure helpers: `dedup`, `normalize`, `scoring`, `timezone` |
| `src/components/` | UI, grouped by feature; `ui/` is shadcn |
| `src/contexts/`, `src/hooks/` | `TabsContext`, `MigrationContext`, `use-mobile` |
| `src/types/` | `lead.ts`, `scraping.ts`, `next-auth.d.ts` (session type augmentation) |
| `src/generated/prisma/` | **Generated** Prisma client — never edit, never review |

---

## 3. Entry points and infrastructure

| File | Role |
|---|---|
| [`server.ts`](../dataforge-app-lite/server.ts) | Custom HTTP server wrapping the Next handler and attaching Socket.io at `/api/socket`. Stores the io server on `global.__socketIO`. Used by `dev`, `start` and the desktop app — **not on Vercel**. |
| [`src/proxy.ts`](../dataforge-app-lite/src/proxy.ts) | NextAuth middleware. Matcher excludes `_next/*` and anything with a file extension. |
| [`src/auth.config.ts`](../dataforge-app-lite/src/auth.config.ts) | Edge-safe auth config: the `authorized()` callback and the public-path list. No Prisma, no bcrypt. |
| [`src/lib/auth.ts`](../dataforge-app-lite/src/lib/auth.ts) | Full NextAuth: credentials provider, bcrypt compare, Prisma adapter, JWT role claims. |
| [`src/lib/prisma.ts`](../dataforge-app-lite/src/lib/prisma.ts) | Pooled Prisma client + `withDbRetry`. Bump `CLIENT_VERSION` when changing client construction. |
| [`src/instrumentation.ts`](../dataforge-app-lite/src/instrumentation.ts) | Fire-and-forget `SELECT 1` at boot to warm the pool. Must never be awaited. |
| [`src/app/layout.tsx`](../dataforge-app-lite/src/app/layout.tsx) | Root layout, fonts, theme provider. |
| [`src/app/(app)/layout.tsx`](../dataforge-app-lite/src/app/%28app%29/layout.tsx) | Auth gate, sidebar, tabs provider, feature toggles, remembered sidebar width via the `df-sidebar-collapsed` cookie. |

---

## 4. Pages

### Leads department

| Route | Purpose |
|---|---|
| `/leads` | Category → folder board. Scoped by `CategoryAccess`. Duplicates banner, globe section, CSV import/export. |
| `/leads/list` | Flat, filterable, paginated table. |
| `/leads/[id]` | Single lead detail. |
| `/leads/new` | Manual lead entry. |
| `/scraping` | Jobs dashboard: Google scrape, domain scrape, image scrape, job history. |
| `/scraping/keywords` | Keyword manager — the auto-run control surface. |
| `/scraping/[id]` | Job detail with live polling. |

### Marketing department

| Route | Purpose |
|---|---|
| `/marketing` | Team overview: leaderboard, call volume, top performers. |
| `/marketing/my-leads` | An agent's assigned leads. |
| `/marketing/profile`, `/marketing/profile/[id]` | Agent profile and stats (`getAgentProfile` — the 12-query fan-out). |
| `/marketing/notes`, `/marketing/scripts` | TipTap documents with file attachments and share links. |
| `/marketing/manage/badges` \| `/tasks` \| `/commissions` | Admin surfaces. |
| `/my-commissions` | An agent's own commission ledger. |
| `/balloons` | The balloon-pop reward game. |

### Shared / admin

`/dashboard`, `/reports`, `/calendar`, `/kanban`, `/chat`, `/feedback`, `/profile`,
`/profile/[id]`, `/settings`, `/how-it-works`, `/unauthorized`,
`/admin/users`, `/admin/users/[id]`, `/admin/fleet` (live instances + remote commands),
`/admin/balloons`.

### Public

`/` (landing), `/sign-in`, `/sign-up`, `/share/[token]` (shared note or script),
`/share/reports/[token]` (shared report, gated by `AppSettings.reportsShareToken`).

---

## 5. Services — `src/lib/`

| Module | Key exports | Notes |
|---|---|---|
| `leads/service.ts` | `insertLead`, `updateLead`, `getLeads` | `insertLead` is the merge-or-create heart of the pipeline |
| `leads/access.ts` | `hasFullLeadAccess`, `getCategoryGrants`, `canSeeCategory`, `leadAccessWhere` | Default-deny category scoping |
| `leads/duplicates.ts` | duplicate groups, `mergeDuplicates`, `getDuplicateGroupCount` | Merge **refuses** when both copies carry a commission |
| `leads/geocode.ts`, `leads/locations.ts` | lat/lng resolution, globe data | |
| `utils/dedup.ts` | `checkDuplicate` | Raw SQL so both keys hit their indexes. Read the comment before touching. |
| `utils/normalize.ts` | `normalizePhone`, `formatPhone`, `normalizeEmail`, `normalizeWebsite` | ⚠️ `formatPhone` assumes North America — see §9 |
| `utils/scoring.ts` | `calculateDataQualityScore` | 0–100, monotonic |
| `utils/timezone.ts` | day/week/month boundaries in `AppSettings.timezone` | Keeps DataForge's periods aligned with GHL |
| `scraping/jobs/processor.ts` | `processKeywordJob`, `runKeywordAutoLoop`, email re-grab jobs | ⛔ off-limits (C6) |
| `scraping/jobs/dedup-cache.ts` | `getDedupCache`, `rememberLead`, `invalidateDedupCache`, `dedupCacheStatus` | Where dedup/egress work belongs |
| `scraping/jobs/service.ts` | `createJob`, `getJobById`, `updateJobStatus` | |
| `scraping/google/` | `scrapeGoogleMapsHeadless`, `discoverBusinesses` | ⛔ off-limits (C6) |
| `scraping/crawler/` | browser `core`, `email-grabber`, parsers | |
| `keywords/service.ts` | scheduling, rotation, failure backoff | ⛔ off-limits (C6) |
| `keywords/access.ts` | `KeywordAccess` grants | |
| `folders/service.ts` | folders + `getOrCreateUngroupedFolder` + export counts | |
| `industry/service.ts` | categories and subcategories | |
| `dashboard/service.ts` | `getDashboardStats` (`unstable_cache` + tag) | **The model for aggregate queries** — one query with `FILTER`, not N counts |
| `dashboard/boss.service.ts` | `getBossWidgets` | |
| `marketing/team.service.ts` | leaderboards, per-day charts, top performers | |
| `marketing/agent.service.ts` | `getAgentProfile` and friends | ⚠️ 12-query fan-out; the outstanding cleanup |
| `marketing/*.service.ts` | badges, tasks, commissions (rule / lead / rep) | |
| `ghl/client.ts` | typed GHL REST calls | |
| `ghl/sync.ts` | `autoSyncGhlCalls` / `Appointments` / `Opportunities` / `BookedContacts` | Watermarked by `AppSettings.ghl*LastSyncedAt` |
| `ghl/match-rep.ts`, `ghl/mapping.ts` | contact-owner → DataForge user, field mapping | |
| `rbac/roles.ts`, `rbac/guards.ts` | **the only** place permission logic lives | |
| `notifications/service.ts` | `createNotification`, `createNotificationsForRole` | Writes `DbNotification` + emits over Socket.io |
| `socket/emit.ts` | `emitNotification`, `emitNotificationToMany` | No-ops when there is no io server (Vercel) |
| `settings/service.ts` | `getSettings` — the `AppSettings` singleton | |
| `features.ts` / `features-guard.ts` | boss feature toggles (client-safe / server) | |
| `forger/` | `agent.ts`, `tools.ts`, `knowledge.ts`, `service.ts` | In-app assistant; tools include `search_leads`, `export_leads_csv`, `start_keyword`, `stop_all_scrapers` |
| `geo/city-populations.ts` | population-ordered city lists | Backs city rotation |
| `chat/`, `kanban/`, `calendar/`, `feedback/`, `reports/`, `users/` | conventional CRUD services | |

---

## 6. Server actions — `src/actions/`

30 files, one per domain, each guarded. Grouped:

* **Leads** — `leads`, `folders`, `industry`, `duplicates`, `category-access`
* **Scraping** — `scraping`, `domain-scrape`, `keyword-access`
* **Marketing** — `marketing`, `tasks`, `badges`, `commissions`, `lead-commissions`,
  `rep-commissions`, `appointments`, `balloons`, `seed-marketing`
* **GHL** — `ghl-sync`
* **Collaboration** — `chat`, `kanban`, `calendar`, `documents`, `feedback`,
  `notifications`, `reports`
* **Platform** — `auth`, `users`, `settings`, `fleet`, `forger`

Every one starts with `requireAuth()`, `requireRole(...)` or `requireDepartment(...)`.

---

## 7. Components worth knowing

| Component | Why it matters |
|---|---|
| `AppSidebar` / `SidebarNav` | Role-aware nav, honours `disabledFeatures`, collapse state persisted in a cookie |
| `AppClientShell` | Client shell wrapping pages: tabs, Forger widget, notifications, presence |
| `TabsContext` / `TabBar` / `Breadcrumb` | The in-app tabbed navigation model |
| `ThemeToggle` | **Reference implementation for `useSyncExternalStore`** — copy this pattern instead of `setState` in an effect |
| `LiteModeToggle` | Sets `data-lite` on `<html>`, which freezes all animation by design |
| `PresenceHeartbeat` | Posts `/api/instances/heartbeat` ~every 8 s and executes returned `RemoteCommand`s |
| `DbReconnect` | Polls `/api/health/db` and shows the reconnecting screen |
| `NotificationBell` | Socket.io subscriber + `DbNotification` list |
| `MigrationStatusBadge` / `MigrationContext` | GHL lead-migration progress |
| `leads/LeadTable`, `LeadFilters`, `FolderBoard`, `IndustryBoard` | The leads surface |
| `leads/DuplicatesBanner` | Entry point to the duplicate-resolution flow |
| `leads/LeadsGlobe` / `GlobeSection` | amCharts globe; coordinates fetched on demand from `/api/leads/locations` |
| `scraping/KeywordsManager` | The auto-run control surface |
| `scraping/JobDetailPoller`, `MiniBuffer`, `ScrapingTrivia` | Live job progress UI |
| `forger/ForgerWidget` | The in-app assistant |
| `rbac/RoleGate` | Client-side conditional rendering by role (**never** the security boundary) |

`src/components/ui/` is shadcn/ui on Radix + Base UI, Tailwind v4, `class-variance-authority`,
`tailwind-merge`. Charts use **Recharts** and **amCharts 5** (globe/geo only).

---

## 8. Scripts

| Script | Purpose |
|---|---|
| `scripts/backup.mjs` | NDJSON dump: `--estimate` first (row counts + sizes, near-zero egress), then `--out=`, `--only=`, `--exclude=`, `--batch=`. Client-side because the ISP blocks 5432 and `pg_dump` is unsupported through the 6543 transaction pooler. **Run with the auto-loop stopped** — there is no cross-table snapshot. |
| `scripts/restore-backup.mjs` | Loads that layout back. FK-ordered inserts, `ON CONFLICT DO NOTHING` (re-runnable), connect retries, `--dry-run`, `--truncate`, `--only=`. Reads `TARGET_DATABASE_URL` from `.env.migrate` so credentials never hit a command line. |
| `scripts/migration/ensure-dedup-indexes.mjs` | Re-asserts the three expression indexes after `prisma db push`. **Wired into `vercel.json`; keep it there.** |
| `scripts/migration/new-project-schema.sql` | Full schema as raw SQL (generated by `prisma migrate diff`) for bootstrapping a fresh project without port 5432. |
| `scripts/build-city-populations.mjs` | Rebuilds `src/lib/geo/city-populations.json` from `cities1000`. |
| `scripts/create-boss.ts`, `reset-password.ts`, `check-user.ts` | Admin utilities. |
| `scripts/get-feedback.mjs` | Dumps feedback reports. |
| `prisma/seed.ts` | Seeds the boss account (`boss@dataforge.dev` / `Password1234`). **Change this immediately outside local dev.** |

---

## 9. Conventions

**Write comments that explain *why*** — especially for anything a future reader would be
tempted to "clean up". The note in `src/lib/utils/dedup.ts` about directory scrapes
prevented a genuinely bad index from being added.

**Verify against real data before shipping a rule.** Every constitutional number came from
querying the actual database: 86.6 GB, 860 leads on one email, 16 colliding names, 12
parallel queries, 6,951 blank phones.

**Count the round trips.** Prefer one query with `FILTER` over N counts. Cache page-level
aggregates with `unstable_cache` + a tag, purged by `updateTag` on write.

**Guard every server action** with `requireDepartment(...)` / `requireRole(...)`.

### Known sharp edges

| Trap | Detail |
|---|---|
| **Desktop app on port 3000** | Serves a pre-built bundle and holds old DB connections. Quit it before `npm run dev`. |
| **The network is genuinely bad** | 545–2700 ms TCP connect to `ap-southeast-1`, ~1 failure in 6, port 5432 blocked entirely. Expect `P1001` / `ETIMEDOUT` / `ENOTFOUND`. **Any script you write needs connect retries.** |
| **`prisma.config.ts` prints a dotenv banner** | Piping `prisma migrate diff` to a file captures `[dotenv@17.3.1] injecting env…` and produces invalid SQL. Filter it. |
| **Restore: never list every column** | `NULL` for a column absent from the backup overrides its DEFAULT. This broke `AppSettings`. |
| **Next.js 16 cache API** | `revalidateTag(tag)` takes a second argument; use `updateTag(tag)` inside server actions. |
| **`setState` in an effect is lint-blocked** | Use `useSyncExternalStore`; see `ThemeToggle.tsx`. |
| **JSX comment before the root element** | `{/* … */}` before the root of a `return (` = two siblings = error. Put it above the `return`. |
| **`formatPhone()` assumes North America** | 498 leads are Philippine landlines starting `0`, rendered as a fake US area code (`0277395300` → `(027) 739-5300`). The duplicates UI has a local `displayPhone` guard; the shared helper is still wrong. Fix at the source if you touch it. |
| **Enums are narrow** | `CallStatus` has no `answered`. Read `enum_range` before writing test data. |
| **Lite Mode freezes animation** | `data-lite` on `<html>` — a user setting, not a bug. |
