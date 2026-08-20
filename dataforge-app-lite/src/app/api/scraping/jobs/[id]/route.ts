import { NextRequest, NextResponse } from "next/server";
import { getJobById, updateJobStatus } from "@/lib/scraping/jobs/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await getJobById(id);
  return NextResponse.json(job);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();
  if (!["paused", "pending", "failed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const job = await updateJobStatus(id, status);
  return NextResponse.json(job);
}
