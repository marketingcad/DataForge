import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { createJob, getJobById } from "@/lib/scraping/jobs/service";
import { getDueKeywords } from "@/lib/keywords/service";
import { processKeywordJob } from "@/lib/scraping/jobs/processor";

export const maxDuration = 300;

async function handleCron(req: NextRequest) {
  // Accept either our CRON_SECRET (GitHub Actions / external services)
  // or Vercel's built-in cron header (when running on Pro plan with vercel.json crons).
  const auth = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const validSecret = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const validVercel = vercelCron === "1";

  if (!validSecret && !validVercel) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const triggered: string[] = [];

  // 1. Resume any keyword job that got stuck in "pending" (e.g. previous cron was killed
  //    before waitUntil could start). Process at most one stuck job per cron run.
  const stuckJob = await prisma.scrapingJob.findFirst({
    where: {
      status: "pending",
      keywordId: { not: null },
      // Only pick up jobs that have been pending for at least 2 minutes
      createdAt: { lte: new Date(Date.now() - 2 * 60 * 1000) },
    },
    orderBy: { createdAt: "asc" },
  });

  if (stuckJob) {
    try {
      const job = await getJobById(stuckJob.id);
      waitUntil(processKeywordJob(job));
      triggered.push(`resume:${stuckJob.id}`);
    } catch { /* job may have been deleted */ }
  }

  // 2. Enqueue and immediately process due keyword jobs
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

    try {
      const newJob = await createJob({
        industry: kw.keyword,
        location: kw.location,
        maxLeads: kw.maxLeads,
        source: "serpapi",
        keywordId: kw.id,
      });

      // Call processKeywordJob directly via waitUntil — no HTTP hop.
      // The cron returns its response immediately; Vercel keeps this function
      // alive (up to maxDuration) until the scraping promise resolves.
      const job = await getJobById(newJob.id);
      waitUntil(processKeywordJob(job));
      triggered.push(`keyword:${kw.id}→job:${newJob.id}`);
    } catch { /* ignore per-keyword errors so one failure doesn't block the rest */ }
  }

  if (triggered.length === 0) {
    return NextResponse.json({ message: "Nothing to process" });
  }

  return NextResponse.json({ triggered });
}

export const GET  = handleCron;
export const POST = handleCron;
