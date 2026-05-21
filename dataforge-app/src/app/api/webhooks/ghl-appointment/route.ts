import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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

  // ── Match rep by name ──
  const allReps = await prisma.user.findMany({
    where: { role: { in: ["sales_rep", "team_lead", "boss", "admin"] } },
    select: { id: true, name: true, nickname: true },
  });

  // Noise words GHL might include around a rep's name — ignored during token matching
  const NOISE = new Set([
    "fb", "facebook", "ig", "instagram", "tt", "tiktok", "yt", "youtube",
    "tw", "twitter", "x", "wa", "whatsapp", "sms", "web", "website",
    "gg", "google", "from", "by", "via", "and", "the", "rep", "agent",
  ]);

  // Extract meaningful tokens from a string (>= 2 chars, not noise)
  function tokens(s: string): string[] {
    return s.toLowerCase().split(/[\s\-_,.|&]+/).filter((w) => w.length >= 2 && !NOISE.has(w));
  }

  const queryTokens = tokens(repName);

  function score(u: { name: string | null; nickname: string | null }): number {
    if (!queryTokens.length) return 0;

    // Build token sets for this agent's name + nickname
    const candidateTokens = [
      ...tokens(u.name ?? ""),
      ...tokens(u.nickname ?? ""),
    ];
    if (!candidateTokens.length) return 0;

    // Full string exact match (highest confidence)
    const qFull  = queryTokens.join(" ");
    const cFull  = tokens(u.name ?? "").join(" ");
    const cnFull = tokens(u.nickname ?? "").join(" ");
    if (cFull === qFull || cnFull === qFull) return 100;

    // Count how many of the agent's name tokens appear in the query
    const hits = candidateTokens.filter((ct) =>
      queryTokens.some((qt) => qt === ct || qt.startsWith(ct) || ct.startsWith(qt))
    );

    if (hits.length === 0) return 0;

    // Score = proportion of agent tokens matched × 80, capped at 90
    // Longer individual token matches are worth more (avoids false positives on short words)
    const tokenScore = (hits.length / candidateTokens.length) * 80;
    const lengthBonus = Math.min(10, hits.reduce((s, h) => s + h.length, 0));
    return Math.min(90, Math.round(tokenScore + lengthBonus));
  }

  const matched = allReps
    .map((u) => ({ u, s: score(u) }))
    .filter((x) => x.s >= 20)   // minimum confidence threshold
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
