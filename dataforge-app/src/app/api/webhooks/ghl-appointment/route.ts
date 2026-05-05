import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Extract fields from GHL webhook payload
  const clientName  = String(body.name        ?? body.client_name  ?? "").trim();
  const clientPhone = String(body.phone        ?? body.client_phone ?? "").trim();
  const bookedAtRaw = body.booked_at           ?? body.start_time   ?? body.appointment_time ?? null;
  const repName     = String(body.craeted_by ?? body.created_by ?? body.booked_by ?? "").trim();
  const ghlId       = String(body.id           ?? body.appointment_id ?? "").trim() || null;

  if (!clientName) {
    return NextResponse.json({ error: "Missing client name", received: body }, { status: 400 });
  }

  // Resolve booking date — fall back to now if not provided
  const bookedAt = bookedAtRaw ? new Date(String(bookedAtRaw)) : new Date();

  // Match rep by name (case-insensitive) against DataForge users
  const allReps = await prisma.user.findMany({
    where: { role: { in: ["sales_rep", "team_lead", "boss", "admin"] } },
    select: { id: true, name: true },
  });

  const repNameLower = repName.toLowerCase();
  const matched = allReps.find((u) =>
    u.name?.toLowerCase() === repNameLower ||
    u.name?.toLowerCase().includes(repNameLower) ||
    repNameLower.includes(u.name?.toLowerCase() ?? "___")
  );

  if (!matched) {
    // Log unmatched but don't fail — store for manual review
    console.warn(`[ghl-webhook] Rep not matched: "${repName}" — payload:`, JSON.stringify(body));
    return NextResponse.json({
      ok: false,
      reason: `Rep "${repName}" not found in DataForge. Add them as a linked user or check the booked_by field value.`,
      receivedPayload: body,
    }, { status: 200 }); // 200 so GHL doesn't retry
  }

  // Upsert — phone + bookedAt is the unique key to prevent duplicate webhook fires
  const phoneKey   = clientPhone || null;
  const upsertKey  = phoneKey
    ? { clientPhone_bookedAt: { clientPhone: phoneKey, bookedAt } }
    : { ghlId: ghlId ?? `manual-${Date.now()}` };

  await prisma.bookedAppointment.upsert({
    where:  upsertKey as Parameters<typeof prisma.bookedAppointment.upsert>[0]["where"],
    create: {
      agentId:     matched.id,
      clientName,
      clientPhone: phoneKey,
      bookedAt,
      source:      "webhook",
      ghlId,
    },
    update: {
      agentId:    matched.id,
      clientName,
    },
  });

  return NextResponse.json({ ok: true, agent: matched.name, clientName, bookedAt });
}
