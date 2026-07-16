import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Called every ~10s by every open instance (web tab or desktop app). Upserts the
// instance's presence row so the boss fleet view knows it's online and who's on it.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = session.user as unknown as Record<string, unknown>;
  const userId = (u?.id as string) ?? "";
  if (!userId) return NextResponse.json({ error: "No user" }, { status: 401 });

  let body: { deviceId?: string; kind?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const deviceId = (body.deviceId ?? "").trim();
  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  const kind = body.kind === "desktop" ? "desktop" : "web";

  const data = {
    userId,
    userName: (u?.name as string) ?? null,
    userEmail: (u?.email as string) ?? null,
    role: (u?.role as string) ?? "lead_specialist",
    kind,
  };

  await prisma.appInstance.upsert({
    where: { id: deviceId },
    update: data,          // lastSeen auto-updates (@updatedAt)
    create: { id: deviceId, ...data },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
