import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lightweight database reachability probe used by the reconnecting screen.
// Never throws — returns { ok: true } when the DB answers, { ok: false } (503) when not.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
