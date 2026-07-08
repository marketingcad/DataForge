import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { createJob, getJobById } from "@/lib/scraping/jobs/service";
import { getDueKeywords, pickSearchTerm } from "@/lib/keywords/service";
import { processKeywordJob } from "@/lib/scraping/jobs/processor";
import { launchScraperBrowser } from "@/lib/scraping/crawler/core";

export const maxDuration = 300;

// Each keyword job launches its OWN headless Chromium. Running several at once
// is fine on a capable host but can starve a small serverless instance (leading
// to page.goto timeouts). Cap concurrency; the /5-min cron picks up the rest on
// the next tick(s) since their nextRunAt hasn't advanced yet.
//
// Tune with the KEYWORD_SCRAPER_CONCURRENCY env var (default 3). Raise it if the
// host has spare CPU/RAM; lower it to 1–2 if scrapes start timing out.
const MAX_CONCURRENT_KEYWORD_JOBS = Math.max(1, Number(process.env.KEYWORD_SCRAPER_CONCURRENCY) || 3);

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
  // Jobs to run this tick — all share ONE Chromium browser (one context/tab-set
  // each) so N concurrent keywords cost ~1 browser process instead of N.
  const jobsToRun: Awaited<ReturnType<typeof getJobById>>[] = [];

  // Jobs already in flight from earlier ticks count against the concurrency cap,
  // so a slow batch of browsers can't pile up on top of a fresh one.
  const inFlight = await prisma.scrapingJob.count({
    where: { keywordId: { not: null }, status: { in: ["pending", "running"] } },
  });
  let slots = MAX_CONCURRENT_KEYWORD_JOBS - inFlight;

  // 1. Resume any keyword job that got stuck in "pending" (e.g. previous cron was killed
  //    before waitUntil could start). Process at most one stuck job per cron run.
  const stuckJob = slots > 0 ? await prisma.scrapingJob.findFirst({
    where: {
      status: "pending",
      keywordId: { not: null },
      // Only pick up jobs that have been pending for at least 2 minutes
      createdAt: { lte: new Date(Date.now() - 2 * 60 * 1000) },
    },
    orderBy: { createdAt: "asc" },
  }) : null;

  if (stuckJob) {
    try {
      const job = await getJobById(stuckJob.id);
      jobsToRun.push(job);
      triggered.push(`resume:${stuckJob.id}`);
      // NOTE: do NOT decrement slots here — this pending job is already included
      // in the inFlight count above, so decrementing would double-count it and
      // needlessly block a fresh keyword from starting this tick.
    } catch { /* job may have been deleted */ }
  }

  // 2. Enqueue and immediately process due keyword jobs, up to the remaining slots.
  const dueKeywords = slots > 0 ? await getDueKeywords() : [];

  let deferred = 0;
  for (const kw of dueKeywords) {
    if (slots <= 0) { deferred++; continue; }

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
        industry: pickSearchTerm(kw),
        location: kw.location,
        maxLeads: kw.maxLeads,
        source: "serpapi",
        keywordId: kw.id,
      });

      const job = await getJobById(newJob.id);
      jobsToRun.push(job);
      triggered.push(`keyword:${kw.id}→job:${newJob.id}`);
      slots--;
    } catch { /* ignore per-keyword errors so one failure doesn't block the rest */ }
  }

  // Run the whole batch under a single shared browser. The cron returns its
  // response immediately; Vercel keeps the function alive (up to maxDuration)
  // via waitUntil until every scrape resolves, then we close the browser.
  if (jobsToRun.length > 0) {
    waitUntil((async () => {
      let browser: Awaited<ReturnType<typeof launchScraperBrowser>> | null = null;
      try {
        browser = await launchScraperBrowser();
      } catch {
        browser = null; // fall back to per-job own-browser mode below
      }
      try {
        await Promise.all(
          jobsToRun.map((job) => processKeywordJob(job, browser ?? undefined).catch(() => {})),
        );
      } finally {
        await browser?.close().catch(() => {});
      }
    })());
  }

  if (triggered.length === 0) {
    return NextResponse.json({
      message: deferred > 0
        ? `At concurrency cap (${MAX_CONCURRENT_KEYWORD_JOBS}) — ${deferred} keyword(s) deferred to next tick`
        : "Nothing to process",
    });
  }

  return NextResponse.json({ triggered, deferred });
}

export const GET  = handleCron;
export const POST = handleCron;
