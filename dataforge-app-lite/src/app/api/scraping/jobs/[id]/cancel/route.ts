import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFullKeywordAccess } from "@/lib/keywords/access";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  const userId = (session.user as unknown as Record<string, unknown>)?.id as string;

  const { id } = await params;

  const job = await prisma.scrapingJob.findUnique({ where: { id }, select: { startedById: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Boss/admin can stop any run. Everyone else may only stop a run they started.
  if (!hasFullKeywordAccess(role) && job.startedById !== userId) {
    return NextResponse.json(
      { error: "Only the person who started this run, or a boss/admin, can stop it." },
      { status: 403 },
    );
  }

  // Use "paused" as a cancellation signal so the polling loop in the UI
  // keeps running and picks up the real final status once the scraper
  // detects the change, flushes pending DB inserts, and writes "completed"/"failed".
  await prisma.scrapingJob.updateMany({
    where: { id, status: { in: ["running", "pending"] } },
    data: { status: "paused" },
  });

  return NextResponse.json({ ok: true });
}
