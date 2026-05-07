import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/leads/geocode";
import { auth } from "@/lib/auth";

// Nominatim allows 1 req/sec — we batch with a delay between each
const DELAY_MS = 1100;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin", "dev"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leads = await prisma.lead.findMany({
    where: { latitude: null },
    select: { id: true, address: true, city: true, state: true, country: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    const coords = await geocodeAddress({
      address: lead.address,
      city: lead.city,
      state: lead.state,
      country: lead.country,
    });

    if (coords) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { latitude: coords.latitude, longitude: coords.longitude },
      });
      updated++;
    } else {
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  return NextResponse.json({ total: leads.length, updated, skipped });
}
