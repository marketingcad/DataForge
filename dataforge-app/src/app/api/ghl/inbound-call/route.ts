import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapGhlCallStatus } from "@/lib/ghl/client";

// GHL sends many different field name formats depending on automation version —
// this normalises all known variants into a single shape.
function parsePayload(b: Record<string, unknown>) {
  const str  = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num  = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) || 0 : 0);

  const ghlUserId    = str(b.userId ?? b.user_id ?? b.assignedTo ?? b.assigned_to ?? b.ownerId);
  const contactId    = str(b.contactId ?? b.contact_id);
  const convId       = str(b.conversationId ?? b.conversation_id);
  const callId       = str(b.callId ?? b.call_id);
  const phone        = str(b.phone ?? b.contactPhone ?? b.contact_phone ?? b.to ?? b.from);
  const firstName    = str(b.firstName ?? b.first_name) ?? "";
  const lastName     = str(b.lastName  ?? b.last_name)  ?? "";
  const contactName  = str(b.fullName ?? b.full_name ?? b.name ?? b.contactName ?? b.contact_name)
    ?? (`${firstName} ${lastName}`.trim() || undefined);
  const durationSecs = num(b.duration ?? b.durationSecs ?? b.duration_secs ?? b.durationSeconds ?? b.call_duration);
  const statusRaw    = str(b.callStatus ?? b.call_status ?? b.status) ?? "";
  const directionRaw = str(b.direction ?? b.call_direction) ?? "outbound";
  const calledAtRaw  = b.startTime ?? b.start_time ?? b.calledAt ?? b.called_at ?? b.createdAt ?? b.created_at;

  // Prefer conversationId as dedup key (matches what the GHL sync stores).
  // Fall back to a webhook-specific key so it won't collide with unrelated records.
  const ghlMessageId = convId ?? (callId ? `wh:${callId}` : null);

  const direction: "inbound" | "outbound" =
    directionRaw.toLowerCase().includes("in") ? "inbound" : "outbound";

  const calledAt = calledAtRaw
    ? new Date(typeof calledAtRaw === "number" ? calledAtRaw : String(calledAtRaw))
    : new Date();

  return { ghlUserId, contactId, phone, contactName, durationSecs, statusRaw, direction, calledAt, ghlMessageId };
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const incomingSecret = searchParams.get("secret");

    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });

    if (settings?.ghlInboundSecret && incomingSecret !== settings.ghlInboundSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      ghlUserId, contactId, phone, contactName,
      durationSecs, statusRaw, direction, calledAt, ghlMessageId,
    } = parsePayload(body as Record<string, unknown>);

    if (!ghlUserId) {
      // Can't attribute without a GHL user ID — log and acknowledge so GHL doesn't retry
      console.warn("[ghl/inbound-call] missing userId in payload", JSON.stringify(body).slice(0, 400));
      return NextResponse.json({ received: true, warning: "no userId — call not attributed" });
    }

    // Resolve DataForge agent
    const agent = await prisma.user.findUnique({
      where: { ghlUserId },
      select: { id: true },
    });

    if (!agent) {
      console.warn(`[ghl/inbound-call] no DataForge user linked to ghlUserId=${ghlUserId}`);
      return NextResponse.json({ received: true, warning: "no linked agent" });
    }

    // Resolve linked lead (by contactId first, then by phone)
    let leadId: string | null = null;
    if (contactId) {
      const lead = await prisma.lead.findFirst({
        where: { ghlContactId: contactId },
        select: { id: true },
      });
      leadId = lead?.id ?? null;
    }
    if (!leadId && phone) {
      const lead = await prisma.lead.findFirst({
        where: { phone },
        select: { id: true },
      });
      leadId = lead?.id ?? null;
    }

    const status = mapGhlCallStatus(statusRaw);

    if (ghlMessageId) {
      await prisma.callLog.upsert({
        where: { ghlMessageId },
        create: {
          agentId: agent.id,
          leadId,
          contactName: contactName ?? null,
          contactPhone: phone ?? null,
          direction,
          durationSecs,
          status,
          calledAt,
          ghlMessageId,
          notes: "GHL webhook",
        },
        update: {
          agentId: agent.id,
          leadId,
          durationSecs,
          status,
          calledAt,
          direction,
        },
      });
    } else {
      // No reliable dedup key — create only (may produce duplicates if GHL retries)
      await prisma.callLog.create({
        data: {
          agentId: agent.id,
          leadId,
          contactName: contactName ?? null,
          contactPhone: phone ?? null,
          direction,
          durationSecs,
          status,
          calledAt,
          notes: "GHL webhook",
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[ghl/inbound-call]", err);
    // Still return 200 so GHL doesn't keep retrying
    return NextResponse.json({ received: true, error: "internal" });
  }
}
