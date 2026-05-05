import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GHL_BASE = "https://services.leadconnectorhq.com";

function hdrs(key: string) {
  return { Authorization: `Bearer ${key}`, Version: "2021-07-28", "Content-Type": "application/json" };
}

async function ghlGet(url: string, key: string) {
  try {
    const res = await fetch(url, { headers: hdrs(key), signal: AbortSignal.timeout(12_000) });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: {}, error: String(e) };
  }
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.ghlApiKey || !settings?.ghlLocationId) {
    return NextResponse.json({ error: "Missing GHL API key or location ID" }, { status: 400 });
  }

  const { ghlLocationId } = settings;
  const calKey = settings.ghlSubAccountApiKey ?? settings.ghlApiKey;

  // ── Step 1: get calendars ──
  const calRes = await ghlGet(`${GHL_BASE}/calendars/?locationId=${ghlLocationId}`, calKey);
  const calendars = (calRes.body.calendars ?? calRes.body.data ?? []) as Record<string, unknown>[];

  if (calendars.length === 0) {
    return NextResponse.json({ calendarsStatus: calRes.status, error: "No calendars found" });
  }

  // ── Step 2: try both keys on first calendar ──
  const now = Date.now();
  const startTime = now - 90 * 24 * 60 * 60 * 1000;
  const endTime   = now + 90 * 24 * 60 * 60 * 1000;

  const firstCal = calendars[0] as Record<string, unknown>;
  const url = `${GHL_BASE}/calendars/events?calendarId=${firstCal.id}&startTime=${startTime}&endTime=${endTime}`;

  const subRes    = await ghlGet(url, calKey);
  const agencyRes = await ghlGet(url, settings.ghlApiKey);

  const subEvents    = (subRes.body.events    ?? subRes.body.appointments    ?? subRes.body.data    ?? []) as Record<string, unknown>[];
  const agencyEvents = (agencyRes.body.events ?? agencyRes.body.appointments ?? agencyRes.body.data ?? []) as Record<string, unknown>[];

  const workingEvents = agencyEvents.length > 0 ? agencyEvents : subEvents;

  return NextResponse.json({
    calendar: { id: firstCal.id, name: firstCal.name },
    subKeyStatus:    subRes.status,    subKeyEventCount:    subEvents.length,
    agencyKeyStatus: agencyRes.status, agencyKeyEventCount: agencyEvents.length,
    rawEventSample: workingEvents.slice(0, 3),
    diagnosis: agencyRes.status === 403 && subRes.status === 403
      ? "Both keys 403 — add 'calendars/events.readonly' scope to the PIT key in GHL"
      : "Check rawEventSample for field names including 'Booked By Rep'",
  });
}
