/**
 * Keyword job processor — shared by both the cron route and the /process API route.
 * Extracted so the cron can call processKeywordJob directly via waitUntil,
 * eliminating the unreliable server-to-server HTTP hop.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getJobById, updateJobStatus, createJob } from "@/lib/scraping/jobs/service";
import { scrapeGoogleMapsHeadless } from "@/lib/scraping/google/maps-scraper";
import { insertLead } from "@/lib/leads/service";
import { normalizePhone } from "@/lib/utils/normalize";
import { calculateDataQualityScore } from "@/lib/utils/scoring";
import { onKeywordJobSuccess, onKeywordJobFailure, getKeywordById, pickSearchTerm, resolveRunLocation } from "@/lib/keywords/service";
import { createNotification, createNotificationsForRole } from "@/lib/notifications/service";
import { grabEmailFromWebsite } from "@/lib/scraping/crawler/email-grabber";
import { getSettings } from "@/lib/settings/service";

const MAX_KEYWORD_FAILURES = 5;

// ─── Keyword job: browser-based Google Maps scraping ──────────────────────────

export async function processKeywordJob(
  job: Awaited<ReturnType<typeof getJobById>>,
  // When provided, the scrape runs in its own context inside this shared browser
  // instead of launching a dedicated one. Caller owns the browser's lifecycle.
  sharedBrowser?: import("playwright-core").Browser,
) {
  const id = job.id;
  // Wall-clock start of this invocation. A Vercel function is killed at ~300s, so
  // the whole job (scrape + email grab) must finish before then or it's left
  // frozen at "running". We use this to give the email-grab phase a hard deadline.
  const jobStartMs = Date.now();
  const FN_BUDGET_MS = 285 * 1000; // leave ~15s margin under the 300s function limit

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

  // Collect (leadId, website) pairs for email grabbing after the main loop
  const pendingEmailGrabs: { leadId: string; website: string }[] = [];

  // Fetch the keyword once so we can re-roll extra keywords on retries.
  let kw: Awaited<ReturnType<typeof getKeywordById>> | null = null;
  try { kw = await getKeywordById(job.keywordId!); } catch { /* keyword deleted */ }

  const MAX_RETRIES = 2;
  const MAX_SCRAPE_MS = 200 * 1000;
  // "Boost scraping" setting — shorter delays, faster but higher block risk.
  const boost = (await getSettings().catch(() => null))?.scrapingBoost ?? false;
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
                // Queue email grab — run as a batch after the main loop completes
                if (kw?.grabEmail && lead.website && !lead.email && result.status === "created") {
                  pendingEmailGrabs.push({ leadId: result.id, website: lead.website });
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
        sharedBrowser,
        boost,
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

  // Run email grabs sequentially now that the main loop is done.
  let emailsGrabbed = 0;
  if (pendingEmailGrabs.length > 0) {
    prisma.scrapingJob.updateMany({
      where: { id, status: "running" },
      data: { errorMessage: `Grabbing emails — 0 / ${pendingEmailGrabs.length} done…` },
    }).catch(() => {});

    for (let gi = 0; gi < pendingEmailGrabs.length; gi++) {
      // Check if the user force-stopped during the email grab phase
      const cur = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
      if (cur && cur.status !== "running") { wasCancelled = true; break; }

      // Hard deadline: if we're about to run past the function's time limit, stop
      // grabbing and let the job complete cleanly. Otherwise the function gets
      // killed mid-grab and the job is left frozen at "running" (looks stuck).
      if (Date.now() - jobStartMs > FN_BUDGET_MS) {
        prisma.scrapingJob.updateMany({
          where: { id, status: "running" },
          data: { errorMessage: `Grabbed ${emailsGrabbed}/${pendingEmailGrabs.length} emails — stopped at time limit (rest keep their websites; use Re-grab emails later).` },
        }).catch(() => {});
        break;
      }

      const { leadId, website } = pendingEmailGrabs[gi];
      try {
        // Per-lead hard cap so one slow/hanging site can't stall the whole phase.
        const email = await Promise.race([
          grabEmailFromWebsite(website),
          new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
        ]);
        if (email) {
          // Recalculate score with the newly found email so it reflects the improved completeness
          const existing = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { businessName: true, phone: true, website: true, contactPerson: true, city: true, state: true, category: true, dataQualityScore: true, industriesFoundIn: true },
          });
          if (existing) {
            const newScore = calculateDataQualityScore(
              {
                ...existing,
                email,
                website:       existing.website       ?? undefined,
                contactPerson: existing.contactPerson ?? undefined,
                city:          existing.city          ?? undefined,
                state:         existing.state         ?? undefined,
                category:      existing.category      ?? undefined,
              },
              existing.industriesFoundIn?.length ?? 0
            );
            await prisma.lead.update({
              where: { id: leadId },
              data: { email, dataQualityScore: Math.max(existing.dataQualityScore, newScore) },
            });
          } else {
            await prisma.lead.update({ where: { id: leadId }, data: { email } });
          }
          emailsGrabbed++;
        }
      } catch { /* ignore per-lead failures */ }

      prisma.scrapingJob.updateMany({
        where: { id, status: "running" },
        data: { errorMessage: `Grabbing emails — ${gi + 1} / ${pendingEmailGrabs.length} done…` },
      }).catch(() => {});
    }
  }

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

// ─── Server-side auto-run loop ─────────────────────────────────────────────────
// Keeps scraping a keyword back-to-back while its autoRun flag is on, without
// depending on the cron. Locally (persistent dev server) this loops until the
// user turns it off. On Vercel it loops until the function's time limit, and the
// cron restarts it on the next tick. One loop per keyword per process.
const activeAutoLoops = new Set<string>();

// Global cap on how many auto-run scrapes execute AT ONCE. Each scrape launches
// a Chromium browser holding a heavy Google Maps page in memory, so without this
// gate turning on auto-run for many keywords spawns N browsers at once and can
// exhaust the Node heap (OOM). Extra loops queue here and run as slots free up.
const MAX_CONCURRENT_SCRAPES = Math.max(1, Number(process.env.KEYWORD_SCRAPER_CONCURRENCY) || 3);
let activeScrapes = 0;
const scrapeWaiters: Array<() => void> = [];

function acquireScrapeSlot(): Promise<void> {
  if (activeScrapes < MAX_CONCURRENT_SCRAPES) {
    activeScrapes++;
    return Promise.resolve();
  }
  // Slot is handed directly to the next waiter on release (count stays bounded).
  return new Promise<void>((resolve) => scrapeWaiters.push(resolve));
}

function releaseScrapeSlot() {
  const next = scrapeWaiters.shift();
  if (next) next();          // hand this slot to the next queued scrape
  else activeScrapes--;      // no one waiting → free the slot
}

export async function runKeywordAutoLoop(keywordId: string, startedById?: string) {
  if (activeAutoLoops.has(keywordId)) return; // a loop for this keyword is already running here
  activeAutoLoops.add(keywordId);
  try {
    for (;;) {
      let kw: Awaited<ReturnType<typeof getKeywordById>>;
      try {
        kw = await getKeywordById(keywordId);
      } catch {
        break; // keyword deleted
      }
      if (!kw.autoRun) break; // turned off → stop looping

      // Max-run-time guard (mirrors the cron; essential locally where no cron fires).
      // Force-stop this keyword once it has been auto-running past the configured limit.
      const maxMinutes = (await getSettings().catch(() => null))?.scrapingMaxRunMinutes ?? 0;
      if (maxMinutes > 0 && kw.autoRunStartedAt &&
          Date.now() - new Date(kw.autoRunStartedAt).getTime() > maxMinutes * 60 * 1000) {
        await prisma.scrapingKeyword.update({
          where: { id: keywordId },
          data: { autoRun: false, autoRunStartedAt: null },
        }).catch(() => {});
        const title = "Keyword auto-stopped (time limit)";
        const message = `"${kw.keyword} in ${kw.location}" hit the ${maxMinutes}-minute run limit and auto-run was turned off. Turn it back on to resume.`;
        if (kw.createdById) {
          await createNotification({ userId: kw.createdById, type: "warning", title, message, link: "/scraping" }).catch(() => {});
        }
        await createNotificationsForRole(["boss", "admin"], { type: "warning", title, message, link: "/scraping" }, kw.createdById ?? undefined).catch(() => {});
        break;
      }

      // Don't double-run: skip this iteration if a job is already active for this
      // keyword (e.g. the cron or a manual run started one).
      const active = await prisma.scrapingJob.findFirst({
        where: { keywordId, status: { in: ["pending", "running"] } },
        select: { id: true },
      });
      if (!active) {
        // Wait for a concurrency slot before launching a browser — caps how many
        // auto-run scrapes run simultaneously so we don't OOM the machine.
        await acquireScrapeSlot();
        try {
          const newJob = await createJob({
            industry: pickSearchTerm(kw),
            location: kw.location,
            maxLeads: kw.maxLeads,
            source: "serpapi",
            keywordId,
            startedById,
          });
          await processKeywordJob(await getJobById(newJob.id));
        } catch { /* one failed run shouldn't break the loop */ } finally {
          releaseScrapeSlot();
        }
      }

      // Brief pause so DB writes settle and we don't hammer in a tight loop.
      await new Promise((r) => setTimeout(r, 1500));
    }
  } finally {
    activeAutoLoops.delete(keywordId);
  }
}

// ─── Email re-grab job ────────────────────────────────────────────────────────

export async function processEmailRegrabJob(job: Awaited<ReturnType<typeof getJobById>>) {
  const id = job.id;

  try {
  // Guard: if cancelled before we even started, mark done immediately
  const precheck = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
  if (precheck && precheck.status === "paused") {
    await prisma.scrapingJob.update({ where: { id }, data: { status: "completed", completedTime: new Date(), errorMessage: "Stopped before start" } });
    return;
  }
  await updateJobStatus(id, "running", { startTime: new Date() });

  // Fetch only id + website — the minimum needed to attempt an email grab.
  // Full scoring fields are fetched on-demand only for leads where an email is actually found.
  const leads = await prisma.lead.findMany({
    where: {
      source: { startsWith: `GoogleMaps:keyword_${job.keywordId}` },
      website: { not: null },
      OR: [{ email: null }, { email: "" }],
    },
    select: { id: true, website: true },
  });

  const total = leads.length;

  await prisma.scrapingJob.update({
    where: { id },
    data: { leadsDiscovered: total, errorMessage: `Re-grabbing emails — 0 / ${total} done… ✅ 0 grabbed · ❌ 0 not found` },
  });

  let grabbed = 0;
  let notFound = 0;

  for (let i = 0; i < leads.length; i++) {
    // Check for cancellation before each lead
    const cur = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
    if (cur && cur.status !== "running") {
      await prisma.scrapingJob.update({
        where: { id },
        data: { status: "completed", completedTime: new Date(),
                leadsProcessed: grabbed,
                errorMessage: `Stopped — ✅ ${grabbed} grabbed · ❌ ${notFound} not found (out of ${i} visited)` },
      });
      return;
    }

    const lead = leads[i];
    try {
      const email = await Promise.race([
        grabEmailFromWebsite(lead.website!),
        new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
      ]);
      if (email) {
        const full = await prisma.lead.findUnique({
          where: { id: lead.id },
          select: { dataQualityScore: true, industriesFoundIn: true,
                    businessName: true, phone: true, contactPerson: true,
                    city: true, state: true, category: true },
        });
        const newScore = full ? calculateDataQualityScore(
          {
            businessName:  full.businessName,
            phone:         full.phone,
            email,
            website:       lead.website       ?? undefined,
            contactPerson: full.contactPerson ?? undefined,
            city:          full.city          ?? undefined,
            state:         full.state         ?? undefined,
            category:      full.category      ?? undefined,
          },
          full.industriesFoundIn?.length ?? 0
        ) : 0;
        await prisma.lead.update({
          where: { id: lead.id },
          data: { email, dataQualityScore: full ? Math.max(full.dataQualityScore, newScore) : newScore },
        });
        grabbed++;
      } else {
        notFound++;
      }
    } catch { notFound++; }

    await prisma.scrapingJob.update({
      where: { id },
      data: { leadsProcessed: grabbed, errorMessage: `Re-grabbing emails — ${i + 1} / ${total} done… ✅ ${grabbed} grabbed · ❌ ${notFound} not found` },
    });
  }

  await prisma.scrapingJob.update({
    where: { id },
    data: {
      status: "completed",
      completedTime: new Date(),
      leadsProcessed: grabbed,
      errorMessage: `Done — ✅ ${grabbed} grabbed · ❌ ${notFound} not found (out of ${total} leads)`,
    },
  });

  revalidatePath("/leads");
  revalidatePath("/scraping");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await prisma.scrapingJob.update({
      where: { id },
      data: { status: "failed", completedTime: new Date(), errorMessage: `Re-grab failed: ${msg}` },
    }).catch(() => null);
  }
}

export async function processFolderEmailRegrabJob(job: Awaited<ReturnType<typeof getJobById>>) {
  const id = job.id;

  try {
  const precheck = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
  if (precheck && precheck.status === "paused") {
    await prisma.scrapingJob.update({ where: { id }, data: { status: "completed", completedTime: new Date(), errorMessage: "Stopped before start" } });
    return;
  }
  await updateJobStatus(id, "running", { startTime: new Date() });

  // Lead IDs were stored at job creation time in pendingLeads
  const leadIds: string[] = Array.isArray(job.pendingLeads) ? (job.pendingLeads as string[]) : [];

  if (leadIds.length === 0) {
    await updateJobStatus(id, "completed", {
      completedTime: new Date(),
      errorMessage: "No eligible leads found.",
    });
    return;
  }

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, website: true },
  });

  const total = leads.length;

  await prisma.scrapingJob.update({
    where: { id },
    data: { leadsDiscovered: total, errorMessage: `Re-grabbing emails — 0 / ${total} done… ✅ 0 grabbed · ❌ 0 not found` },
  });

  let grabbed = 0;
  let notFound = 0;

  for (let i = 0; i < leads.length; i++) {
    const cur = await prisma.scrapingJob.findUnique({ where: { id }, select: { status: true } });
    if (cur && cur.status !== "running") {
      await prisma.scrapingJob.update({
        where: { id },
        data: { status: "completed", completedTime: new Date(),
                leadsProcessed: grabbed,
                errorMessage: `Stopped — ✅ ${grabbed} grabbed · ❌ ${notFound} not found (out of ${i} visited)` },
      });
      return;
    }

    const lead = leads[i];
    try {
      const email = await Promise.race([
        grabEmailFromWebsite(lead.website!),
        new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
      ]);
      if (email) {
        const full = await prisma.lead.findUnique({
          where: { id: lead.id },
          select: { dataQualityScore: true, industriesFoundIn: true,
                    businessName: true, phone: true, contactPerson: true,
                    city: true, state: true, category: true },
        });
        const newScore = full ? calculateDataQualityScore(
          {
            businessName:  full.businessName,
            phone:         full.phone,
            email,
            website:       lead.website       ?? undefined,
            contactPerson: full.contactPerson ?? undefined,
            city:          full.city          ?? undefined,
            state:         full.state         ?? undefined,
            category:      full.category      ?? undefined,
          },
          full.industriesFoundIn?.length ?? 0
        ) : 0;
        await prisma.lead.update({
          where: { id: lead.id },
          data: { email, dataQualityScore: full ? Math.max(full.dataQualityScore, newScore) : newScore },
        });
        grabbed++;
      } else {
        notFound++;
      }
    } catch { notFound++; }

    await prisma.scrapingJob.update({
      where: { id },
      data: { leadsProcessed: grabbed, errorMessage: `Re-grabbing emails — ${i + 1} / ${total} done… ✅ ${grabbed} grabbed · ❌ ${notFound} not found` },
    });
  }

  await prisma.scrapingJob.update({
    where: { id },
    data: {
      status: "completed",
      completedTime: new Date(),
      leadsProcessed: grabbed,
      errorMessage: `Done — ✅ ${grabbed} grabbed · ❌ ${notFound} not found (out of ${total} leads)`,
    },
  });

  revalidatePath("/leads");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await prisma.scrapingJob.update({
      where: { id },
      data: { status: "failed", completedTime: new Date(), errorMessage: `Re-grab failed: ${msg}` },
    }).catch(() => null);
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
