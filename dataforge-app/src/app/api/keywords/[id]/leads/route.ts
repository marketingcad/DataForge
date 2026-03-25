import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leads = await prisma.lead.findMany({
    where: { source: { startsWith: `GoogleMaps:keyword_${id}` } },
    orderBy: { dateCollected: "desc" },
    select: {
      id: true,
      businessName: true,
      phone: true,
      email: true,
      website: true,
      address: true,
      city: true,
      state: true,
    },
  });
  return NextResponse.json(leads);
}
