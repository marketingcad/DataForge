import { NextRequest, NextResponse } from "next/server";
import { getJobById, updateJobStatus, incrementJobMetric } from "@/lib/scraping/jobs/service";
import { discoverBusinesses } from "@/lib/scraping/google/discovery";
import { scrapeWebsite } from "@/lib/scraping/crawler/web-scraper";
import { insertLead } from "@/lib/leads/service";

export const maxDuration = 60;

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

  // Start job on first invocation
  if (job.status === "pending") {
    await updateJobStatus(id, "running", { startTime: new Date() });

    // Discovery phase
    const businesses = await discoverBusinesses(job.industry, job.location, job.maxLeads);
    await Promise.all(
      businesses.map(() => incrementJobMetric(id, "leadsDiscovered"))
    );

    // Store discovered count and process first chunk
    job = await getJobById(id);
  }

  // Process next chunk
  const alreadyProcessed = job.leadsProcessed + job.failedRecords;
  const businesses = await discoverBusinesses(job.industry, job.location, job.maxLeads);
  const chunk = businesses.slice(alreadyProcessed, alreadyProcessed + CHUNK_SIZE);

  for (const biz of chunk) {
    try {
      const scrapedContact = biz.website ? await scrapeWebsite(biz.website) : {};

      const result = await insertLead({
        businessName: biz.businessName,
        phone: biz.phone ?? scrapedContact.phone ?? "N/A",
        email: scrapedContact.email,
        website: biz.website,
        contactPerson: scrapedContact.contactPerson,
        city: biz.city,
        state: biz.state,
        category: job.industry,
        source: `SerpAPI:job_${id}`,
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

  return NextResponse.json({ status: "partial", processed: updatedJob.leadsProcessed, remaining: updatedJob.leadsDiscovered - totalHandled });
}
