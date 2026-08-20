import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Called every ~8s by every open instance (web tab or desktop app). Upserts the
// instance's presence row AND returns any pending remote commands the boss has
// queued for this device, which the client then executes locally.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = session.user as unknown as Record<string, unknown>;
  const userId = (u?.id as string) ?? "";
  if (!userId) return NextResponse.json({ error: "No user" }, { status: 401 });

  let body: { deviceId?: string; kind?: string; deviceName?: string; reportedIp?: string | null } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const deviceId = (body.deviceId ?? "").trim();
  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  const kind = body.kind === "desktop" ? "desktop" : "web";

  // Server-observed IP (real public IP on Vercel via x-forwarded-for). A desktop
  // app hits its own localhost server, so that reads as ::1/127.0.0.1 — in that
  // case fall back to the LAN IP the client reported.
  const observed = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim();
  const isLocal = !observed || observed === "::1" || observed.startsWith("127.");
  const ipAddress = (isLocal ? (body.reportedIp ?? observed) : observed) || null;

  const data = {
    userId,
    userName: (u?.name as string) ?? null,
    userEmail: (u?.email as string) ?? null,
    role: (u?.role as string) ?? "lead_specialist",
    kind,
    deviceName: (body.deviceName ?? "").trim() || null,
    ipAddress,
  };

  await prisma.appInstance.upsert({
    where: { id: deviceId },
    update: data,          // lastSeen auto-updates (@updatedAt)
    create: { id: deviceId, ...data },
  }).catch(() => null);

  // Deliver any pending remote commands for this device, and mark them delivered
  // (done) so they aren't re-sent. Execution happens client-side; start/stop are
  // idempotent, so at-most-once delivery is fine.
  const commands = await prisma.remoteCommand.findMany({
    where: { targetDeviceId: deviceId, status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, keywordId: true },
  }).catch(() => []);

  if (commands.length > 0) {
    await prisma.remoteCommand.updateMany({
      where: { id: { in: commands.map((c) => c.id) } },
      data: { status: "done", processedAt: new Date() },
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, commands });
}
