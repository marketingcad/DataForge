# DataForge — API & Server Action Reference

> **Most mutations in DataForge are Server Actions, not HTTP endpoints.** Route handlers
> exist only for what actions cannot serve: webhooks, SSE streams, cron, file uploads, and
> callers that are not React (the desktop heartbeat, GoHighLevel).
>
> Auth model: middleware enforces *authentication* for everything outside the public-path
> list; *authorization* is enforced inside each handler and action via
> `src/lib/rbac/guards.ts`. See [`ARCHITECTURE.md` §5](ARCHITECTURE.md#5-authentication--authorization).

---

## 1. Public paths (no session required)

`/` · `/sign-in` · `/sign-up` · `/share/**` · `/api/auth/**` · `/api/health/**` ·
`/api/scraping/cron` · `/api/webhooks/**` · `/api/ghl/outbound-call` ·
`/api/ghl/inbound-call`

Everything else redirects to `/sign-in` without a session.

---

## 2. Auth

| Route | Methods | Notes |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth v5 handlers — credentials sign-in, session, CSRF. |

---

## 3. Health & presence

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health/db` | GET | public | Never-throwing DB reachability probe. `{ ok: true }` or 503 `{ ok: false }`. Backs the `DbReconnect` screen. |
| `/api/instances/heartbeat` | POST | session | Called ~every 8 s by every open instance. Upserts the `AppInstance` presence row **and returns any pending `RemoteCommand`s** for this `deviceId`, which the client executes locally. |
| `/api/instances/leave` | POST | session | Fired via `navigator.sendBeacon` on close. Deletes the presence row immediately instead of waiting out the ~30 s timeout. |

---

## 4. Leads

| Route | Methods | Purpose |
|---|---|---|
| `/api/leads` | GET, POST | List (filtered, paginated) and create. |
| `/api/leads/[id]` | GET, PATCH, DELETE | Single lead. **DELETE cascades `LeadCommission`** — prefer the merge flow (see [`DATA_MODEL.md` §4](DATA_MODEL.md#4-cascade-behaviour--read-before-deleting-a-lead)). |
| `/api/leads/search` | GET | Typeahead / quick search. |
| `/api/leads/locations` | GET | Globe coordinates. **On-demand only** — deliberately kept out of the Leads page payload. |
| `/api/leads/[id]/geocode` | POST | Geocode one lead. |
| `/api/leads/geocode-backfill` | POST | Batch-fill missing coordinates. |
| `/api/leads/[id]/regrab-email` | POST | Re-run the email grab for one lead. |
| `/api/leads/folders/[id]/regrab-emails` | POST | Queue an email re-grab job for a whole folder. |

---

## 5. Keywords

| Route | Methods | Purpose |
|---|---|---|
| `/api/keywords` | GET, POST | List (scoped by `KeywordAccess`) and create. |
| `/api/keywords/[id]` | GET, PATCH, DELETE | Read, update (including `enabled` / `autoRun`), delete. **Deleting a keyword cascades to its leads.** |
| `/api/keywords/[id]/run` | POST | Trigger one run now. |
| `/api/keywords/[id]/history` | GET | Past jobs for this keyword. |
| `/api/keywords/[id]/leads` | GET | Leads produced by this keyword. |
| `/api/keywords/[id]/regrab-emails` | POST | Queue an email re-grab job for the keyword's leads. |

---

## 6. Scraping

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/scraping/cron` | GET, POST | `Bearer $CRON_SECRET` **or** `x-vercel-cron: 1` | **The scheduler.** Reaps dead jobs, enforces the run-time guard, enqueues due keywords up to the concurrency cap, runs the batch under one shared browser via `waitUntil`. `maxDuration = 300`. |
| `/api/scraping/jobs` | GET, POST | session | List and create jobs. |
| `/api/scraping/jobs/[id]` | GET, PATCH | session | Job detail / update. |
| `/api/scraping/jobs/[id]/process` | POST | session | Process a job now (same code path as the cron). |
| `/api/scraping/jobs/[id]/cancel` | POST | session | Sets status to `paused`; the running job's 5-second poll picks it up and stops cleanly. |
| `/api/scraping/jobs/[id]/commit` | POST | session | Commit `pendingLeads` staged for manual review into real `Lead` rows. |
| `/api/scraping/stream` | GET | session | SSE — job progress. |
| `/api/scraping/google-stream` | GET | session | SSE — live Google Maps scrape output. |
| `/api/scraping/image` | POST | session | Extract leads from an uploaded image via the Anthropic vision API. |
| `/api/browser/page` | POST | session | Server-side page fetch for the domain-scrape flow. |

---

## 7. GoHighLevel

### Inbound (called by GHL)

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/webhooks/ghl-lead` | GET, POST | **unauthenticated** | GHL posts a lead; the rep is fuzzy-matched by name (`matchRepByName`) and the lead is stored with `source: "GHL"` tied to that rep via `savedById`. No rep match → skipped. Last payload/outcome recorded in `AppSettings` for debugging. |
| `/api/webhooks/ghl-appointment` | GET, POST | **unauthenticated** | Mirror of the above for appointments. |
| `/api/ghl/inbound-call` | POST | `AppSettings.ghlInboundSecret` when set | Inbound call events. Normalizes the many field-name variants GHL sends across automation versions. |
| `/api/ghl/outbound-call` | GET, POST | `Bearer` header **or** `?secret=`, checked against `AppSettings.ghlInboundSecret` | Outbound-call action trigger. GHL sends `call_`-prefixed custom values. |

> The two `/api/webhooks/**` routes are unauthenticated by design (GHL cannot send a
> secret on them). They are write-limited and idempotent-ish: `BookedAppointment` has
> `@@unique([clientPhone, bookedAt])` and `CallLog.ghlMessageId` is unique.

### Outbound (called by DataForge)

| Route | Methods | Purpose |
|---|---|---|
| `/api/ghl/agents` | GET | List GHL users mappable to DataForge users. |
| `/api/ghl/sync-calls` | POST | Pull calls since `AppSettings.ghlCallsLastSyncedAt`. |
| `/api/ghl/migrate-lead` | POST | Push a lead into GHL as a contact; sets `migratedToGhl` + `ghlContactId`. |
| `/api/ghl/unmark-lead` | POST | Undo the above. |
| `/api/ghl/webhook-status` | GET | Whether the GHL automation is actually firing, plus the last payload/outcome. |
| `/api/ghl/debug-appointments` \| `debug-contacts` \| `debug-messages` \| `debug-sync` \| `debug-outbound-call` | GET/POST | Diagnostic endpoints that walk each sync chain step by step. Useful first stop when a sync looks wrong. |

---

## 8. Uploads & misc

| Route | Method | Purpose |
|---|---|---|
| `/api/upload/badge` | POST | Converts to a base64 data URL stored directly in the DB — no storage dependency. |
| `/api/upload/document` | POST | Uploads to the Supabase Storage **`documents`** bucket. ⚠️ That bucket must exist in the project — it was not migrated in 2026-08 because it was empty. |
| `/api/forger/chat` | POST | Forger assistant. Key from `AppSettings.forgerApiKey`, else `ANTHROPIC_API_KEY`; refuses requests over `AppSettings.forgerMaxRequestTokens` before calling the API. |
| `/api/geo/city-populations` | GET | Population figures for a state's cities. The multi-MB dataset stays server-side. |

---

## 9. Server actions

`src/actions/*.actions.ts`, 30 files. Every one opens with a guard from
`src/lib/rbac/guards.ts` — `requireAuth()`, `requireRole(...)` or `requireDepartment(...)`.

| File | Representative actions |
|---|---|
| `leads.actions.ts` | create / update / delete / assign / bulk-move / CSV import / export |
| `folders.actions.ts`, `industry.actions.ts` | folder + category/subcategory CRUD |
| `duplicates.actions.ts` | list duplicate groups, `mergeDuplicates` (refuses double commissions) |
| `category-access.actions.ts`, `keyword-access.actions.ts` | grant/revoke scoped access |
| `scraping.actions.ts` | start/stop keywords, toggle `autoRun`, job control |
| `domain-scrape.actions.ts` | scrape a supplied domain list |
| `fleet.actions.ts` | list instances, queue `RemoteCommand`s to a device |
| `marketing.actions.ts`, `tasks.actions.ts`, `badges.actions.ts` | leaderboards, challenges, badges |
| `commissions.actions.ts`, `lead-commissions.actions.ts`, `rep-commissions.actions.ts` | rules, ledger, mark paid, confirm received |
| `appointments.actions.ts`, `balloons.actions.ts` | appointments; balloon pop/prizes/payouts/audit |
| `ghl-sync.actions.ts` | trigger the four `autoSyncGhl*` syncs |
| `chat.actions.ts`, `kanban.actions.ts`, `calendar.actions.ts`, `feedback.actions.ts` | collaboration |
| `documents.actions.ts` | notes and scripts, file attachments, share tokens |
| `notifications.actions.ts` | list, mark read |
| `reports.actions.ts` | agent report matrix, share token |
| `users.actions.ts`, `auth.actions.ts` | user CRUD, roles, bans, password |
| `settings.actions.ts` | the `AppSettings` singleton (boss only) |
| `forger.actions.ts` | conversation CRUD |

### Writing a new action

```ts
"use server";

import { requireDepartment } from "@/lib/rbac/guards";
import { updateTag } from "next/cache";
import { someService } from "@/lib/<domain>/service";

export async function doThingAction(input: Input) {
  const user = await requireDepartment("leads");   // 1. guard first, always
  const result = await someService(input, user.id); // 2. logic lives in the service
  updateTag("the-tag");                             // 3. Next 16: updateTag, not revalidateTag
  return result;
}
```

---

## 10. Real-time channels

| Channel | Transport | Availability |
|---|---|---|
| Notifications | Socket.io at `/api/socket`, personal room `user:<id>` | dev / `npm run start` / desktop — **not Vercel** |
| Job progress | SSE (`/api/scraping/stream`, `/api/scraping/google-stream`) | everywhere |
| Presence + remote commands | HTTP polling (`/api/instances/heartbeat`, ~8 s) | everywhere |
