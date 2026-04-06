# GHL Call Sync — Build Plan
> Status: PLANNING — not started
> Last updated: 2026-04-02

---

## Decisions Locked

| # | Question | Decision |
|---|---|---|
| 1 | API key storage | Saved to `AppSettings` in DB, entered via Settings page |
| 2 | Sync frequency | Every hour via existing cron job |
| 3 | Historical data | Full sync on first run, incremental (since last sync) after |
| 4 | Agent email match | Emails do NOT match — manual mapping required |
| 5 | Call direction | Both inbound + outbound |

---

## Webhook (already confirmed)

```
POST https://services.leadconnectorhq.com/hooks/cgAQMEZGL1qQIq1fJXJ3/webhook-trigger/222fab2b-9747-423d-a293-5135f9feb96b
```
- Returns `{"status":"Success: test request received"}` HTTP 200
- Used for **pushing leads TO GHL** (one-way)
- Cannot query existing contacts — needs API key for that

---

## Still Need From User

- [ ] GHL API key (private integration key from GHL Settings)
- [ ] GHL Location ID (sub-account ID)

---

## Build Order

---

### Step 1 — Schema Changes

**File:** `prisma/schema.prisma`

```prisma
// Add to AppSettings:
ghlApiKey       String?       // GHL private API key
ghlLocationId   String?       // GHL sub-account/location ID
ghlLastSyncAt   DateTime?     // tracks last sync for incremental

// Add to CallLog:
ghlCallId       String? @unique   // dedup key — prevents re-inserting same call

// New model:
model GhlUserMap {
  id              String   @id @default(uuid())
  dataforgeUserId String   @unique
  ghlUserId       String   @unique
  ghlUserName     String?
  ghlUserEmail    String?
  user            User     @relation(fields: [dataforgeUserId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  @@index([ghlUserId])
}

// Add to User model:
ghlUserMap      GhlUserMap?
```

After schema changes:
```bash
npx prisma db push --accept-data-loss
npx prisma generate
# Bump CLIENT_VERSION in src/lib/prisma.ts
```

---

### Step 2 — GHL API Client Layer

**New files in `src/lib/ghl/`:**

#### `client.ts`
```ts
// Fetch wrapper — injects Authorization: Bearer <ghlApiKey>
// Base URL: https://services.leadconnectorhq.com
export async function ghlFetch(path: string, options?: RequestInit)
```

#### `users.ts`
```ts
// GET /users?locationId=XXX
// Returns list of GHL agents (id, name, email, role)
export async function fetchGhlUsers(apiKey: string, locationId: string): Promise<GhlUser[]>

type GhlUser = {
  id: string
  name: string
  email: string
  role: string
}
```

#### `calls.ts`
```ts
// GET /conversations/search?type=TYPE_CALL&locationId=XXX&startAfter=<timestamp>
// Paginates through all results
// since = undefined → full historical sync
// since = Date     → incremental sync from that date
export async function fetchGhlCalls(
  apiKey: string,
  locationId: string,
  since?: Date
): Promise<GhlCall[]>

type GhlCall = {
  id: string          // → ghlCallId (dedup key)
  userId: string      // → look up in GhlUserMap
  direction: "inbound" | "outbound"
  status: "completed" | "missed" | "voicemail" | "no_answer"
  durationSecs: number
  calledAt: string    // ISO timestamp
  contactName?: string
  contactPhone?: string
}
```

#### `mapping.ts` *(already exists)*
```
DataForge Lead → GHL Contact field mapping (confirmed working)
```

#### `sync.ts`
```ts
// Main sync engine
export async function syncGhlCalls(): Promise<{
  inserted: number
  skipped: number   // already exists (dedup)
  unmapped: number  // no GhlUserMap entry for this agent
  errors: number
}>

// Logic:
// 1. Load ghlApiKey, ghlLocationId, ghlLastSyncAt from AppSettings
// 2. ghlLastSyncAt === null → full historical sync
//    ghlLastSyncAt !== null → incremental (since last sync)
// 3. fetchGhlCalls(apiKey, locationId, since)
// 4. For each call:
//    a. Look up call.userId in GhlUserMap → get dataforgeUserId
//    b. Skip if no mapping (unmapped++)
//    c. Skip if CallLog with ghlCallId exists (skipped++)
//    d. prisma.callLog.create({ agentId, direction, status, durationSecs, calledAt, ghlCallId })
// 5. Update AppSettings.ghlLastSyncAt = new Date()
// 6. Return counts
```

---

### Step 3 — Settings Page Updates

**File:** `src/app/(app)/settings/SettingsClient.tsx`

Add two new cards:

#### Card: GHL Connection
```
- GHL API Key       [password input — masked]
- GHL Location ID   [text input]
- [Test Connection] button → hits /api/ghl/test to verify key is valid
- Shows: "Connected ✓" / "Invalid key ✗"
```

#### Card: Agent Mapping
```
- [Fetch GHL Agents] button → calls fetchGhlUsers() and shows table
- Table rows: GHL agent name/email | → | DataForge user dropdown
- [Save Mapping] saves to GhlUserMap table
- Auto-matches by email where possible
- Unmapped agents shown in red
```

**New server action:** `src/actions/ghl.actions.ts`
```ts
saveGhlSettingsAction(formData)    // saves apiKey + locationId to AppSettings
saveAgentMappingAction(mappings)   // upserts GhlUserMap rows
triggerManualSyncAction()          // runs syncGhlCalls() on demand
testGhlConnectionAction(apiKey, locationId) // verifies key is valid
```

---

### Step 4 — Cron Integration

**File:** `src/app/api/scraping/cron/route.ts`

Add to existing cron handler:
```ts
import { syncGhlCalls } from "@/lib/ghl/sync";

// Inside cron handler (runs every hour):
if (settings.ghlApiKey && settings.ghlLocationId) {
  await syncGhlCalls().catch(console.error);
}
```

---

### Step 5 — Leaderboard

**New files:**

#### `src/lib/calls/service.ts`
```ts
type CallPeriod = "today" | "week" | "month" | "all"

type AgentCallStats = {
  userId: string
  userName: string
  avatar?: string
  callsInPeriod: number
  totalCalls: number
  avgDurationSecs: number
  longestCallSecs: number
  connectRate: number           // completed / total * 100
  breakdown: {
    completed: number
    missed: number
    voicemail: number
    no_answer: number
  }
}

getLeaderboard(period: CallPeriod): Promise<AgentCallStats[]>
getAgentStats(userId: string, period: CallPeriod): Promise<AgentCallStats>
```

#### `src/app/(app)/marketing/leaderboard/page.tsx`
- Boss + admin access only
- Period filter: Today / This week / This month / All time
- Sortable by: most calls, avg duration, connect rate

#### `src/components/marketing/AgentLeaderboard.tsx`
```
Rank  Agent         Calls  Avg Duration  Connect Rate
─────────────────────────────────────────────────────
 🥇1  Maria Santos    8       4m 12s         78%
 🥈2  Jake Rivera     6       3m 45s         65%
 🥉3  Ana Cruz        5       5m 01s         82%
```

#### Sales rep self-view
Add stats card to `/marketing/profile`:
- My calls today / this week
- My avg duration
- My rank

---

### Step 6 — Dashboard Updates

**File:** `src/lib/dashboard/service.ts`

Update `getDashboardStats()` to pull real call data from `CallLog` instead of mock/manual data.

---

## Full Data Flow

```
Every hour (cron)
  → syncGhlCalls()
      → GHL API fetchGhlCalls(since: ghlLastSyncAt)
      → GhlUserMap lookup → resolve dataforgeUserId
      → CallLog.create (skip if ghlCallId already exists)
      → AppSettings.ghlLastSyncAt = now()

Dashboard / Leaderboard (on page load)
  → getLeaderboard(period) from CallLog
  → per-agent rankings, stats, connect rates

Marketing Tasks (existing)
  → TaskProgress.callCount fed by real CallLog data
  → Points + badges auto-awarded on milestones
```

---

## New Files Summary

| File | Purpose |
|---|---|
| `src/lib/ghl/client.ts` | GHL API fetch wrapper with auth |
| `src/lib/ghl/calls.ts` | Fetch call logs from GHL API |
| `src/lib/ghl/users.ts` | Fetch GHL agent list |
| `src/lib/ghl/sync.ts` | Full sync engine (historical + incremental) |
| `src/lib/calls/service.ts` | Leaderboard + per-agent stats queries |
| `src/actions/ghl.actions.ts` | Server actions for GHL settings + manual sync |
| `src/app/api/ghl/test/route.ts` | Test GHL connection endpoint |
| `src/app/(app)/marketing/leaderboard/page.tsx` | Leaderboard page |
| `src/components/marketing/AgentLeaderboard.tsx` | Leaderboard table component |

## Modified Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add ghlApiKey/ghlLocationId/ghlLastSyncAt to AppSettings, ghlCallId to CallLog, new GhlUserMap model |
| `src/lib/settings/service.ts` | Include new AppSettings fields |
| `src/actions/settings.actions.ts` | Handle new fields |
| `src/app/(app)/settings/SettingsClient.tsx` | GHL Connection + Agent Mapping cards |
| `src/app/api/scraping/cron/route.ts` | Add syncGhlCalls() call |
| `src/components/SidebarNav.tsx` | Add Leaderboard nav item |
| `src/lib/dashboard/service.ts` | Use real CallLog data |

---

## Notes

- GHL API base URL: `https://services.leadconnectorhq.com`
- Auth header: `Authorization: Bearer <ghlApiKey>`
- All requests require `locationId` param
- GHL call records live in the Conversations API under type `TYPE_CALL`
- Pagination: GHL uses cursor-based pagination (`startAfter` / `nextPageCursor`)
- Rate limit: 100 req/10s on GHL API — add delay between paginated fetches
