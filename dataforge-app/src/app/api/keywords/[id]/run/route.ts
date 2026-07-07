import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKeywordById, pickSearchTerm } from "@/lib/keywords/service";
import { createJob } from "@/lib/scraping/jobs/service";
import { canAccessKeyword, hasFullKeywordAccess } from "@/lib/keywords/access";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["boss", "admin", "team_lead", "lead_specialist"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as unknown as Record<string, unknown>)?.id as string;

  const { id } = await params;

  // Lead specialists may only run keywords granted to them.
  if (!hasFullKeywordAccess(role) && role !== "team_lead") {
    if (!(await canAccessKeyword({ id: userId, role }, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let kw;
  try {
    kw = await getKeywordById(id);
  } catch {
    return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
  }

  // Don't start a second job if one is already running or pending for this keyword
  const active = await prisma.scrapingJob.findFirst({
    where: { keywordId: id, status: { in: ["pending", "running"] } },
    select: { id: true },
  });
  if (active) {
    return NextResponse.json({ jobId: active.id, alreadyRunning: true }, { status: 200 });
  }

  const job = await createJob({
    industry: pickSearchTerm(kw),
    location: kw.location,
    maxLeads: kw.maxLeads,
    source: "serpapi",
    keywordId: id,
    // Record who started this manual run so only they (or boss/admin) can stop it.
    startedById: userId,
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
