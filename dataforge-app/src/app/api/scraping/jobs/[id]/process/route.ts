import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJobById, updateJobStatus, incrementJobMetric } from "@/lib/scraping/jobs/service";
import { discoverBusinesses } from "@/lib/scraping/google/discovery";
import { scrapeWebsite } from "@/lib/scraping/crawler/web-scraper";
import { scrapeGoogleMapsHeadless } from "@/lib/scraping/google/maps-scraper";
import { insertLead } from "@/lib/leads/service";
import { normalizePhone, normalizeWebsite } from "@/lib/utils/normalize";
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

  // ── Pre-fetch existing leads for duplicate skipping (runs once before scraping) ─
  const existingLeads = await prisma.lead.findMany({ select: { businessName: true, phone: true, website: true } });
  // Name cache — checked before clicking any panel (saves 2–6 s per skipped business)
  const skipNames     = new Set(existingLeads.map(l => l.businessName.toLowerCase().trim()));
  // Phone/website sets — fallback for businesses whose name differs slightly
  const knownPhones   = new Set(existingLeads.map(l => l.phone).filter(Boolean));
  const knownWebsites = new Set(existingLeads.map(l => l.website).filter(Boolean));
  const isDuplicate = (lead: import("@/lib/scraping/google/maps-scraper").SerpLead): boolean => {
    if (lead.phone) {
      const p = normalizePhone(lead.phone);
      if (p && knownPhones.has(p)) return true;
    }
    if (lead.website) {
      const w = normalizeWebsite(lead.website);
      if (w && knownWebsites.has(w)) return true;
    }
    return false;
  };

  const collectedLeads: Awaited<ReturnType<typeof scrapeGoogleMapsHeadless>> = [];
  let savedCount = 0;
  let dupCount   = 0;
  let lastLogMsg = "";

  let leads: Awaited<ReturnType<typeof scrapeGoogleMapsHeadless>>;
  try {
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
        // Every 3 leads, check if the user cancelled — if so, throw to stop the scraper
        // and let the catch block save whatever was already collected.
        if (count % 3 === 0) {
          const cur = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
          if (cur?.status !== "running") throw new Error("__CANCELLED__");
        }

        collectedLeads.push(lead);
        let wasDuplicate = false;
        try {
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
            keywordId:    job.keywordId ?? undefined,
          });
          if (result.status === "duplicate") {
            dupCount++;
            wasDuplicate = true;
            collectedLeads.pop();
          } else {
            savedCount++;
          }
        } catch { /* ignore per-lead insert errors */ }

        prisma.scrapingJob.update({
          where: { id },
          data: {
            leadsDiscovered: count,
            leadsProcessed:  savedCount,
            duplicatesFound: dupCount,
            pendingLeads:    collectedLeads as never,
          },
        }).catch(() => {});

        if (wasDuplicate) return false;
      },
      MAX_SCRAPE_MS,
      isDuplicate,
      skipNames
    );
  } catch (err) {
    const errorMsg    = err instanceof Error ? err.message : "Browser scrape failed";
    const wasCancelled = errorMsg === "__CANCELLED__";
    await prisma.scrapingJob.update({
      where: { id },
      data: {
        status:          savedCount > 0 ? "completed" : "failed",
        completedTime:   new Date(),
        leadsProcessed:  savedCount,
        duplicatesFound: dupCount,
        errorMessage:    savedCount > 0 ? null : (wasCancelled ? "Stopped by user" : errorMsg),
      },
    });
    if (savedCount > 0) {
      try {
        const kw = await getKeywordById(job.keywordId!);
        await onKeywordJobSuccess(kw.id, kw.intervalHours);
      } catch { /* keyword may have been deleted */ }
    } else if (!wasCancelled) {
      // Only record a failure if this was an actual error, not a user stop
      await handleKeywordFailure(job.keywordId!, errorMsg);
    }
    return NextResponse.json(savedCount > 0
      ? { status: "completed", saved: savedCount }
      : { status: "failed", error: wasCancelled ? "Stopped by user" : errorMsg }
    );
  }

  // Skip final write if job was cancelled externally
  const currentStatus = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
  if (currentStatus?.status !== "running") {
    return NextResponse.json({ status: currentStatus?.status ?? "failed" });
  }

  const finalLeads = leads.length > 0 ? leads : collectedLeads;
  await prisma.scrapingJob.update({
    where: { id },
    data: {
      status:          "completed",
      completedTime:   new Date(),
      leadsDiscovered: finalLeads.length,
      leadsProcessed:  savedCount,
      duplicatesFound: dupCount,
      pendingLeads:    finalLeads.length > 0 ? (finalLeads as never) : (null as never),
      errorMessage:    finalLeads.length > 0 ? null : (lastLogMsg || "No leads found"),
    },
  });

  try {
    const kw = await getKeywordById(job.keywordId!);
    await onKeywordJobSuccess(kw.id, kw.intervalHours);
  } catch { /* keyword may have been deleted */ }

  return NextResponse.json({ status: "completed", saved: savedCount });
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
