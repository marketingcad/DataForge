import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GHL_BASE = "https://services.leadconnectorhq.com";

async function probe(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const contacts = (body.contacts ?? body.data ?? []) as Record<string, unknown>[];
    return {
      status: res.status,
      topLevelKeys: Object.keys(body),
      contactCount: contacts.length,
      sample: contacts.slice(0, 2).map((c) => ({
        id: c.id,
        name: c.name ?? c.firstName,
        assignedTo: c.assignedTo ?? "MISSING",
        tags: c.tags ?? [],
      })),
      errorMsg: body.message ?? body.error ?? null,
      snippet: JSON.stringify(body).slice(0, 500),
    };
  } catch (e) {
    return { status: 0, error: String(e) };
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
    return NextResponse.json({ error: "Missing GHL config" }, { status: 400 });
  }

  const { ghlApiKey, ghlLocationId } = settings;
  const subKey = settings.ghlSubAccountApiKey ?? ghlApiKey;
  const agencyH = { Authorization: `Bearer ${ghlApiKey}`, Version: "2021-07-28", "Content-Type": "application/json" };
  const subH    = { Authorization: `Bearer ${subKey}`,   Version: "2021-07-28", "Content-Type": "application/json" };

  const body = JSON.stringify({
    locationId: ghlLocationId,
    page: 1,
    pageLimit: 5,
    filters: [{ field: "tags", operator: "eq", value: "appointment-booked" }],
  });

  const [postAgency, postSub] = await Promise.all([
    probe(`${GHL_BASE}/contacts/search`, { method: "POST", headers: agencyH, body }),
    probe(`${GHL_BASE}/contacts/search`, { method: "POST", headers: subH, body }),
  ]);

  const inDb = await prisma.ghlBookedContact.count();

  return NextResponse.json({
    locationId: ghlLocationId,
    bookedContactsInDb: inDb,
    probes: {
      "POST contacts/search (agency key)":      postAgency,
      "POST contacts/search (sub-account key)": postSub,
    },
    instruction: "Find status=200 with contactCount > 0",
  });
}
