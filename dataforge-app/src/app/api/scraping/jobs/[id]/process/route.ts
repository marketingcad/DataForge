import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJobById, updateJobStatus, incrementJobMetric } from "@/lib/scraping/jobs/service";
import { discoverBusinesses } from "@/lib/scraping/google/discovery";
import { scrapeWebsite } from "@/lib/scraping/crawler/web-scraper";
import { scrapeGoogleMapsHeadless } from "@/lib/scraping/google/maps-scraper";
import { insertLead } from "@/lib/leads/service";
import { onKeywordJobSuccess, onKeywordJobFailure, getKeywordById } from "@/lib/keywords/service";
import { createNotification, createNotificationsForRole } from "@/lib/notifications/service";

export const maxDuration = 300; // 5 minutes (hobby plan max)

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

  // Auto-commit leads directly to the DB as they are found so runs are
  // incremental — each run adds NEW leads and skips duplicates automatically.
  let savedCount = 0;
  let duplicateCount = 0;
  let lastLogMsg = "";

  let leads: Awaited<ReturnType<typeof scrapeGoogleMapsHeadless>>;
  try {
    // Leave 30s buffer before the 5 min hard limit for final DB writes
    const MAX_SCRAPE_MS = 270 * 1000;
    leads = await scrapeGoogleMapsHeadless(
      job.industry,
      job.location,
      job.maxLeads,
      (msg) => {
        lastLogMsg = msg;
        prisma.scrapingJob.update({
          where: { id },
          data: { errorMessage: msg },
        }).catch(() => {});
      },
      async (lead: import("@/lib/scraping/google/maps-scraper").SerpLead, count: number) => {
        // Insert lead immediately — dedup logic in insertLead skips existing ones
        const result = await insertLead({
          businessName: lead.businessName,
          phone:        lead.phone ?? "N/A",
          email:        lead.email,
          website:      lead.website,
          address:      lead.address,
          city:         lead.city,
          state:        lead.state,
          category:     job.industry,
          source:       `GoogleMaps:keyword_${job.keywordId}`,
        }).catch(() => null);

        if (result?.status === "created") savedCount++;
        else if (result?.status === "duplicate") duplicateCount++;

        await prisma.scrapingJob.update({
          where: { id },
          data: {
            leadsDiscovered: count,
            leadsProcessed:  savedCount,
            duplicatesFound: duplicateCount,
          },
        }).catch(() => {});
      },
      MAX_SCRAPE_MS
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Browser scrape failed";
    // If some leads were auto-committed before the error, mark as completed
    if (savedCount > 0 || duplicateCount > 0) {
      await prisma.scrapingJob.update({
        where: { id },
        data: {
          status:        "completed",
          completedTime: new Date(),
          errorMessage:  null,
        },
      });
      try {
        const kw = await getKeywordById(job.keywordId!);
        await onKeywordJobSuccess(kw.id, kw.intervalHours);
      } catch { /* keyword may have been deleted */ }
      return NextResponse.json({ status: "completed", saved: savedCount });
    }
    await updateJobStatus(id, "failed", { completedTime: new Date(), errorMessage: errorMsg });
    await handleKeywordFailure(job.keywordId!, errorMsg);
    return NextResponse.json({ status: "failed", error: errorMsg });
  }

  const totalFound = leads.length;
  await prisma.scrapingJob.update({
    where: { id },
    data: {
      status:          "completed",
      completedTime:   new Date(),
      leadsDiscovered: totalFound,
      leadsProcessed:  savedCount,
      duplicatesFound: duplicateCount,
      errorMessage:    totalFound > 0 ? null : (lastLogMsg || "No leads found"),
    },
  });

  try {
    const kw = await getKeywordById(job.keywordId!);
    await onKeywordJobSuccess(kw.id, kw.intervalHours);
  } catch { /* keyword may have been deleted */ }

  return NextResponse.json({ status: "completed", saved: savedCount, duplicates: duplicateCount });
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
