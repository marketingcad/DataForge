import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Called (via navigator.sendBeacon) when an instance is closing — a browser tab
// or the desktop app. Removes its presence row immediately so the boss fleet view
// drops it without waiting for the heartbeat-timeout window.
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as unknown as Record<string, unknown>)?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: true }); // best-effort, never error a beacon

  let body: { deviceId?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const deviceId = (body.deviceId ?? "").trim();

  if (deviceId) {
    // Scope to the session's own device so one user can't drop another's instance.
    await prisma.appInstance.deleteMany({ where: { id: deviceId, userId } }).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
