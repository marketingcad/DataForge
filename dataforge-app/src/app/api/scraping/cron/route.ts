import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/scraping/jobs/service";
import { getDueKeywords } from "@/lib/keywords/service";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Validate cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const triggered: string[] = [];

  // 1. Process the oldest pending manual job
  const job = await prisma.scrapingJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (job) {
    const processUrl = `${req.nextUrl.origin}/api/scraping/jobs/${job.id}/process`;
    await fetch(processUrl, { method: "POST" });
    triggered.push(`job:${job.id}`);
  }

  // 2. Enqueue due keyword jobs
  const dueKeywords = await getDueKeywords();

  for (const kw of dueKeywords) {
    // Skip if this keyword already has a running/pending job
    const active = await prisma.scrapingJob.findFirst({
      where: {
        keywordId: kw.id,
        status: { in: ["pending", "running"] },
      },
    });
    if (active) continue;

    const newJob = await createJob({
      industry: kw.keyword,
      location: kw.location,
      maxLeads: kw.maxLeads,
      source: "maps",
      keywordId: kw.id,
    });

    const processUrl = `${req.nextUrl.origin}/api/scraping/jobs/${newJob.id}/process`;
    fetch(processUrl, { method: "POST" }).catch(() => null);
    triggered.push(`keyword:${kw.id}→job:${newJob.id}`);
  }

  if (triggered.length === 0) {
    return NextResponse.json({ message: "Nothing to process" });
  }

  return NextResponse.json({ triggered });
}
