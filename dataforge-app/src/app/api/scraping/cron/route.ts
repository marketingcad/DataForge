import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { createJob, getJobById } from "@/lib/scraping/jobs/service";
import { getDueKeywords, pickSearchTerm, enforceMaxAutoRunTime } from "@/lib/keywords/service";
import { processKeywordJob } from "@/lib/scraping/jobs/processor";
import { launchScraperBrowser } from "@/lib/scraping/crawler/core";
import { createNotification, createNotificationsForRole } from "@/lib/notifications/service";

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

  // Reap zombie jobs. A serverless run can't live past ~300s, so any keyword job
  // still "running"/"pending" but not updated in >3 min was interrupted (function
  // timeout or crash) — the server-side Chromium is already dead, but the DB row
  // is frozen at its last progress text so the UI keeps showing e.g. "grabbing
  // emails 10/16" for a browser that no longer exists. A live job writes progress
  // (a heartbeat) after every lead (≤~40s apart), so >3 min stale reliably means
  // dead. Reaping fast unblocks the keyword and stops the misleading stale text.
  const reaped = await prisma.scrapingJob.updateMany({
    where: {
      keywordId: { not: null },
      status: { in: ["running", "pending"] },
      updatedAt: { lt: new Date(Date.now() - 3 * 60 * 1000) },
    },
    data: {
      status: "failed",
      completedTime: new Date(),
      errorMessage: "Run interrupted (server timeout) — retrying.",
    },
  }).catch(() => ({ count: 0 }));
  if (reaped.count > 0) triggered.push(`reaped:${reaped.count}`);

  // Max-run-time guard: force-stop keywords that have been auto-running longer than
  // the configured limit (auto-run off + live job cancelled). Runs before enqueuing
  // so a just-stopped keyword isn't picked up again this tick.
  const stopped = await enforceMaxAutoRunTime().catch(() => []);
  for (const kw of stopped) {
    triggered.push(`autostop:${kw.id}`);
    const title = "Keyword auto-stopped (time limit)";
    const message = `"${kw.keyword} in ${kw.location}" hit the ${kw.minutes}-minute run limit and auto-run was turned off. Turn it back on to resume.`;
    if (kw.createdById) {
      await createNotification({ userId: kw.createdById, type: "warning", title, message, link: "/scraping" }).catch(() => {});
    }
    await createNotificationsForRole(["boss", "admin"], { type: "warning", title, message, link: "/scraping" }, kw.createdById ?? undefined).catch(() => {});
  }

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
