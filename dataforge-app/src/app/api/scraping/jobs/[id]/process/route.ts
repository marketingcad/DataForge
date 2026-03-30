import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getJobById, updateJobStatus, incrementJobMetric } from "@/lib/scraping/jobs/service";
import { discoverBusinesses } from "@/lib/scraping/google/discovery";
import { scrapeWebsite } from "@/lib/scraping/crawler/web-scraper";
import { insertLead } from "@/lib/leads/service";
import { processKeywordJob } from "@/lib/scraping/jobs/processor";

export const maxDuration = 300;

const CHUNK_SIZE = 5;

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

  if (job.status === "running") {
    return NextResponse.json({ status: "running", message: "Job already running" });
  }

  // ── Keyword job: browser-based Google Maps scraping ───────────────────────
  if (job.keywordId) {
    waitUntil(processKeywordJob(job));
    return NextResponse.json({ status: "started" }, { status: 202 });
  }

  // ── Standard SerpAPI job ──────────────────────────────────────────────────
  return await processStandardJob(id, job);
}

// ─── Standard SerpAPI job ─────────────────────────────────────────────────────

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
