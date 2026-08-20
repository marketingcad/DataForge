import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.ghlApiKey || !settings?.ghlLocationId) {
    return NextResponse.json({ error: "No GHL settings" }, { status: 400 });
  }

  const h = { Authorization: `Bearer ${settings.ghlApiKey}`, Version: GHL_VERSION, "Content-Type": "application/json" };
  const loc = settings.ghlLocationId;
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  async function probe(label: string, url: string) {
    const r = await fetch(url, { headers: h });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, keys: Object.keys(body), sample: JSON.stringify(body).slice(0, 600) };
  }

  const [calendars, events, eventsAlt, opportunities, oppSearch] = await Promise.all([
    // List calendars for this location
    probe("calendars", `${GHL_BASE}/calendars/?locationId=${loc}`),
    // Calendar events (appointments)
    probe("calendar-events", `${GHL_BASE}/calendars/events?locationId=${loc}&startTime=${ninetyDaysAgo}&endTime=${now}&limit=5`),
    // Alt events endpoint
    probe("calendar-events-alt", `${GHL_BASE}/calendars/events/appointments?locationId=${loc}&startTime=${ninetyDaysAgo}&endTime=${now}`),
    // Opportunities
    probe("opportunities", `${GHL_BASE}/opportunities/search?location_id=${loc}&limit=5`),
    // Won opportunities
    probe("opportunities-won", `${GHL_BASE}/opportunities/search?location_id=${loc}&status=won&limit=5`),
  ]);

  return NextResponse.json({ calendars, "calendar-events": events, "calendar-events-alt": eventsAlt, opportunities, "opportunities-won": oppSearch });
}
