import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grabEmailFromWebsite } from "@/lib/scraping/crawler/email-grabber";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, website: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.website) return NextResponse.json({ error: "No website to scrape" }, { status: 400 });

  const email = await grabEmailFromWebsite(lead.website);
  if (!email) return NextResponse.json({ found: false });

  await prisma.lead.update({ where: { id }, data: { email } });
  return NextResponse.json({ found: true, email });
}
