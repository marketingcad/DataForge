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

function nested(b: Record<string, unknown>, key: string): unknown {
  return (b[key] as Record<string, unknown> | undefined) ?? undefined;
}

function parsePayload(b: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) =>
    typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) || 0 : 0;

  // Nested sub-objects GHL sometimes sends (e.g. { user: { id, name }, call: { ... } })
  const u = nested(b, "user") as Record<string, unknown> | undefined;
  const c = nested(b, "call") as Record<string, unknown> | undefined;
  const d = nested(b, "data") as Record<string, unknown> | undefined;

  // Accept flat, prefixed, camelCase AND nested { user.id } formats
  const ghlUserId =
    str(b.call_user_id) ?? str(b.call_answered_by_user_id) ??
    str(b.userId) ?? str(b.user_id) ?? str(b.assignedTo) ?? str(b.assigned_to) ?? str(b.ownerId) ??
    str(u?.id) ?? str(d?.userId) ?? str(d?.user_id);

  const agentName =
    str(b.call_user_name) ?? str(b.call_answered_by_user_name) ??
    str(b.userName) ?? str(b.user_name) ?? str(b.assignedToName) ?? str(b.assigned_to_name) ??
    str(u?.name) ?? str(u?.fullName);

  const directionRaw =
    str(b.call_direction) ?? str(b.direction) ??
    str(c?.direction) ?? "outbound";
  const direction: "inbound" | "outbound" =
    directionRaw.toLowerCase().includes("in") ? "inbound" : "outbound";

  const fromPhone =
    str(b.call_from) ?? str(b.callFrom) ?? str(b.from) ?? str(b.fromPhone) ?? str(b.from_phone) ??
    str(c?.from) ?? str(c?.callFrom);
  const toPhone =
    str(b.call_to) ?? str(b.callTo) ?? str(b.to) ?? str(b.toPhone) ?? str(b.to_phone) ??
    str(c?.to) ?? str(c?.callTo);
  const contactPhone = direction === "outbound" ? toPhone : fromPhone;

  const startRaw =
    b.call_start_time ?? b.callStartTime ?? b.startTime ?? b.start_time ??
    b.calledAt ?? b.called_at ?? b.createdAt ?? b.created_at ??
    c?.startTime ?? c?.start_time ?? c?.callStartTime;
  const endRaw =
    b.call_end_time ?? b.callEndTime ?? b.endTime ?? b.end_time ??
    c?.endTime ?? c?.end_time;

  let durationSecs = num(
    b.call_duration ?? b.callDuration ?? b.duration ?? b.durationSecs ?? b.duration_secs ?? b.durationSeconds ??
    c?.duration ?? c?.callDuration
  );

  if (!durationSecs && startRaw && endRaw) {
    const ms = new Date(String(endRaw)).getTime() - new Date(String(startRaw)).getTime();
    if (ms > 0) durationSecs = Math.round(ms / 1000);
  }

  const calledAt  = startRaw ? new Date(String(startRaw)) : new Date();
  const statusRaw =
    str(b.call_status) ?? str(b.callStatus) ?? str(b.status) ??
    str(c?.status) ?? str(c?.callStatus) ?? "";

  const dedupKey = ghlUserId && startRaw
    ? `ghl-out:${ghlUserId}:${String(startRaw)}`
    : null;

  return { ghlUserId, agentName, direction, fromPhone, toPhone, contactPhone, durationSecs, statusRaw, calledAt, dedupKey };
}

// GHL sometimes sends a GET to verify the URL is reachable
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "ghl/outbound-call" });
}

export async function POST(req: NextRequest) {
  try {
    // Read body first — always store raw payload so we can debug auth failures too
    const bodyText = await req.text().catch(() => "");
    let body: unknown = null;
    try { body = JSON.parse(bodyText); } catch { /* non-JSON body */ }

    const rawStr = (bodyText || "").slice(0, 4000);
    console.log("[ghl/outbound-call] raw payload:", rawStr);

    // ── Auth: accept Bearer token in Authorization header OR ?secret= query param
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    const expectedSecret = settings?.ghlInboundSecret;

    if (expectedSecret) {
      const authHeader = req.headers.get("authorization") ?? "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
      const querySecret = new URL(req.url).searchParams.get("secret");

      if (bearerToken !== expectedSecret && querySecret !== expectedSecret) {
        await prisma.appSettings.update({
          where: { id: "singleton" },
          data: {
            webhookLastPayload: rawStr || "(empty body)",
            webhookLastOutcome: `auth_failed — no matching secret at ${new Date().toISOString()}`,
          },
        }).catch(() => {});
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Store the raw payload immediately so we have it even if processing fails
    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: {
        webhookLastPayload: rawStr || "(empty body)",
        webhookLastOutcome: `received — processing at ${new Date().toISOString()}`,
      },
    }).catch(() => {});

    if (!body || typeof body !== "object") {
      await prisma.appSettings.update({
        where: { id: "singleton" },
        data: { webhookLastOutcome: `invalid_json — body was: ${rawStr.slice(0, 200)} at ${new Date().toISOString()}` },
      }).catch(() => {});
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

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
      const outcome = `no_agent — parsed ghlUserId="${ghlUserId}" name="${agentName}" at ${new Date().toISOString()}`;
      console.warn("[ghl/outbound-call]", outcome);
      await prisma.appSettings.update({
        where: { id: "singleton" },
        data: { webhookLastOutcome: outcome },
      }).catch(() => {});
      return NextResponse.json({ received: true, warning: "no linked agent" });
    }

    // Update outcome with success
    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: {
        webhookLastOutcome: `ok — agent="${agent.id}" direction="${direction}" at ${new Date().toISOString()}`,
      },
    }).catch(() => {});

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
