/**
 * Keyword job processor — shared by both the cron route and the /process API route.
 * Extracted so the cron can call processKeywordJob directly via waitUntil,
 * eliminating the unreliable server-to-server HTTP hop.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getJobById, updateJobStatus } from "@/lib/scraping/jobs/service";
import { scrapeGoogleMapsHeadless } from "@/lib/scraping/google/maps-scraper";
import { insertLead } from "@/lib/leads/service";
import { normalizePhone } from "@/lib/utils/normalize";
import { onKeywordJobSuccess, onKeywordJobFailure, getKeywordById, pickSearchTerm, resolveRunLocation } from "@/lib/keywords/service";
import { createNotification, createNotificationsForRole } from "@/lib/notifications/service";

const MAX_KEYWORD_FAILURES = 5;

// Words that appear in almost every US location string — not useful for matching.
const GENERIC_LOCATION_WORDS = new Set(["usa", "us", "united states", "canada", "united kingdom", "uk"]);

/**
 * Returns true if the scraped lead belongs to the keyword's configured location.
 * Prevents leads from other states/countries slipping through Google Maps results.
 *
 * Uses kw.location (the original configured value, e.g. "IL, USA") rather than
 * runLocation (a rotated city like "Chicago, IL, USA") so that a state-wide
 * keyword accepts any city in that state, not just the rotated one.
 */
function leadMatchesLocation(
  lead: { city?: string; state?: string; address?: string },
  kwLocation: string,
): boolean {
  const parts = kwLocation.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  // Keep only the meaningful parts — drop generic country labels
  const significant = parts.filter((p) => p.length > 1 && !GENERIC_LOCATION_WORDS.has(p));
  if (significant.length === 0) return true;

  const leadState   = (lead.state   ?? "").toLowerCase().trim();
  const leadCity    = (lead.city    ?? "").toLowerCase().trim();
  const leadAddress = (lead.address ?? "").toLowerCase();

  // Every significant part must appear somewhere in the lead's location fields.
  for (const part of significant) {
    const inState   = !!leadState   && (leadState === part   || leadState.includes(part)   || part.includes(leadState));
    const inCity    = !!leadCity    && (leadCity  === part   || leadCity.includes(part)    || part.includes(leadCity));
    const inAddress = leadAddress.includes(part);
    if (!inState && !inCity && !inAddress) return false;
  }
  return true;
}

// ─── Keyword job: browser-based Google Maps scraping ──────────────────────────

export async function processKeywordJob(job: Awaited<ReturnType<typeof getJobById>>) {
  const id = job.id;

  await updateJobStatus(id, "running", { startTime: new Date() });

  // ── Periodic cancellation poll ─────────────────────────────────────────────────
  // The DB status is set to "paused" by the cancel API. We poll every 5 s so the
  // scraper stops promptly even if it's stuck between leads (not inside onLead).
  let cancelledFlag = false;
  const cancelPoll = setInterval(async () => {
    try {
      const cur = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
      if (cur && cur.status !== "running") cancelledFlag = true;
    } catch { /* ignore transient DB errors */ }
  }, 5_000);

  // ── Pre-fetch existing leads for duplicate skipping (runs once before scraping) ─
  // Uniqueness: phone number OR business name (case-insensitive). Website/email excluded.
  const existingLeads = await prisma.lead.findMany({ select: { businessName: true, phone: true } });
  const skipNames   = new Set(existingLeads.map(l => l.businessName.toLowerCase().trim()));
  const knownPhones = new Set(existingLeads.map(l => l.phone).filter(Boolean));
  const isDuplicate = (lead: import("@/lib/scraping/google/maps-scraper").SerpLead): boolean => {
    if (lead.phone) {
      const p = normalizePhone(lead.phone);
      if (p && knownPhones.has(p)) return true;
    }
    if (lead.businessName && skipNames.has(lead.businessName.toLowerCase().trim())) return true;
    return false;
  };

  const collectedLeads: Awaited<ReturnType<typeof scrapeGoogleMapsHeadless>> = [];
  let savedCount = 0;
  let dupCount        = 0;
  let insertFailures  = 0;
  let firstInsertError: string | null = null;
  let insertChain: Promise<void> = Promise.resolve();

  // Fetch the keyword once so we can re-roll extra keywords on retries.
  let kw: Awaited<ReturnType<typeof getKeywordById>> | null = null;
  try { kw = await getKeywordById(job.keywordId!); } catch { /* keyword deleted */ }

  const MAX_RETRIES = 2;
  const MAX_SCRAPE_MS = 270 * 1000;
  let wasCancelled = false;
  let fatalError: string | null = null;
  let leads: Awaited<ReturnType<typeof scrapeGoogleMapsHeadless>> = [];

  // Resolve the city once for the whole run (retries stay on the same city)
  const { location: runLocation, coords: runCoords } = kw
    ? resolveRunLocation(kw)
    : { location: job.location, coords: undefined };

  // Record the resolved city in the job so it shows in run history
  prisma.scrapingJob.update({
    where: { id },
    data: { location: runLocation },
  }).catch(() => {});

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (cancelledFlag) { wasCancelled = true; break; }
    if (savedCount >= job.maxLeads) break;

    // On retries, re-roll extra keywords for a different search term.
    const searchTerm = (attempt === 0 || !kw) ? job.industry : pickSearchTerm(kw);
    const remaining  = job.maxLeads - savedCount;

    if (attempt > 0) {
      prisma.scrapingJob.updateMany({
        where: { id, status: "running" },
        data: { errorMessage: `Retry ${attempt}/${MAX_RETRIES} — got ${savedCount}/${job.maxLeads} leads, trying "${searchTerm}"…` },
      }).catch(() => {});
    }

    let hitLimit = false;
    try {
      const attemptLeads = await scrapeGoogleMapsHeadless(
        searchTerm,
        runLocation,
        remaining,
        (msg) => {
          prisma.scrapingJob.updateMany({
            where: { id, status: "running" },
            data: { errorMessage: attempt > 0 ? `[Retry ${attempt}/${MAX_RETRIES}] ${msg}` : msg },
          }).catch(() => {});
        },
        async (lead: import("@/lib/scraping/google/maps-scraper").SerpLead, count: number) => {
          await insertChain;
          if (cancelledFlag) throw new Error("__CANCELLED__");

          // Skip leads whose location doesn't match the keyword's configured location
          if (kw && !leadMatchesLocation(lead, kw.location)) return;

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
                if (lead.businessName) skipNames.add(lead.businessName.toLowerCase().trim());
                if (lead.phone) {
                  const p = normalizePhone(lead.phone);
                  if (p) knownPhones.add(p);
                }
              }
            } catch (insertErr) {
              insertFailures++;
              if (!firstInsertError) {
                firstInsertError = insertErr instanceof Error
                  ? insertErr.message
                  : String(insertErr);
              }
            }

            prisma.scrapingJob.updateMany({
              where: { id, status: "running" },
              data: {
                leadsDiscovered: collectedLeads.length,
                leadsProcessed:  savedCount,
                duplicatesFound: dupCount,
              },
            }).catch(() => {});
          }).catch(() => {});
        },
        MAX_SCRAPE_MS,
        isDuplicate,
        skipNames,
        () => cancelledFlag,
        runCoords,
      );
      leads = [...leads, ...attemptLeads];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Browser scrape failed";
      if (msg === "__CANCELLED__" || cancelledFlag) { wasCancelled = true; }
      else if (msg !== "__LIMIT_REACHED__") { fatalError = msg; }
      else { hitLimit = true; }
    }

    // Always flush inserts before deciding whether to retry
    await insertChain;

    if (wasCancelled) break;
    if (hitLimit || savedCount >= job.maxLeads) break;

    // Log retry decision
    if (attempt < MAX_RETRIES) {
      prisma.scrapingJob.updateMany({
        where: { id, status: "running" },
        data: { errorMessage: `Got ${savedCount}/${job.maxLeads} leads — starting retry ${attempt + 1}/${MAX_RETRIES} with new keywords…` },
      }).catch(() => {});
    }
  }

  clearInterval(cancelPoll);
  await insertChain;

  if (wasCancelled || cancelledFlag) {
    const currentStatus = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
    if (currentStatus?.status !== "running") return;
    await prisma.scrapingJob.update({
      where: { id },
      data: {
        status:         "completed",
        completedTime:  new Date(),
        leadsProcessed: savedCount,
        duplicatesFound: dupCount,
        errorMessage:   `Stopped by user — ${savedCount} saved so far`,
      },
    });
    return;
  }

  const currentStatus = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
  if (currentStatus?.status !== "running") return;

  const isSuccess = savedCount > 0 || dupCount > 0;
  const finalLeads = leads.length > 0 ? leads : collectedLeads;

  let completionMsg: string;
  if (savedCount > 0) {
    completionMsg = `Done — ${savedCount} new${dupCount > 0 ? `, ${dupCount} duplicates` : ""}`;
    if (savedCount < job.maxLeads) completionMsg += ` (${MAX_RETRIES} retries — could not reach ${job.maxLeads})`;
    if (insertFailures > 0) completionMsg += ` ⚠ ${insertFailures} failed: ${firstInsertError}`;
  } else if (dupCount > 0) {
    completionMsg = `No new leads — ${dupCount} duplicates${insertFailures > 0 ? ` ⚠ ${insertFailures} failed: ${firstInsertError}` : ""}`;
  } else if (fatalError) {
    completionMsg = fatalError;
  } else if (insertFailures > 0) {
    completionMsg = `⚠ All ${insertFailures} inserts failed: ${firstInsertError}`;
  } else {
    completionMsg = "No leads found after retries — try a different location or keyword";
  }

  await prisma.scrapingJob.update({
    where: { id },
    data: {
      status:          isSuccess ? "completed" : "failed",
      completedTime:   new Date(),
      leadsDiscovered: finalLeads.length,
      leadsProcessed:  savedCount,
      duplicatesFound: dupCount,
      pendingLeads:    finalLeads.length > 0 ? (finalLeads as never) : (null as never),
      errorMessage:    completionMsg,
    },
  });

  revalidatePath("/leads");
  revalidatePath("/scraping");
  if (isSuccess) {
    try {
      const kwFresh = await getKeywordById(job.keywordId!);
      await onKeywordJobSuccess(kwFresh.id, kwFresh.intervalMinutes);
    } catch { /* keyword may have been deleted */ }
    await notifyKeywordSuccess(job.keywordId!, savedCount, dupCount, finalLeads.length);
  } else {
    await handleKeywordFailure(job.keywordId!, completionMsg);
  }
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
    await createNotificationsForRole(["boss", "admin"], { type, title, message, link: "/scraping" }, kw.createdById ?? undefined);
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
      }, kw.createdById ?? undefined);
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
