import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKeywordById } from "@/lib/keywords/service";
import { createJob } from "@/lib/scraping/jobs/service";

const ALLOWED_ROLES = ["boss", "admin", "lead_data_analyst"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let kw;
  try {
    kw = await getKeywordById(id);
  } catch {
    return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
  }

  const job = await createJob({
    industry: kw.keyword,
    location: kw.location,
    maxLeads: kw.maxLeads,
    source: "serpapi",
    keywordId: id,
  });

  // Trigger processing
  const processUrl = `${req.nextUrl.origin}/api/scraping/jobs/${job.id}/process`;
  fetch(processUrl, { method: "POST" }).catch(() => null); // fire and forget

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
