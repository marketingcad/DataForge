import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import {
  autoSyncGhlCalls,
  autoSyncGhlAppointments,
  autoSyncGhlOpportunities,
  autoSyncGhlBookedContacts,
} from "@/lib/ghl/sync";

export const maxDuration = 300;

async function handleCron(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const validSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validVercel = vercelCron === "1";

  if (!validSecret && !validVercel) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run incrementally — uses ghlCallsLastSyncedAt as a since-filter, 5-page cap
  waitUntil(
    Promise.allSettled([
      autoSyncGhlCalls(false),
      autoSyncGhlAppointments(),
      autoSyncGhlOpportunities(),
      autoSyncGhlBookedContacts(),
    ]).then((results) => {
      const [calls] = results;
      if (calls.status === "fulfilled") {
        const c = calls.value;
        if (!c.noAgents) {
          console.log(`[ghl/cron] calls: +${c.synced} new, ${c.skipped} skipped, ${c.unmatched} unmatched`);
        }
      } else {
        console.error("[ghl/cron] calls sync failed:", calls.reason);
      }
    })
  );

  return NextResponse.json({ ok: true, triggered: new Date().toISOString() });
}

export const GET  = handleCron;
export const POST = handleCron;
