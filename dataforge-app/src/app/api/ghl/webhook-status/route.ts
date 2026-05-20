import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ghl/webhook-status
 *
 * Shows whether the GHL automation is actually firing and hitting DataForge.
 * Returns:
 *  - totalWebhookCalls   : all-time count of calls logged via webhook (not sync)
 *  - recentWebhookCalls  : last 10 webhook call log entries with agent name
 *  - lastReceived        : last raw payload + outcome stored by the outbound-call route
 *  - hint                : quick status summary
 */
export async function GET() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalWebhookCalls, recentWebhookCalls, settings] = await Promise.all([
    prisma.callLog.count({
      where: { notes: { in: ["GHL outbound webhook", "GHL webhook"] } },
    }),
    prisma.callLog.findMany({
      where: { notes: { in: ["GHL outbound webhook", "GHL webhook"] } },
      orderBy: { calledAt: "desc" },
      take: 10,
      select: {
        id: true,
        calledAt: true,
        direction: true,
        durationSecs: true,
        status: true,
        contactPhone: true,
        notes: true,
        agent: { select: { name: true, ghlUserId: true } },
      },
    }),
    prisma.appSettings.findUnique({
      where: { id: "singleton" },
      select: { webhookLastPayload: true, webhookLastOutcome: true },
    }),
  ]);

  const lastReceived = {
    outcome: settings?.webhookLastOutcome ?? "never received",
    payload: (() => {
      try { return settings?.webhookLastPayload ? JSON.parse(settings.webhookLastPayload) : null; }
      catch { return settings?.webhookLastPayload ?? null; }
    })(),
  };

  const isWorking = totalWebhookCalls > 0;
  const hint = isWorking
    ? `✅ Webhook is working — ${totalWebhookCalls} call${totalWebhookCalls !== 1 ? "s" : ""} logged via GHL automation.`
    : lastReceived.outcome !== "never received"
    ? `⚠️ Webhook is receiving payloads but no calls have been written yet. Check lastReceived.outcome for details.`
    : `❌ Webhook has never received a payload from GHL. Make sure the automation is published and a real call was made.`;

  return NextResponse.json({
    hint,
    totalWebhookCalls,
    recentWebhookCalls,
    lastReceived,
  });
}
