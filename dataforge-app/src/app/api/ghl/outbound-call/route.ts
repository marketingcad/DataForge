import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapGhlCallStatus } from "@/lib/ghl/client";

/**
 * Webhook for GHL outbound-call action triggers.
 *
 * GHL sends custom key-value pairs prefixed with "call_" along with a
 * Bearer token in the Authorization header ({{custom_values.api_token}}).
 *
 * Agent resolution order:
 *   1. call_user_id          → User.ghlUserId exact match
 *   2. call_answered_by_user_id → User.ghlUserId exact match
 *   3. call_user_name        → User.name case-insensitive match
 *   4. call_answered_by_user_name → User.name case-insensitive match
 *
 * Dedup key: "ghl-out:{ghlUserId}:{call_start_time}" — one record per
 * agent per call start timestamp; safe to re-send on GHL retries.
 */

function parsePayload(b: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) =>
    typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) || 0 : 0;

  // Accept both GHL's standard webhook field names AND the call_ custom-value prefixed names
  const ghlUserId =
    str(b.call_user_id) ?? str(b.call_answered_by_user_id) ??
    str(b.userId) ?? str(b.user_id) ?? str(b.assignedTo) ?? str(b.assigned_to) ?? str(b.ownerId);

  const agentName =
    str(b.call_user_name) ?? str(b.call_answered_by_user_name) ??
    str(b.userName) ?? str(b.user_name) ?? str(b.assignedToName) ?? str(b.assigned_to_name);

  const directionRaw =
    str(b.call_direction) ?? str(b.direction) ?? "outbound";
  const direction: "inbound" | "outbound" =
    directionRaw.toLowerCase().includes("in") ? "inbound" : "outbound";

  // GHL sends camelCase variants: callFrom, callTo; also check snake_case and prefixed forms
  const fromPhone = str(b.call_from) ?? str(b.callFrom) ?? str(b.from) ?? str(b.fromPhone) ?? str(b.from_phone);
  const toPhone   = str(b.call_to)   ?? str(b.callTo)   ?? str(b.to)   ?? str(b.toPhone)   ?? str(b.to_phone);
  // For outbound the contact is the "to" number; for inbound it's the "from".
  const contactPhone = direction === "outbound" ? toPhone : fromPhone;

  const startRaw =
    b.call_start_time ?? b.callStartTime ?? b.startTime ?? b.start_time ?? b.calledAt ?? b.called_at ?? b.createdAt ?? b.created_at;
  const endRaw =
    b.call_end_time ?? b.callEndTime ?? b.endTime ?? b.end_time;

  let durationSecs = num(b.call_duration ?? b.callDuration ?? b.duration ?? b.durationSecs ?? b.duration_secs ?? b.durationSeconds);

  // Derive duration from timestamps when the field is absent / zero
  if (!durationSecs && startRaw && endRaw) {
    const ms = new Date(String(endRaw)).getTime() - new Date(String(startRaw)).getTime();
    if (ms > 0) durationSecs = Math.round(ms / 1000);
  }

  const calledAt  = startRaw ? new Date(String(startRaw)) : new Date();
  const statusRaw = str(b.call_status) ?? str(b.callStatus) ?? str(b.status) ?? "";

  // Stable dedup key — one row per agent × start-timestamp
  const dedupKey = ghlUserId && startRaw
    ? `ghl-out:${ghlUserId}:${String(startRaw)}`
    : null;

  return { ghlUserId, agentName, direction, fromPhone, toPhone, contactPhone, durationSecs, statusRaw, calledAt, dedupKey };
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: accept Bearer token in Authorization header OR ?secret= query param
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    const expectedSecret = settings?.ghlInboundSecret;

    if (expectedSecret) {
      const authHeader = req.headers.get("authorization") ?? "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
      const querySecret = new URL(req.url).searchParams.get("secret");

      if (bearerToken !== expectedSecret && querySecret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.log("[ghl/outbound-call] raw payload:", JSON.stringify(body).slice(0, 800));

    const {
      ghlUserId, agentName, direction,
      contactPhone, durationSecs, statusRaw, calledAt, dedupKey,
    } = parsePayload(body as Record<string, unknown>);

    // ── Agent resolution ────────────────────────────────────────────────────
    let agent: { id: string } | null = null;

    if (ghlUserId) {
      agent = await prisma.user.findUnique({
        where: { ghlUserId },
        select: { id: true },
      });
    }

    // Name-based fallback (case-insensitive) when GHL user ID isn't linked yet
    if (!agent && agentName) {
      agent = await prisma.user.findFirst({
        where: { name: { equals: agentName, mode: "insensitive" } },
        select: { id: true },
      });
    }

    if (!agent) {
      console.warn(
        `[ghl/outbound-call] no DataForge user matched — ghlUserId=${ghlUserId} name="${agentName}"`,
      );
      // Acknowledge so GHL doesn't keep retrying
      return NextResponse.json({ received: true, warning: "no linked agent" });
    }

    // ── Lead resolution by contact phone ───────────────────────────────────
    let leadId: string | null = null;
    if (contactPhone) {
      const lead = await prisma.lead.findFirst({
        where: { phone: contactPhone },
        select: { id: true },
      });
      leadId = lead?.id ?? null;
    }

    const status = mapGhlCallStatus(statusRaw);

    // ── Upsert call log ────────────────────────────────────────────────────
    if (dedupKey) {
      await prisma.callLog.upsert({
        where: { ghlMessageId: dedupKey },
        create: {
          agentId:      agent.id,
          leadId,
          contactPhone: contactPhone ?? null,
          direction,
          durationSecs,
          status,
          calledAt,
          ghlMessageId: dedupKey,
          notes:        "GHL outbound webhook",
        },
        update: {
          agentId:     agent.id,
          leadId,
          durationSecs,
          status,
          calledAt,
          direction,
        },
      });
    } else {
      // No reliable dedup key — create only (safe: GHL rarely retries without a key)
      await prisma.callLog.create({
        data: {
          agentId:      agent.id,
          leadId,
          contactPhone: contactPhone ?? null,
          direction,
          durationSecs,
          status,
          calledAt,
          notes: "GHL outbound webhook",
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[ghl/outbound-call]", err);
    return NextResponse.json({ received: true, error: "internal" });
  }
}
