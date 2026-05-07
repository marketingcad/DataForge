import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/leads/geocode";
import { auth } from "@/lib/auth";

const DELAY_MS = 1100;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin", "dev"].includes(role ?? "")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const leads = await prisma.lead.findMany({
    where: { latitude: null },
    select: { id: true, address: true, city: true, state: true, country: true },
  });

  const total = leads.length;
  let updated = 0;
  let skipped = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));

      if (total === 0) {
        send({ done: true, total: 0, updated: 0, skipped: 0 });
        controller.close();
        return;
      }

      send({ done: false, total, updated: 0, skipped: 0, current: 0 });

      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
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

        send({ done: false, total, updated, skipped, current: i + 1 });
        await sleep(DELAY_MS);
      }

      send({ done: true, total, updated, skipped, current: total });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
