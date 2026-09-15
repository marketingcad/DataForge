# GHL Integration — As-Built Reference

> **Status: SHIPPED.** Built 2026-04-06 → 2026-07-02 across ~48 commits; imported into
> `dataforge-app-lite` wholesale in `c410db6` (2026-08-21).
> Last verified against the code: 2026-09-15.
>
> This file used to be a build plan dated 2026-04-02 that read *"Status: PLANNING — not
> started."* It stayed that way for five months while the integration was built, and it
> was built **differently than planned**. What follows describes the code that exists.
> The original plan is recoverable from git (`79a7609`); §7 records where reality diverged
> so nobody re-derives the differences from scratch.

---

## 1. The one thing to know first

**Calls arrive by webhook, not by polling.** The original plan called for an hourly cron
that pulled call logs from the GHL API. That was built, then **deliberately reverted** in
`cb76a5c` (*"revert: remove GHL auto-sync cron and AutoRefresh"*), and `9c05876` made it
explicit: *"calls now come from webhook only."*

`vercel.json` has exactly one cron — `/api/scraping/cron` — and it contains **no GHL call**.
If you are looking for the scheduled GHL sync, it does not exist. Opportunities,
appointments and booked contacts sync **on demand** via a server action; calls arrive in
real time via webhook endpoints.

Two leftover comments in the code say so at the point of confusion:

- `src/app/api/ghl/inbound-call/route.ts:96`
- `src/app/api/ghl/outbound-call/route.ts:199`

---

## 2. Configuration — all in `AppSettings`, none in env

Entered through the Settings page, stored in the database. **Never in a committed file (C9).**

| Field | Purpose |
|---|---|
| `ghlApiKey` | Agency-level private integration key |
| `ghlSubAccountApiKey` | Sub-account key (separate scope from the above) |
| `ghlLocationId` | GHL sub-account / location ID |
| `ghlWebhookUrl` | Inbound-webhook trigger URL for pushing leads **to** GHL |
| `ghlInboundSecret` | Shared secret for authenticating inbound webhooks |
| `ghlCallsLastSyncedAt` | Incremental cursor — calls |
| `ghlOppsLastSyncedAt` | Incremental cursor — opportunities |
| `ghlAppsLastSyncedAt` | Incremental cursor — appointments |
| `webhookLastPayload` / `webhookLastOutcome` | Last inbound payload + result, for debugging |
| `timezone` | IANA zone aligning DataForge's day/week/month boundaries with GHL |

> **C9 — `ghlWebhookUrl` is a credential.** It is a live trigger endpoint. It belongs in
> `AppSettings`, never in a doc, commit, or transcript. A populated copy of it was committed
> to this file in `91a67fa` and is still in public git history; see §8.

---

## 3. Data model

Three dedicated models, plus GHL keys on existing ones.

| Model | Key | Notes |
|---|---|---|
| `GhlOpportunity` | `ghlId @unique` | `status` (open/won/lost/abandoned), `monetaryValue`, optional `leadId` |
| `GhlAppointment` | `ghlId @unique` | GHL calendar event; `startTime`/`endTime`, `status`, `calendarId` |
| `GhlBookedContact` | `ghlId @unique` | Contacts tagged `appointment-booked`, attributed to contact owner |

Fields on existing models:

| Model | Field | Purpose |
|---|---|---|
| `User` | `ghlUserId String? @unique` | **Agent mapping lives here** — there is no join table |
| `Lead` | `ghlContactId String?` | Set once a lead is migrated to GHL |
| `CallLog` | `ghlMessageId String? @unique` | Dedup key for synced calls |

Every `Ghl*` model cascades from `User` on delete and sets `leadId` null on lead delete —
consistent with **C5** (a lead merge must reassign children, never orphan them).

---

## 4. Code layout

### `src/lib/ghl/` — 4 modules, ~1,080 lines

| File | Lines | Contents |
|---|---|---|
| `client.ts` | 572 | All GHL API access: contacts, conversations, calls, agents, opportunities, calendars, appointments, tag queries |
| `sync.ts` | 358 | `autoSyncGhlCalls`, `autoSyncGhlAppointments`, `autoSyncGhlOpportunities`, `autoSyncGhlBookedContacts` |
| `mapping.ts` | 88 | `mapLeadToGhl` — DataForge Lead → GHL contact payload |
| `match-rep.ts` | 60 | `matchRepByName` — scored fuzzy matching of a GHL rep name to a DataForge user |

`match-rep.ts` exists because GHL sends a **rep name string**, not an ID, on webhook
payloads. Its matching rules were tuned over five commits (`6a7249b`, `018397c`, `9cd8103`,
`35b3ad8`, `4cc6173`) against real payloads: first-name match beats last-name beats
substring, and social-media source prefixes are stripped first. Treat it as load-bearing —
the scoring order is the product of observed failures, not taste.

### API routes — 14

**Production** (`src/app/api/ghl/`): `inbound-call`, `outbound-call`, `sync-calls`,
`migrate-lead`, `unmark-lead`, `agents`, `webhook-status`

**Webhooks** (`src/app/api/webhooks/`): `ghl-lead`, `ghl-appointment`

**Debug** (`src/app/api/ghl/`): `debug-appointments`, `debug-contacts`, `debug-messages`,
`debug-outbound-call`, `debug-sync`

### Server action

`src/actions/ghl-sync.actions.ts` — runs opportunities, appointments and booked contacts
concurrently. **Calls are not in it** (see §1).

### UI

| Component | Where |
|---|---|
| `GhlLeadButton.tsx` | Push a single lead to GHL from the lead detail page |
| `GhlMigrationModal.tsx` | Bulk lead migration |
| `SyncGhlButton.tsx` / `SyncGhlCallsButton.tsx` | Manual sync triggers (marketing) |
| `ImportGhlDialog.tsx` | Admin — import users from GHL |
| `SalesLeaderboard.tsx`, `LeaderboardSection.tsx`, `LeaderboardClientWrapper.tsx` | Leaderboard fed by GHL data |

---

## 5. Data flow

```
Real time  ── GHL automation fires ──▶ /api/webhooks/ghl-lead
                                       /api/webhooks/ghl-appointment
                                       /api/ghl/inbound-call
                                       /api/ghl/outbound-call
                                          │
                                          ├─ matchRepByName() → User
                                          └─ CallLog / GhlAppointment row

On demand  ── SyncGhlButton ──▶ ghl-sync.actions.ts
                                  ├─ autoSyncGhlOpportunities()
                                  ├─ autoSyncGhlAppointments()
                                  └─ autoSyncGhlBookedContacts()
                                       (each reads its own ghl*LastSyncedAt cursor)

On demand  ── SyncGhlCallsButton ──▶ /api/ghl/sync-calls → autoSyncGhlCalls()
                                       (batched pagination, cursor resume, full re-sync option)

Read       ── Leaderboard / Reports ──▶ GhlOpportunity, GhlAppointment,
                                        GhlBookedContact, CallLog
```

---

## 6. Egress notes (C1-adjacent)

The GHL sync path has already been tuned once for data transfer, **four months before** the
August egress incident: `dee5dc2` — *"reduce DB data transfer — 1hr sync cooldown, drop full
leads scan, fire-and-forget sync."*

That commit removed a full-table leads scan from the sync path. It is the same failure mode
**C1** was written about. If you touch `sync.ts`, do not reintroduce a scan over all leads;
count the round trips first (§4 of CLAUDE.md).

`c92e79d` later added batched pagination and cursor resume to the calls sync for the same
reason.

---

## 7. Where it diverged from the 2026-04 plan

Recorded so the differences are not re-derived. **Left column is obsolete.**

| Plan said | What was built |
|---|---|
| `GhlUserMap` join table | Dropped — `User.ghlUserId @unique` |
| One `ghlLastSyncAt` | Three cursors: calls / opps / appts |
| `CallLog.ghlCallId` | `CallLog.ghlMessageId` |
| Separate `users.ts`, `calls.ts` | Folded into `client.ts` |
| `src/lib/calls/service.ts` | Never created; leaderboard logic sits in `src/components/marketing/` |
| `src/actions/ghl.actions.ts` | `src/actions/ghl-sync.actions.ts` |
| `/api/ghl/test` | `/api/ghl/webhook-status` |
| **Hourly cron calls `syncGhlCalls()`** | **Reverted — webhooks instead** (§1) |
| Scope: calls only | Also opportunities, appointments, booked contacts, lead migration, reports |

---

## 8. Open item

**The webhook trigger URL is burned.** A fully populated copy sat at `GHL_SYNC_PLAN.md:22`
from `91a67fa` until it was redacted in the working tree on 2026-09-15. Redaction does not
reach history, and `github.com/marketingcad/DataForge` is **public**.

→ Rotate the trigger in GHL. Treat the old value as disclosed. This is tracked in
`STATE.md` under Escalations.

---

## 9. Reference

- Base URL: `https://services.leadconnectorhq.com`
- Auth: `Authorization: Bearer <ghlApiKey>`
- All requests require a `locationId` parameter
- Calls live in the Conversations API under type `TYPE_CALL`
- Pagination is cursor-based (`startAfter` / `nextPageCursor`)
- Rate limit: 100 requests / 10 s — the paginated fetches in `client.ts` space themselves accordingly
