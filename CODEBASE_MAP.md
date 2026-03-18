# DataForge — Codebase Map for AI Reference
> Use this file to recover context before editing anything significant.
> Last updated: 2026-03-18

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (Turbopack) |
| Language | TypeScript strict |
| Database | Neon PostgreSQL (serverless, free tier — sleeps after 5 min) |
| ORM | Prisma v7 TypeScript-first client (`@prisma/adapter-neon`) |
| Auth | NextAuth v5 (`auth()` server function) |
| UI primitives | shadcn/ui (Input, Button, Badge, Dialog, DropdownMenu…) |
| Dialog system | base-ui (`@base-ui-components/react`) — NOT Radix directly |
| Styling | Tailwind CSS v4 |
| Notifications/Toasts | Custom `NotificationProvider` + Sonner (`<Toaster />`) |
| Scraping sources | SerpAPI (Google Maps) + Playwright (stealth browser) + Axios/Cheerio |

---

## Critical: Prisma Singleton Pattern

**File:** `src/lib/prisma.ts`

```ts
const CLIENT_VERSION = "v4-lead-address"; // ← MUST BUMP after every prisma migrate

function createPrismaClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL!;
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// Busts the singleton in dev hot-reload when CLIENT_VERSION changes
if (global.__prismaVersion !== CLIENT_VERSION) {
  global.__prisma = undefined;
  global.__prismaVersion = CLIENT_VERSION;
}
```

**Why this matters:**
- After `prisma migrate` + `prisma generate`, the running dev server still holds the OLD client in `global.__prisma`
- If you add a field (e.g. `address`) and forget to bump `CLIENT_VERSION`, every insert with that field silently fails with "unknown argument"
- The fix is always: bump `CLIENT_VERSION` string → save → dev server hot-reloads with fresh client

**After any schema change:**
1. Edit `prisma/schema.prisma`
2. Create migration file in `prisma/migrations/`
3. Run `prisma migrate deploy`
4. Run `prisma generate`
5. **Bump `CLIENT_VERSION`** in `prisma.ts`

---

## Lib Folder Structure

```
src/lib/
├── prisma.ts                     # DB singleton (see above)
├── auth.ts                       # NextAuth config
├── notifications.tsx             # Client-side NotificationProvider context
├── utils/
│   ├── normalize.ts              # normalizePhone, normalizeEmail, normalizeWebsite, formatPhone
│   ├── dedup.ts                  # checkDuplicate — matches on phone/email/website
│   └── scoring.ts                # calculateDataQualityScore (0–100)
├── leads/service.ts              # insertLead, updateLead, getLeads
├── folders/service.ts            # getFolders, createFolder, deleteFolder, updateFolderIndustry
├── industry/service.ts           # getIndustries, getFoldersByIndustry, createIndustry
├── dashboard/service.ts          # getDashboardStats (aggregates, charts data)
└── scraping/
    ├── jobs/service.ts           # createJob, getJobs, getJobById, updateJobStatus, incrementJobMetric
    ├── google/discovery.ts       # discoverBusinesses via SerpAPI Google Maps
    └── crawler/
        ├── core.ts               # Browser automation: createBrowserContext, fetchPage, RateLimiter,
        │                         #   humanScroll, humanMouseMove, parseLead, extractContacts, SSE utils
        ├── parser.ts             # Shared: fetchHtml, parsePage, extractInternalLinks (Axios+Cheerio)
        ├── web-crawler.ts        # crawlWebsite — BFS up to 20 pages, full contact extraction
        └── web-scraper.ts        # scrapeWebsite — legacy fast 3-page (home/contact/about)
```

---

## Lead Insert Pipeline

Every lead goes through this in `lib/leads/service.ts → insertLead()`:

```
raw input
  → normalizePhone (digits only, min 7)
  → normalizeEmail (lowercase trim)
  → normalizeWebsite (strip protocol/www/path → root domain)
  → checkDuplicate (matches existing by phone OR email OR website)
      ├── DUPLICATE → merge industriesFoundIn, recalculate score (monotonic — only increases), return {status:"duplicate"}
      └── NEW → calculateDataQualityScore, prisma.lead.create, return {status:"created"}
```

**Score is monotonic** — `Math.max(existing.dataQualityScore, newScore)` — it never goes down.

**Dedup logic** (`lib/utils/dedup.ts`): checks DB for any lead where `phone = X OR email = X OR website = X`.

---

## Scraping Pipeline (Two Modes)

### Mode 1 — Domain Scrape (manual, single site)
`POST /api/scraping/stream` → SSE stream
- Uses `lib/scraping/crawler/core.ts → parseLead()` with Playwright stealth browser
- Streams results back to `components/scraping/DomainScrapeForm.tsx` via EventSource

### Mode 2 — Google Maps Batch Job
`POST /api/scraping/google-stream` → SSE stream
1. `discoverBusinesses(industry, location)` → SerpAPI → list of businesses with address/phone/website
2. For each business with a website → `scrapeWebsite()` (fast 3-page Axios scrape)
3. Each discovered lead streamed back to client
- Managed via `ScrapingJob` DB record (status: pending→running→completed/failed)

### Saving Scraped Leads
`actions/domain-scrape.actions.ts → saveLeadsAction(leads, folderId)`
- Calls `insertLead` for each lead
- Returns `{ saved, duplicates, failed }` counts
- Duplicate leads are silently skipped (not an error)

---

## Data Fields (Lead Model)

```prisma
model Lead {
  id                String    @id @default(cuid())
  businessName      String
  phone             String    # stored as digits only e.g. "18005551234"
  email             String?
  website           String?   # stored as root domain e.g. "example.com"
  contactPerson     String?
  address           String?
  city              String?
  state             String?
  country           String?
  category          String?
  source            String    # e.g. "crawl:https://..."
  industriesFoundIn String[]  # array of industry names
  dataQualityScore  Int       @default(0)  # 0–100
  duplicateFlag     Boolean   @default(false)
  recordStatus      String    @default("active")  # active | flagged | invalid
  dateCollected     DateTime  @default(now())
  folderId          String?
  # relations: folder, user
}
```

**Phone display:** `formatPhone()` in `lib/utils/normalize.ts`
- 10 digits → `(XXX) XXX-XXXX`
- 11 digits starting with 1 → `+1 (XXX) XXX-XXXX`
- Raw digits still stored in DB; formatted only for display

---

## Folder / Industry Hierarchy

```
Industry (color, name)
  └── Folder (color, name, industryId?)
        └── Lead (folderId?)
```

- A folder can exist without an industry (uncategorized)
- A lead can exist without a folder (unfiled)
- `IndustryBoard` → click industry → `IndustryModal` (shows folders in that industry)
- `IndustryModal` → click folder → `FolderLeadsModal` (shows leads in that folder)
- Breadcrumb pattern: `All Categories › [Industry] › [Folder]`

---

## Notification System

**File:** `src/lib/notifications.tsx`

```ts
// Usage anywhere in client components:
const { addNotification } = useNotifications();
addNotification({ title: "Leads Saved", message: "12 leads saved", type: "success" });
// types: "success" | "error" | "warning" | "info"
```

- `NotificationProvider` wraps the app in `src/components/providers.tsx`
- Bell icon in `TopNav` shows unread count badge
- Click bell → dropdown panel with read/unread list
- Each `addNotification` call also fires a Sonner toast (colored border: green/red/amber/blue)
- `<Toaster />` is mounted in `app/layout.tsx`

---

## base-ui Dialog Pattern

The app uses `@base-ui-components/react` for dialogs, NOT Radix `Dialog` directly.
The shadcn `dialog.tsx` wraps base-ui.

**Important:** base-ui uses `render={<Button />}` prop pattern, not Radix `asChild`.

Popups are conditionally rendered (not always-mounted):
```tsx
// IndustryBoard.tsx pattern
{selected && (
  <IndustryModal
    industry={selected}
    open={!!selected}
    onOpenChange={(v) => { if (!v) setSelected(null); }}
  />
)}
```

---

## Server Actions Pattern

All data mutations go through `src/actions/*.ts` files marked `"use server"`.
Pages call actions directly — no API routes needed for mutations.

```
components → actions/*.ts → lib/*/service.ts → prisma → Neon DB
```

API routes (`src/app/api/`) are only used for:
- SSE streams (scraping progress)
- REST endpoints consumed externally

---

## Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Leads not saving to folders | Stale Prisma singleton after schema change | Bump `CLIENT_VERSION` in `prisma.ts` |
| "unknown argument X" error | Old Prisma client in memory | Bump `CLIENT_VERSION` |
| Dashboard/leads timeout | Neon free tier cold start (sleeps after 5 min) | Retry page; use pooler URL for production |
| Toast not showing | `<Toaster />` missing | It's in `app/layout.tsx` — don't remove it |
| `??` and `\|\|` mixed TS error (TS5076) | Operator precedence ambiguity | Add parentheses around the `\|\|` operand |
| Dialog not opening | `selected` is null when `open={!!selected}` | Ensure state is set before open flag |

---

## Environment Variables

```
DATABASE_URL         # Neon direct connection (dev)
POSTGRES_PRISMA_URL  # Neon pooler connection (preferred for prod — no cold starts)
NEXTAUTH_SECRET      # NextAuth signing secret
NEXTAUTH_URL         # App base URL
SERPAPI_API_KEY      # SerpAPI key for Google Maps discovery
```

---

## Key File Locations at a Glance

| What | Where |
|------|-------|
| DB schema | `prisma/schema.prisma` |
| DB migrations | `prisma/migrations/` |
| Generated Prisma client | `src/generated/prisma/` |
| Global CSS + CSS vars | `src/app/globals.css` |
| Tailwind config | `tailwind.config.ts` |
| Path aliases | `tsconfig.json` (`@/` = `src/`) |
| App shell layout | `src/app/(app)/layout.tsx` |
| Sidebar nav | `src/components/SidebarNav.tsx` |
| Top nav (bell icon) | `src/components/TopNav.tsx` |
| Leads main page | `src/app/(app)/leads/page.tsx` |
| Scraping page | `src/app/(app)/scraping/page.tsx` |
| Dashboard page | `src/app/(app)/dashboard/page.tsx` |
