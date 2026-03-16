import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Validate cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the oldest pending job
  const job = await prisma.scrapingJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (!job) {
    return NextResponse.json({ message: "No pending jobs" });
  }

  // Trigger processing
  const processUrl = `${req.nextUrl.origin}/api/scraping/jobs/${job.id}/process`;
  await fetch(processUrl, { method: "POST" });

  return NextResponse.json({ triggered: job.id });
}
