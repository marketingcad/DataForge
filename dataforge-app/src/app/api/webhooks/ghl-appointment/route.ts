import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { matchRepByName } from "@/lib/ghl/match-rep";

export async function GET() {
  return NextResponse.json({ ok: true, message: "GHL appointment webhook is live" });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {

  const clientName  = String(body.name        ?? body.client_name  ?? "").trim();
  const clientPhone = String(body.phone        ?? body.client_phone ?? "").trim() || null;
  const bookedAtRaw = body.booked_at ?? body.start_time ?? body.appointment_time ?? null;
  const repName     = String(body.craeted_by  ?? body.created_by   ?? body.booked_by ?? "").trim();
  const ghlId       = String(body.id          ?? body.appointment_id ?? "").trim() || null;

  if (!clientName) {
    return NextResponse.json({ error: "Missing client name", received: body }, { status: 400 });
  }

  const bookedAt = bookedAtRaw ? new Date(String(bookedAtRaw)) : new Date();

  // ── Match rep by name (shared with the lead webhook) ──
  const matched = await matchRepByName(repName);

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

  const agent = await prisma.user.findUnique({ where: { id: matched.id }, select: { role: true } });

  await prisma.$transaction([
    prisma.bookedAppointment.create({
      data: {
        agentId:     matched.id,
        clientName,
        clientPhone,
        bookedAt,
        source:      "webhook",
        ghlId,
      },
    }),
    ...(agent && ["sales_rep", "team_lead"].includes(agent.role)
      ? [prisma.user.update({ where: { id: matched.id }, data: { balloonPoints: { increment: 1 } } })]
      : []),
  ]);

    revalidatePath("/marketing");
    return NextResponse.json({ ok: true, agent: matched.name, clientName, bookedAt });
  } catch (err) {
    console.error("[ghl-webhook] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
