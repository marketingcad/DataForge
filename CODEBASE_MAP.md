# DataForge — Codebase Map for AI Reference
> Use this file to recover context before editing anything significant.
> Last updated: 2026-04-02

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (Turbopack) |
| Language | TypeScript strict |
| Database | Neon PostgreSQL (serverless — sleeps after 5 min on free tier) |
| ORM | Prisma v7 TypeScript-first client (`@prisma/adapter-neon`) |
| Auth | NextAuth v5 (`auth()` server function) |
| UI primitives | shadcn/ui (Input, Button, Badge, Dialog, Slider, DropdownMenu…) |
| Dialog system | base-ui (`@base-ui-components/react`) — NOT Radix directly |
| Styling | Tailwind CSS v4 |
| Notifications/Toasts | Custom `NotificationProvider` + Sonner (`<Toaster />`) + `DbNotification` model |
| Scraping | Playwright stealth browser + SerpAPI (Google Maps) |
| Globe | amCharts 5 (`@amcharts/amcharts5`) + amcharts5-geodata |

---

## Critical: Prisma Singleton Pattern

**File:** `src/lib/prisma.ts`

```ts
const CLIENT_VERSION = "v4-lead-address"; // ← MUST BUMP after every prisma migrate/generate

// Busts the singleton in dev hot-reload when CLIENT_VERSION changes
if (global.__prismaVersion !== CLIENT_VERSION) {
  global.__prisma = undefined;
  global.__prismaVersion = CLIENT_VERSION;
}
```

**Why this matters:**
- After `prisma generate`, the running dev server still holds the OLD client in `global.__prisma`
- Adding a field and forgetting to bump `CLIENT_VERSION` → silent "unknown argument" failures
- The fix: bump `CLIENT_VERSION` string → save → dev server hot-reloads with fresh client

**After any schema change:**
1. Edit `prisma/schema.prisma`
2. Run `npx prisma db push --accept-data-loss` (or create a migration)
3. Run `npx prisma generate`
4. **Bump `CLIENT_VERSION`** in `src/lib/prisma.ts`

---

## Lib Folder Structure

```
src/lib/
├── prisma.ts                      # DB singleton (see above)
├── auth.ts                        # NextAuth v5 full config (bcrypt, JWT callbacks)
├── notifications.tsx              # Client-side NotificationProvider context
├── rbac/
│   ├── roles.ts                   # UserRole enum + ROLE_DEPARTMENTS map
│   └── guards.ts                  # requireAuth, requireRole, requireDepartment, getSessionRole
├── utils/
│   ├── normalize.ts               # normalizePhone, normalizeEmail, normalizeWebsite, formatPhone
│   ├── dedup.ts                   # checkDuplicate — matches on phone/email/website
│   └── scoring.ts                 # calculateDataQualityScore (0–100)
├── leads/
│   ├── service.ts                 # insertLead, updateLead, getLeads, getLeadById
│   └── locations.ts               # getLeadLocations → GlobePoint[] (Lead→Folder→Industry color chain)
├── folders/service.ts             # getFolders, createFolder, deleteFolder, updateFolderIndustry
├── industry/service.ts            # getIndustries, createIndustry, updateIndustry
├── keywords/service.ts            # getKeywords, createKeyword, updateKeyword, pickSearchTerm,
│                                  #   onKeywordJobSuccess (increments extraKeywordsIndex),
│                                  #   onKeywordJobFailure (tracks failedAttempts, disables at 5)
├── notifications/service.ts       # createNotification, createNotificationsForRole (excludeUserId param)
├── settings/service.ts            # getSettings, updateSettings (AppSettings singleton)
├── users/service.ts               # getUsers, getUserById
├── dashboard/service.ts           # getDashboardStats
└── scraping/
    ├── jobs/
    │   ├── service.ts             # createJob, getJobById, updateJobStatus
    │   └── processor.ts          # processKeywordJob (browser scrape → insertLead loop),
    │                              #   notifyKeywordSuccess, handleKeywordFailure
    └── google/
        └── maps-scraper.ts        # scrapeGoogleMapsHeadless — Playwright stealth scraper
                                   #   aria-label scoped panel extraction, no cross-business bleed
                                   #   strips leading icon chars from address innerText
```

---

## Prisma Schema — Key Models

### Lead
```prisma
model Lead {
  id                String       @id @default(uuid())
  businessName      String
  phone             String                          # stored digits-only
  email             String?
  website           String?                         # stored as root domain
  contactPerson     String?
  address           String?
  city              String?
  state             String?
  country           String?
  category          String?
  source            String                          # e.g. "GoogleMaps:keyword_<id>"
  recordStatus      RecordStatus @default(active)
  dataQualityScore  Int          @default(0)
  duplicateFlag     Boolean      @default(false)
  industriesFoundIn String[]
  folderId          String?                         # null = unfiled
  savedById         String?
  keywordId         String?
  dateCollected     DateTime     @default(now())
  lastUpdated       DateTime     @updatedAt
}
```

### ScrapingKeyword
```prisma
model ScrapingKeyword {
  id                   String    @id @default(uuid())
  keyword              String
  location             String
  maxLeads             Int       @default(50)
  enabled              Boolean   @default(true)
  intervalMinutes      Int       @default(1440)
  lastRunAt            DateTime?
  nextRunAt            DateTime?
  failedAttempts       Int       @default(0)
  lastError            String?
  extraKeywords        String[]
  extraKeywordsMode    String    @default("random")   # "random" | "ordered"
  extraKeywordsMin     Int       @default(1)           # used in random mode
  extraKeywordsMax     Int       @default(3)           # used in random mode (slider 0–40)
  extraKeywordsIndex   Int       @default(0)           # cycles in ordered mode
  extraKeywordsOrder   String[]                        # ordered subset of extraKeywords
  createdById          String?
  jobs                 ScrapingJob[]
  leads                Lead[]
}
```

### AppSettings (singleton)
```prisma
model AppSettings {
  id                         String   @id @default("singleton")
  companyName                String   @default("DataForge")
  scrapingDefaultMaxLeads    Int      @default(50)
  scrapingDefaultInterval    Int      @default(1440)
  scrapingGlobalPause        Boolean  @default(false)
  leadQualityGoodThreshold   Int      @default(70)
  leadQualityMediumThreshold Int      @default(40)
  ghlWebhookUrl              String?                    # GoHighLevel webhook URL
  updatedAt                  DateTime @updatedAt
}
```
Always access via `getSettings()` in `lib/settings/service.ts` — uses `upsert` to auto-create singleton on first call.

### DbNotification
```prisma
model DbNotification {
  id        String    @id @default(uuid())
  userId    String
  type      NotifType                    # success | info | warning | error
  title     String
  message   String?
  link      String?
  read      Boolean   @default(false)
  createdAt DateTime  @default(now())
}
```

---

## Lead Insert Pipeline

Every lead goes through `lib/leads/service.ts → insertLead()`:

```
raw input
  → normalizePhone (digits only, min 7)
  → normalizeEmail (lowercase trim)
  → normalizeWebsite (strip protocol/www/path → root domain)
  → checkDuplicate (phone OR email OR website)
      ├── DUPLICATE → merge industriesFoundIn, recalculate score (monotonic), return {status:"duplicate"}
      └── NEW → calculateDataQualityScore, prisma.lead.create, return {status:"created"}
```

**Score is monotonic** — `Math.max(existing, new)` — never decreases on duplicate merge.

---

## Auto Keyword Scraper Pipeline

```
Cron/manual trigger
  → /api/scraping/cron  or  /api/keywords/[id]/run
  → processKeywordJob() in lib/scraping/jobs/processor.ts
      → pickSearchTerm(kw) — builds search query:
          random mode:  keyword + N random extraKeywords (N between min–max)
          ordered mode: keyword + extraKeywordsOrder[extraKeywordsIndex % len]
      → scrapeGoogleMapsHeadless(query, location, maxLeads)
          → Playwright stealth browser on Google Maps
          → aria-label scoped panel extraction (no cross-business data bleed)
          → strips leading icon chars from address innerText
      → insertLead() for each result (dedup, score, save)
      → onKeywordJobSuccess → increments extraKeywordsIndex, sets nextRunAt
      → notifyKeywordSuccess → DbNotification for creator + boss/admin (excludeUserId dedup)
```

**Failure handling:** `onKeywordJobFailure` increments `failedAttempts`. At 5 failures the keyword is disabled and a notification is sent.

---

## Keyword Leads Modal (Viewing Scraped Leads)

**File:** `src/components/scraping/KeywordLeadsModal.tsx`

- Fetches from `/api/keywords/[id]/leads` — **only returns leads with `folderId: null`** (unfiled)
- Supports `pageSize` param (default 20, max 10000) — used by "Save all" to fetch every unfiled lead
- "Save to folder" calls `moveLeadsToFolderAction` → sets `folderId` → leads disappear from this view
- After move: calls `onLeadsDeleted(count)` to update the badge count on the keyword card
- `_count.leads` on `ScrapingKeyword` is filtered `where: { folderId: null }` — shows only unfiled

---

## Extra Keywords — Pick Per Run

**Random mode slider:** dual-handle range from 0–40 (hardcoded max, NOT dynamic).
Each run picks a random count between min–max, then shuffles and slices `extraKeywords`.

**Ordered mode:** user selects keywords as pills in a specific order. Each run uses `extraKeywords Order[extraKeywordsIndex % len]`. Index is incremented by `onKeywordJobSuccess`.

---

## Folder / Industry Hierarchy

```
Industry (name, color)
  └── Folder (name, color, industryId?)
        └── Lead (folderId?)
```

- Lead → Folder → Industry is the color chain used for the globe dots
- A folder can exist without an industry (unfiled folder)
- A lead can exist without a folder (unfiled lead)

---

## Leads Globe

**Files:** `src/components/leads/LeadsGlobe.tsx` (SSR wrapper) + `LeadsGlobeInner.tsx` (client)
**Data:** `src/lib/leads/locations.ts → getLeadLocations()`

- Dots colored by `Lead → Folder → Industry.color` (white if no folder/industry)
- Groups points by `lat/long + industryId` — one dot per industry per location
- World countries layer (`worldLow`) excludes US; US rendered separately with `usaLow` (state borders visible)
- Scroll zoom: manual wheel listener (`wheelY: "none"`) — always zooms toward center, not cursor
- 30s inactivity reset: animates `rotationX`, `rotationY` → 0 and `zoomLevel` → 1, then restarts auto-rotation from 0°
- Boss/admin only (checked in `leads/page.tsx`)

---

## Notification System (Dual Layer)

### 1. In-Memory (client-side toasts)
`src/lib/notifications.tsx` — `useNotifications()` hook → fires Sonner toast + updates bell dropdown

### 2. Persistent (DB)
`src/lib/notifications/service.ts`
```ts
createNotification({ userId, type, title, message, link })
createNotificationsForRole(roles[], data, excludeUserId?)  // excludeUserId prevents duplicate for creator
```
- Stored in `DbNotification` table
- Bell icon in `TopNav` shows unread count; clicking marks as read

---

## Settings Page (Boss Only)

**Route:** `/settings` — redirects non-boss to `/unauthorized`
**Files:**
- `src/app/(app)/settings/page.tsx` — server component, loads settings
- `src/app/(app)/settings/SettingsClient.tsx` — form with cards
- `src/actions/settings.actions.ts` — `updateSettingsAction`
- `src/lib/settings/service.ts` — `getSettings`, `updateSettings`

**Sections:** General (company name) · Scraping (max leads, interval, global pause) · Lead Quality (score thresholds) · Integrations (GHL webhook URL)

---

## RBAC

**Roles:** `boss` | `admin` | `sales_rep` | `lead_data_analyst` | `lead_specialist`

| Role | Access |
|------|--------|
| boss | Everything + Settings page |
| admin | Everything except Settings |
| lead_data_analyst | Leads + Scraping + Workspace |
| lead_specialist | Leads + Scraping + Workspace |
| sales_rep | Marketing + Workspace |

Guards in `src/lib/rbac/guards.ts`: `requireRole(...roles)`, `requireDepartment(dept)`, `getSessionRole()`.
Middleware (`src/auth.config.ts`) only enforces authentication. Role checks happen in server components/actions.
Logged-in users are redirected away from `/`, `/sign-in`, `/sign-up` → `/dashboard`.

---

## Server Actions Pattern

```
components → actions/*.ts ("use server") → lib/*/service.ts → prisma → Neon DB
```

API routes (`src/app/api/`) used for:
- SSE streams (scraping progress)
- Polling endpoints (job status, keyword leads)
- Cron trigger (`/api/scraping/cron` — public, secret-protected)

---

## Key File Locations

| What | Where |
|------|-------|
| DB schema | `prisma/schema.prisma` |
| Generated Prisma client | `src/generated/prisma/` |
| Global CSS + CSS vars | `src/app/globals.css` |
| App shell layout | `src/app/(app)/layout.tsx` |
| Sidebar nav (role-based) | `src/components/SidebarNav.tsx` |
| Top nav (bell icon) | `src/components/TopNav.tsx` |
| Leads main page | `src/app/(app)/leads/page.tsx` |
| Scraping page | `src/app/(app)/scraping/page.tsx` |
| Auto Keywords tab | `src/app/(app)/scraping/keywords/page.tsx` |
| Keywords manager | `src/components/scraping/KeywordsManager.tsx` |
| Keyword leads modal | `src/components/scraping/KeywordLeadsModal.tsx` |
| Keyword history modal | `src/components/scraping/KeywordHistoryModal.tsx` |
| Dashboard page | `src/app/(app)/dashboard/page.tsx` |
| Settings page | `src/app/(app)/settings/page.tsx` |
| Admin users page | `src/app/(app)/admin/users/page.tsx` |
| Leads globe | `src/components/leads/LeadsGlobeInner.tsx` |
| Folder picker modal | `src/components/shared/FolderPickerModal.tsx` |
| Maps scraper | `src/lib/scraping/google/maps-scraper.ts` |
| Job processor | `src/lib/scraping/jobs/processor.ts` |
| Keyword leads API | `src/app/api/keywords/[id]/leads/route.ts` |
| Cron API | `src/app/api/scraping/cron/route.ts` |

---

## Environment Variables

```
DATABASE_URL              # Neon direct connection (dev)
POSTGRES_PRISMA_URL       # Neon pooler connection (preferred for prod)
NEXTAUTH_SECRET           # NextAuth signing secret
NEXTAUTH_URL              # App base URL
SERPAPI_API_KEY           # SerpAPI key (legacy — Maps scraper now uses Playwright)
```

---

## Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| "unknown argument X" on insert | Stale Prisma singleton after schema change | Bump `CLIENT_VERSION` in `src/lib/prisma.ts` |
| Globe dots all white | Lead has no folder, or folder has no industry | Expected — white = unfiled/uncategorized |
| Keyword lead count not updating | `_count.leads` counts ALL leads | Already filtered `where: { folderId: null }` |
| Only 20 leads saved from keyword | API `pageSize` default is 20 | Pass `pageSize=10000` in fetch URL |
| Duplicate toast notifications | `applyJobResult` called from multiple places | `completedToastRef` Set guards dedup |
| Duplicate DB notifications for boss/admin | Creator gets individual + role broadcast | Pass `kw.createdById` as `excludeUserId` to `createNotificationsForRole` |
| Globe off-center after zoom | `wheelY: "zoom"` zooms toward cursor | Manual wheel handler only changes `zoomLevel` |
| Dashboard/leads timeout | Neon cold start on free tier | Retry page; use pooler URL for prod |
