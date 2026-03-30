/**
 * Keyword job processor — shared by both the cron route and the /process API route.
 * Extracted so the cron can call processKeywordJob directly via waitUntil,
 * eliminating the unreliable server-to-server HTTP hop.
 */

import { prisma } from "@/lib/prisma";
import { getJobById, updateJobStatus } from "@/lib/scraping/jobs/service";
import { scrapeGoogleMapsHeadless } from "@/lib/scraping/google/maps-scraper";
import { insertLead } from "@/lib/leads/service";
import { normalizePhone, normalizeWebsite } from "@/lib/utils/normalize";
import { onKeywordJobSuccess, onKeywordJobFailure, getKeywordById } from "@/lib/keywords/service";
import { createNotification, createNotificationsForRole } from "@/lib/notifications/service";

const MAX_KEYWORD_FAILURES = 5;

// ─── Keyword job: browser-based Google Maps scraping ──────────────────────────

export async function processKeywordJob(job: Awaited<ReturnType<typeof getJobById>>) {
  const id = job.id;

  await updateJobStatus(id, "running", { startTime: new Date() });

  // ── Pre-fetch existing leads for duplicate skipping (runs once before scraping) ─
  const existingLeads = await prisma.lead.findMany({ select: { businessName: true, phone: true, website: true } });
  const skipNames     = new Set(existingLeads.map(l => l.businessName.toLowerCase().trim()));
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
        await insertChain;

        if (count > job.maxLeads) throw new Error("__LIMIT_REACHED__");

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
    const errorMsg        = err instanceof Error ? err.message : "Browser scrape failed";
    const wasCancelled    = errorMsg === "__CANCELLED__";
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
    return;
  }

  // Skip final write if job was cancelled externally
  const currentStatus = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
  if (currentStatus?.status !== "running") return;

  await insertChain;
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
}

// ─── Keyword success notifier ─────────────────────────────────────────────────

export async function notifyKeywordSuccess(
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

export async function handleKeywordFailure(keywordId: string, error: string) {
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
