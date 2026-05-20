import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Debug endpoint for verifying the GHL outbound-call webhook.
 *
 * GET  /api/ghl/debug-outbound-call
 *   → Returns the 20 most recent outbound CallLog rows with agent name,
 *     so you can confirm records are arriving after triggering a GHL call.
 *
 * POST /api/ghl/debug-outbound-call  (body: { dryRun: true, ...call_* fields })
 *   → Parses a test payload exactly like the real webhook but does NOT write
 *     to the database. Returns what agent would be matched and what would be saved.
 *     Useful for verifying field mapping before going live.
 *
 * Both routes require boss or admin role.
 */

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  void req;

  const logs = await prisma.callLog.findMany({
    where: { direction: "outbound" },
    orderBy: { calledAt: "desc" },
    take: 20,
    select: {
      id: true,
      calledAt: true,
      direction: true,
      durationSecs: true,
      status: true,
      contactPhone: true,
      ghlMessageId: true,
      notes: true,
      agent: { select: { id: true, name: true, ghlUserId: true } },
      lead:  { select: { id: true, businessName: true } },
    },
  });

  // Count total outbound logs so caller knows how many are in the system
  const totalOutbound = await prisma.callLog.count({ where: { direction: "outbound" } });

  // Show all DataForge users with their ghlUserId so it's easy to spot unlinked agents
  const agents = await prisma.user.findMany({
    where: { role: { in: ["sales_rep", "team_lead"] } },
    select: { id: true, name: true, ghlUserId: true },
    orderBy: { name: "asc" },
  });

  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
    select: { webhookLastPayload: true, webhookLastOutcome: true },
  });

  return NextResponse.json({
    totalOutboundLogs: totalOutbound,
    recentLogs: logs,
    linkedAgents: agents,
    lastWebhookReceived: {
      outcome: settings?.webhookLastOutcome ?? "never received",
      payload: settings?.webhookLastPayload ? JSON.parse(settings.webhookLastPayload) : null,
    },
    hint: "To test: POST this endpoint with { dryRun: true, userId: '...', direction: 'outbound', callStatus: 'completed', callDuration: 60 }",
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const isDryRun = b.dryRun === true;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) =>
    typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) || 0 : 0;

  const ghlUserId  = str(b.call_user_id) ?? str(b.call_answered_by_user_id);
  const agentName  = str(b.call_user_name) ?? str(b.call_answered_by_user_name);
  const directionRaw = str(b.call_direction) ?? "outbound";
  const direction  = directionRaw.toLowerCase().includes("in") ? "inbound" : "outbound";
  const fromPhone  = str(b.call_from);
  const toPhone    = str(b.call_to);
  const contactPhone = direction === "outbound" ? toPhone : fromPhone;
  const startRaw   = b.call_start_time;
  const endRaw     = b.call_end_time;
  let durationSecs = num(b.call_duration);
  if (!durationSecs && startRaw && endRaw) {
    const ms = new Date(String(endRaw)).getTime() - new Date(String(startRaw)).getTime();
    if (ms > 0) durationSecs = Math.round(ms / 1000);
  }
  const statusRaw  = str(b.call_status) ?? "";
  const dedupKey   = ghlUserId && startRaw ? `ghl-out:${ghlUserId}:${String(startRaw)}` : null;

  // Resolve agent
  let agent: { id: string; name: string | null; ghlUserId: string | null } | null = null;
  let matchedBy = "";

  if (ghlUserId) {
    agent = await prisma.user.findUnique({
      where: { ghlUserId },
      select: { id: true, name: true, ghlUserId: true },
    });
    if (agent) matchedBy = "ghlUserId";
  }
  if (!agent && agentName) {
    agent = await prisma.user.findFirst({
      where: { name: { equals: agentName, mode: "insensitive" } },
      select: { id: true, name: true, ghlUserId: true },
    });
    if (agent) matchedBy = "name (fallback)";
  }

  // Resolve lead
  let lead: { id: string; businessName: string } | null = null;
  if (contactPhone) {
    lead = await prisma.lead.findFirst({
      where: { phone: contactPhone },
      select: { id: true, businessName: true },
    });
  }

  const parsed = {
    ghlUserId,
    agentName,
    direction,
    fromPhone,
    toPhone,
    contactPhone,
    durationSecs,
    statusRaw,
    dedupKey,
  };

  const resolution = {
    agentMatched: agent
      ? { id: agent.id, name: agent.name, ghlUserId: agent.ghlUserId, matchedBy }
      : null,
    leadMatched: lead ?? null,
    wouldWrite: !!agent,
    reason: !agent
      ? `No DataForge user matched ghlUserId="${ghlUserId}" or name="${agentName}". Ensure the agent's GHL User ID is saved in their DataForge profile.`
      : isDryRun
      ? "DRY RUN — nothing written to database."
      : "Would write to database (set dryRun: true to skip writing).",
  };

  if (!isDryRun && agent) {
    return NextResponse.json({
      note: "Set dryRun: true in the body to preview without writing. Remove dryRun or set it to false to actually write.",
      parsed,
      resolution,
    });
  }

  return NextResponse.json({ parsed, resolution });
}
