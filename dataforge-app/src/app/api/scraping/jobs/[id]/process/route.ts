import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
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
    // Return 202 immediately so the caller (cron) doesn't have to wait.
    // waitUntil keeps this function alive until scraping completes even
    // after the response is sent — this is the correct Vercel pattern for
    // long-running background work triggered by a short-lived cron call.
    waitUntil(processKeywordJob(job));
    return NextResponse.json({ status: "started" }, { status: 202 });
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
  // Sequential insert chain: inserts run one at a time in the background so
  // the scraper never waits for a DB round-trip, but only one connection is
  // open at a time so Neon's pool is never exhausted.
  let insertChain: Promise<void> = Promise.resolve();

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
        // Sync with pending inserts so savedCount is accurate before deciding to continue.
        // Each insert takes ~200ms; lead panels take 4-8s — so this is effectively free.
        await insertChain;

        // Stop exactly when the saved limit is reached — not when leads are found.
        // Throws before queueing this lead's insert so it is never saved.
        if (savedCount >= job.maxLeads) throw new Error("__LIMIT_REACHED__");

        // Every 3 leads, check if the user cancelled.
        if (count % 3 === 0) {
          const cur = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
          if (cur?.status !== "running") throw new Error("__CANCELLED__");
        }

        collectedLeads.push(lead);
        insertChain = insertChain.then(async () => {
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
              const idx = collectedLeads.indexOf(lead);
              if (idx !== -1) collectedLeads.splice(idx, 1);
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
        }).catch(() => {});
      },
      MAX_SCRAPE_MS,
      isDuplicate,
      skipNames
    );
  } catch (err) {
    const errorMsg      = err instanceof Error ? err.message : "Browser scrape failed";
    const wasCancelled  = errorMsg === "__CANCELLED__";
    const wasLimitReached = errorMsg === "__LIMIT_REACHED__";
    await insertChain;
    const isSuccess = wasLimitReached || savedCount > 0;
    await prisma.scrapingJob.update({
      where: { id },
      data: {
        status:          isSuccess ? "completed" : "failed",
        completedTime:   new Date(),
        leadsProcessed:  savedCount,
        duplicatesFound: dupCount,
        errorMessage:    isSuccess
          ? `Done — ${savedCount} lead${savedCount !== 1 ? "s" : ""} saved`
          : (wasCancelled ? "Stopped by user" : errorMsg),
      },
    });
    if (isSuccess) {
      try {
        const kw = await getKeywordById(job.keywordId!);
        await onKeywordJobSuccess(kw.id, kw.intervalMinutes);
      } catch { /* keyword may have been deleted */ }
      await notifyKeywordSuccess(job.keywordId!, savedCount, dupCount, collectedLeads.length);
    } else if (!wasCancelled) {
      await handleKeywordFailure(job.keywordId!, errorMsg);
    }
    return NextResponse.json(isSuccess
      ? { status: "completed", saved: savedCount }
      : { status: "failed", error: wasCancelled ? "Stopped by user" : errorMsg }
    );
  }

  // Skip final write if job was cancelled externally
  const currentStatus = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
  if (currentStatus?.status !== "running") {
    return NextResponse.json({ status: currentStatus?.status ?? "failed" });
  }

  await insertChain;
  // savedCount is now final — write the "Done" message here so the UI only
  // sees it when leadsProcessed is accurate (not mid-way through inserts).
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
      errorMessage:    savedCount > 0
        ? `Done — ${savedCount} lead${savedCount !== 1 ? "s" : ""} saved`
        : (lastLogMsg || "No leads found"),
    },
  });

  try {
    const kw = await getKeywordById(job.keywordId!);
    await onKeywordJobSuccess(kw.id, kw.intervalMinutes);
  } catch { /* keyword may have been deleted */ }
  await notifyKeywordSuccess(job.keywordId!, savedCount, dupCount, finalLeads.length);

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

// ─── Keyword success notifier ─────────────────────────────────────────────────

async function notifyKeywordSuccess(
  keywordId: string,
  savedCount: number,
  dupCount: number,
  discovered: number
) {
  try {
    const kw = await getKeywordById(keywordId);
    const label = `"${kw.keyword}" in ${kw.location}`;

    let message: string;
    if (savedCount > 0) {
      message = `${savedCount} new lead${savedCount !== 1 ? "s" : ""} saved`;
      if (dupCount > 0) message += `, ${dupCount} already existed`;
      if (discovered > 0 && discovered < savedCount + dupCount + 5) {
        message += `. Google Maps returned ${discovered} result${discovered !== 1 ? "s" : ""}.`;
      }
    } else if (dupCount > 0) {
      message = `No new leads — all ${dupCount} result${dupCount !== 1 ? "s" : ""} already in your database.`;
    } else {
      message = discovered > 0
        ? `No leads saved — Google Maps returned ${discovered} result${discovered !== 1 ? "s" : ""} but none had contact info.`
        : "No results found on Google Maps for this keyword. Try a more specific city.";
    }

    const type = savedCount > 0 ? "success" : "info";
    const title = savedCount > 0
      ? `Auto scrape done — ${label}`
      : `Auto scrape — no new leads (${label})`;

    if (kw.createdById) {
      await createNotification({ userId: kw.createdById, type, title, message, link: "/scraping" });
    }
    await createNotificationsForRole(["boss", "admin"], { type, title, message, link: "/scraping" });
  } catch { /* keyword may have been deleted */ }
}

// ─── Keyword failure handler ───────────────────────────────────────────────────

async function handleKeywordFailure(keywordId: string, error: string) {
  try {
    const kw = await getKeywordById(keywordId);
    const { attempts, disabled } = await onKeywordJobFailure(kw.id, error, kw.intervalMinutes);

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
