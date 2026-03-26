import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Use "paused" as a cancellation signal so the polling loop in the UI
  // keeps running and picks up the real final status once the scraper
  // detects the change, flushes pending DB inserts, and writes "completed"/"failed".
  await prisma.scrapingJob.updateMany({
    where: { id, status: "running" },
    data: { status: "paused" },
  });

  return NextResponse.json({ ok: true });
}
