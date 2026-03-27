import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const jobs = await prisma.scrapingJob.findMany({
    where: { keywordId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      leadsDiscovered: true,
      leadsProcessed: true,
      duplicatesFound: true,
      failedRecords: true,
      errorMessage: true,
      maxLeads: true,
      createdAt: true,
      startTime: true,
      completedTime: true,
    },
  });

  return NextResponse.json({ jobs });
}
