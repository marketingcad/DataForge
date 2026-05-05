import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientName  = String(body.name        ?? body.client_name  ?? "").trim();
  const clientPhone = String(body.phone        ?? body.client_phone ?? "").trim() || null;
  const bookedAtRaw = body.booked_at ?? body.start_time ?? body.appointment_time ?? null;
  const repName     = String(body.craeted_by  ?? body.created_by   ?? body.booked_by ?? "").trim();
  const ghlId       = String(body.id          ?? body.appointment_id ?? "").trim() || null;

  if (!clientName) {
    return NextResponse.json({ error: "Missing client name", received: body }, { status: 400 });
  }

  const bookedAt = bookedAtRaw ? new Date(String(bookedAtRaw)) : new Date();

  // ── Match rep by name ──
  const allReps = await prisma.user.findMany({
    where: { role: { in: ["sales_rep", "team_lead", "boss", "admin"] } },
    select: { id: true, name: true },
  });

  const repNameLower = repName.toLowerCase();

  function score(userName: string): number {
    const u = userName.toLowerCase();
    const parts = u.split(" ");
    if (u === repNameLower)                                        return 100;
    if (parts[0] === repNameLower)                                 return 90;
    if (parts[parts.length - 1] === repNameLower)                  return 80;
    if (u.startsWith(repNameLower))                                return 70;
    if (repNameLower.split(" ").every((w) => u.includes(w)))       return 60;
    if (u.includes(repNameLower))                                  return 40;
    return 0;
  }

  const matched = allReps
    .map((u) => ({ u, s: score(u.name ?? "") }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)[0]?.u ?? null;

  if (!matched) {
    return NextResponse.json({
      ok: false,
      reason: `Rep "${repName}" not found in DataForge`,
      receivedPayload: body,
    });
  }

  // ── Dedup check: skip if same ghlId or same phone+bookedAt already exists ──
  const existing = await prisma.bookedAppointment.findFirst({
    where: {
      OR: [
        ...(ghlId ? [{ ghlId }] : []),
        ...(clientPhone ? [{ clientPhone, bookedAt }] : []),
      ],
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Duplicate — already recorded", agent: matched.name });
  }

  await prisma.bookedAppointment.create({
    data: {
      agentId:     matched.id,
      clientName,
      clientPhone,
      bookedAt,
      source:      "webhook",
      ghlId,
    },
  });

  return NextResponse.json({ ok: true, agent: matched.name, clientName, bookedAt });
}
