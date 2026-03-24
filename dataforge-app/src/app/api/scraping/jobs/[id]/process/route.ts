import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJobById, updateJobStatus, incrementJobMetric } from "@/lib/scraping/jobs/service";
import { discoverBusinesses } from "@/lib/scraping/google/discovery";
import { scrapeWebsite } from "@/lib/scraping/crawler/web-scraper";
import { scrapeGoogleMapsHeadless } from "@/lib/scraping/google/maps-scraper";
import { insertLead } from "@/lib/leads/service";
import { onKeywordJobSuccess, onKeywordJobFailure, getKeywordById } from "@/lib/keywords/service";
import { createNotification, createNotificationsForRole } from "@/lib/notifications/service";

export const maxDuration = 300;

const CHUNK_SIZE = 5;
const MAX_KEYWORD_FAILURES = 5;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let job;
  try {
    job = await getJobById(id);
  } catch {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json({ status: job.status, message: "Job already finished" });
  }

  // ── Keyword job: use Playwright browser scraper (same as "Search by Google") ──
  if (job.keywordId) {
    return await processKeywordJob(job);
  }

  // ── Standard SerpAPI job ───────────────────────────────────────────────────
  return await processStandardJob(id, job);
}

// ─── Keyword job: browser-based Google Maps scraping ──────────────────────────

async function processKeywordJob(job: Awaited<ReturnType<typeof getJobById>>) {
  const id = job.id;

  await updateJobStatus(id, "running", { startTime: new Date() });

  let leads: Awaited<ReturnType<typeof scrapeGoogleMapsHeadless>>;
  try {
    leads = await scrapeGoogleMapsHeadless(
      job.industry,
      job.location,
      job.maxLeads,
      (msg) => {
        // Write live status into errorMessage so UI polling can display it
        prisma.scrapingJob.update({
          where: { id },
          data: { errorMessage: msg },
        }).catch(() => {});
      },
      (_lead, count) => {
        // Increment leadsDiscovered live so UI polling shows real-time count
        prisma.scrapingJob.update({
          where: { id },
          data: { leadsDiscovered: count },
        }).catch(() => {});
      }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Browser scrape failed";
    await updateJobStatus(id, "failed", { completedTime: new Date(), errorMessage: errorMsg });
    await handleKeywordFailure(job.keywordId!, errorMsg);
    return NextResponse.json({ status: "failed", error: errorMsg });
  }

  // Store leads as pending buffer — user decides where to save them
  await prisma.scrapingJob.update({
    where: { id },
    data: {
      status:          "completed",
      completedTime:   new Date(),
      leadsDiscovered: leads.length,
      pendingLeads:    leads as never,
      errorMessage:    null, // clear live status log
    },
  });

  // Update keyword schedule on success
  try {
    const kw = await getKeywordById(job.keywordId!);
    await onKeywordJobSuccess(kw.id, kw.intervalHours);
  } catch { /* keyword may have been deleted */ }

  return NextResponse.json({ status: "completed", pending: leads.length });
}

// ─── Standard SerpAPI job (unchanged) ─────────────────────────────────────────

async function processStandardJob(id: string, job: Awaited<ReturnType<typeof getJobById>>) {
  if (job.status === "pending") {
    await updateJobStatus(id, "running", { startTime: new Date() });

    let businesses: Awaited<ReturnType<typeof discoverBusinesses>>;
    try {
      businesses = await discoverBusinesses(job.industry, job.location, job.maxLeads);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Discovery failed";
      await updateJobStatus(id, "failed", { completedTime: new Date(), errorMessage: errorMsg });
      return NextResponse.json({ status: "failed", error: errorMsg });
    }

    await Promise.all(businesses.map(() => incrementJobMetric(id, "leadsDiscovered")));
    job = await getJobById(id);
  }

  const alreadyProcessed = job.leadsProcessed + job.failedRecords;
  let businesses: Awaited<ReturnType<typeof discoverBusinesses>>;
  try {
    businesses = await discoverBusinesses(job.industry, job.location, job.maxLeads);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Discovery failed";
    await updateJobStatus(id, "failed", { completedTime: new Date(), errorMessage: errorMsg });
    return NextResponse.json({ status: "failed", error: errorMsg });
  }

  const chunk = businesses.slice(alreadyProcessed, alreadyProcessed + CHUNK_SIZE);

  for (const biz of chunk) {
    try {
      const scrapedContact = biz.website ? await scrapeWebsite(biz.website) : {};
      const result = await insertLead({
        businessName: biz.businessName,
        phone:        biz.phone ?? scrapedContact.phone ?? "N/A",
        email:        scrapedContact.email,
        website:      biz.website,
        contactPerson: scrapedContact.contactPerson,
        city:         biz.city,
        state:        biz.state,
        category:     job.industry,
        source:       `SerpAPI:job_${id}`,
      });

      if (result.status === "duplicate") {
        await incrementJobMetric(id, "duplicatesFound");
      } else {
        await incrementJobMetric(id, "leadsProcessed");
      }
    } catch {
      await incrementJobMetric(id, "failedRecords");
    }
  }

  const updatedJob = await getJobById(id);
  const totalHandled = updatedJob.leadsProcessed + updatedJob.failedRecords + updatedJob.duplicatesFound;
  const isDone = totalHandled >= updatedJob.leadsDiscovered || chunk.length === 0;

  if (isDone) {
    await updateJobStatus(id, "completed", { completedTime: new Date() });
    return NextResponse.json({ status: "completed" });
  }

  return NextResponse.json({
    status: "partial",
    processed: updatedJob.leadsProcessed,
    remaining: updatedJob.leadsDiscovered - totalHandled,
  });
}

// ─── Keyword failure handler ───────────────────────────────────────────────────

async function handleKeywordFailure(keywordId: string, error: string) {
  try {
    const kw = await getKeywordById(keywordId);
    const { attempts, disabled } = await onKeywordJobFailure(kw.id, error, kw.intervalHours);

    if (disabled) {
      if (kw.createdById) {
        await createNotification({
          userId:  kw.createdById,
          type:    "error",
          title:   "Keyword scraper disabled",
          message: `"${kw.keyword} in ${kw.location}" failed ${MAX_KEYWORD_FAILURES} times and has been disabled. Last error: ${error}`,
          link:    "/scraping",
        });
      }
      await createNotificationsForRole(["boss", "admin"], {
        type:    "error",
        title:   "Keyword scraper disabled",
        message: `Keyword "${kw.keyword} in ${kw.location}" was disabled after ${MAX_KEYWORD_FAILURES} failures. Last error: ${error}`,
        link:    "/scraping",
      });
    } else {
      if (kw.createdById) {
        await createNotification({
          userId:  kw.createdById,
          type:    "warning",
          title:   `Keyword scrape failed (attempt ${attempts}/${MAX_KEYWORD_FAILURES})`,
          message: `"${kw.keyword} in ${kw.location}" failed. Will retry. Error: ${error}`,
          link:    "/scraping",
        });
      }
    }
  } catch { /* keyword may have been deleted */ }
}
