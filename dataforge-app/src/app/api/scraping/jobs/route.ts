import { NextRequest, NextResponse } from "next/server";
import { createJob, getJobs } from "@/lib/scraping/jobs/service";
import { ScrapingJobInputSchema } from "@/types/scraping";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const result = await getJobs({
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
    status: searchParams.get("status") ?? undefined,
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ScrapingJobInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const job = await createJob(parsed.data);
  return NextResponse.json(job, { status: 201 });
}
