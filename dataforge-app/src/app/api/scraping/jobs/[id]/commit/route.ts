import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { insertLead } from "@/lib/leads/service";
import type { SerpLead } from "@/lib/scraping/google/maps-scraper";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { folderId, category } = await req.json();

  const job = await prisma.scrapingJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const pending = (job.pendingLeads ?? []) as unknown as SerpLead[];
  if (pending.length === 0) {
    return NextResponse.json({ saved: 0, duplicates: 0, failed: 0 });
  }

  let saved = 0, duplicates = 0, failed = 0;

  for (const lead of pending) {
    try {
      const result = await insertLead({
        businessName:  lead.businessName,
        phone:         lead.phone ?? "N/A",
        email:         lead.email,
        website:       lead.website,
        address:       lead.address,
        city:          lead.city,
        state:         lead.state,
        category:      category ?? job.industry,
        source:        `GoogleMaps:keyword_${job.keywordId}`,
        folderId:      folderId ?? undefined,
      });

      if (result.status === "duplicate") duplicates++;
      else saved++;
    } catch {
      failed++;
    }
  }

  // Clear the pending buffer and record final metrics
  await prisma.scrapingJob.update({
    where: { id },
    data: {
      pendingLeads:    null,
      leadsProcessed:  saved,
      duplicatesFound: duplicates,
      failedRecords:   failed,
    },
  });

  return NextResponse.json({ saved, duplicates, failed });
}
