import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessKeyword, hasFullKeywordAccess } from "@/lib/keywords/access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  const userId = (session.user as unknown as Record<string, unknown>)?.id as string;
  if (!hasFullKeywordAccess(role) && role !== "team_lead") {
    if (!(await canAccessKeyword({ id: userId, role }, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const jobs = await prisma.scrapingJob.findMany({
    where: { keywordId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      location: true,
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
