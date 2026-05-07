import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/leads/geocode";
import { auth } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin", "dev"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    select: { id: true, address: true, city: true, state: true, country: true },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const coords = await geocodeAddress({
    address: lead.address,
    city: lead.city,
    state: lead.state,
    country: lead.country,
  });

  if (!coords) return NextResponse.json({ error: "Could not geocode this address" }, { status: 422 });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { latitude: coords.latitude, longitude: coords.longitude },
  });

  return NextResponse.json({ ...coords });
}
