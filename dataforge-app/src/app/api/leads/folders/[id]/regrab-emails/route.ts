import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/scraping/jobs/service";
import { processFolderEmailRegrabJob } from "@/lib/scraping/jobs/processor";

const ALLOWED_ROLES = ["boss", "admin", "team_lead"];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: folderId } = await params;

  const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { id: true, name: true } });
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  // Don't start a second regrab if one is already running for this folder
  const active = await prisma.scrapingJob.findFirst({
    where: { industry: "folder_email_regrab", location: folderId, status: { in: ["pending", "running"] } },
    select: { id: true },
  });
  if (active) {
    return NextResponse.json({ jobId: active.id, alreadyRunning: true }, { status: 200 });
  }

  // Find eligible leads upfront and store their IDs in pendingLeads
  const leads = await prisma.lead.findMany({
    where: {
      folderId,
      website: { not: null },
      OR: [{ email: null }, { email: "" }],
    },
    select: { id: true },
  });

  if (leads.length === 0) {
    return NextResponse.json({ error: "No leads with missing emails" }, { status: 400 });
  }

  const leadIds = leads.map((l) => l.id);

  const job = await createJob({
    industry: "folder_email_regrab",
    location: folderId,
    maxLeads: leadIds.length,
    source: "manual",
    keywordId: undefined,
  });

  // Attach lead IDs then fetch the complete record to pass to the processor
  const jobWithLeads = await prisma.scrapingJob.update({
    where: { id: job.id },
    data: { pendingLeads: leadIds as never },
  });

  // Start processing directly — avoids the unreliable server-to-server HTTP hop
  waitUntil(processFolderEmailRegrabJob(jobWithLeads));

  return NextResponse.json({ jobId: job.id, folderName: folder.name }, { status: 201 });
}
