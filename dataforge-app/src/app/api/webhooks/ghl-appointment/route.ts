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

  // Strip leading source prefixes GHL sometimes prepends (e.g. "FB Sharlene" → "Sharlene")
  const SOURCE_PREFIXES = new Set(["fb", "ig", "tt", "tiktok", "yt", "tw", "twitter", "x", "wa", "sms", "web", "gg", "google"]);
  function stripSourcePrefix(n: string): string {
    const words = n.trim().split(/\s+/);
    if (words.length > 1 && SOURCE_PREFIXES.has(words[0].toLowerCase())) {
      return words.slice(1).join(" ");
    }
    return n;
  }

  const repNameCleaned = stripSourcePrefix(repName);

  function scoreAgainst(candidate: string, query: string): number {
    const c = candidate.toLowerCase();
    const q = query.toLowerCase();
    const parts = c.split(" ");
    if (c === q)                                         return 100;
    if (parts[0] === q)                                  return 90;
    if (parts[parts.length - 1] === q)                   return 80;
    if (c.startsWith(q))                                 return 70;
    if (q.split(" ").every((w) => c.includes(w)))        return 60;
    if (c.includes(q))                                   return 40;
    return 0;
  }

  function score(u: { name: string | null; nickname: string | null }): number {
    const name     = u.name     ?? "";
    const nickname = u.nickname ?? "";
    // Try both the cleaned name (prefix stripped) and the original
    return Math.max(
      scoreAgainst(name,     repNameCleaned),
      scoreAgainst(name,     repName),
      nickname ? scoreAgainst(nickname, repNameCleaned) : 0,
      nickname ? scoreAgainst(nickname, repName)        : 0,
    );
  }

  const matched = allReps
    .map((u) => ({ u, s: score(u) }))
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
