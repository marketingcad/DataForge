import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/scraping/jobs/service";
import { processEmailRegrabJob } from "@/lib/scraping/jobs/processor";

const ALLOWED_ROLES = ["boss", "admin", "team_lead"];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Verify keyword exists
  const kw = await prisma.scrapingKeyword.findUnique({ where: { id }, select: { id: true, location: true } });
  if (!kw) return NextResponse.json({ error: "Keyword not found" }, { status: 404 });

  // Don't start a second regrab if one is already running for this keyword
  const active = await prisma.scrapingJob.findFirst({
    where: { keywordId: id, industry: "email_regrab", status: { in: ["pending", "running"] } },
    select: { id: true },
  });
  if (active) {
    return NextResponse.json({ jobId: active.id, alreadyRunning: true }, { status: 200 });
  }

  // Count eligible leads upfront so maxLeads is meaningful
  const count = await prisma.lead.count({
    where: {
      source: { startsWith: `GoogleMaps:keyword_${id}` },
      website: { not: null },
      OR: [{ email: null }, { email: "" }],
    },
  });

  if (count === 0) {
    return NextResponse.json({ error: "No leads with missing emails" }, { status: 400 });
  }

  const job = await createJob({
    industry: "email_regrab",
    location: kw.location,
    maxLeads: count,
    source: "manual",
    keywordId: id,
  });

  // Start processing directly — avoids the unreliable server-to-server HTTP hop
  waitUntil(processEmailRegrabJob(job));

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
