import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

/**
 * Debug endpoint — call this to verify the appointment sync chain:
 * 1. What does the appointments endpoint return? (field names, contactId presence)
 * 2. For the first appointment's contactId, what does GET /contacts/{id} return? (is assignedTo present?)
 * 3. Does that assignedTo GHL user ID match a DataForge user?
 *
 * GET /api/ghl/debug-appointments
 */
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

  const { ghlApiKey: apiKey, ghlLocationId: loc } = settings;
  const h = { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION, "Content-Type": "application/json" };

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Step 1: Fetch appointments
  const apptRes = await fetch(
    `${GHL_BASE}/calendars/events/appointments?locationId=${loc}&startTime=${thirtyDaysAgo}&endTime=${now}`,
    { headers: h }
  );
  const apptBody = await apptRes.json().catch(() => ({}));

  const appointments: unknown[] = apptBody.events ?? apptBody.appointments ?? [];
  const firstAppt = appointments[0] as Record<string, unknown> | undefined;

  // Step 2: If we got an appointment with a contactId, fetch that contact
  let contactDebug: Record<string, unknown> | null = null;
  let ownerMatchDebug: Record<string, unknown> | null = null;

  if (firstAppt?.contactId) {
    const contactRes = await fetch(`${GHL_BASE}/contacts/${firstAppt.contactId}`, { headers: h });
    const contactBody = await contactRes.json().catch(() => ({}));
    const contact = contactBody.contact ?? contactBody;
    contactDebug = {
      status: contactRes.status,
      // Show all top-level keys so we can see the exact field name for the owner
      allKeys: Object.keys(contact),
      // Highlight the likely owner fields
      assignedTo: contact.assignedTo,
      owner: contact.owner,
      ownerId: contact.ownerId,
      userId: contact.userId,
      // Full contact for reference (trimmed)
      raw: JSON.stringify(contact).slice(0, 1000),
    };

    // Step 3: Check if assignedTo maps to a DataForge user
    const ghlUserId = contact.assignedTo ?? contact.owner ?? contact.ownerId;
    if (ghlUserId) {
      const linkedUser = await prisma.user.findFirst({
        where: { ghlUserId: String(ghlUserId) },
        select: { id: true, name: true, email: true, role: true, ghlUserId: true },
      });
      ownerMatchDebug = {
        ghlUserIdFromContact: ghlUserId,
        dataForgeMatch: linkedUser ?? "NO MATCH — user not linked or ghlUserId not set",
      };
    } else {
      ownerMatchDebug = { ghlUserIdFromContact: null, note: "No owner field found on contact" };
    }
  }

  // Also show how many DataForge users have ghlUserId linked
  const linkedUsers = await prisma.user.findMany({
    where: { ghlUserId: { not: null } },
    select: { id: true, name: true, email: true, ghlUserId: true, role: true },
  });

  return NextResponse.json({
    step1_appointments: {
      status: apptRes.status,
      responseTopLevelKeys: Object.keys(apptBody),
      totalReturned: appointments.length,
      firstAppointmentKeys: firstAppt ? Object.keys(firstAppt) : [],
      firstAppointment: firstAppt
        ? {
            id: firstAppt.id,
            contactId: firstAppt.contactId,
            // Show all status-related fields
            appoinmentStatus: firstAppt.appoinmentStatus,
            appointmentStatus: firstAppt.appointmentStatus,
            status: firstAppt.status,
            assignedUserId: firstAppt.assignedUserId,
            startTime: firstAppt.startTime,
          }
        : null,
    },
    step2_contact: contactDebug,
    step3_ownerMatch: ownerMatchDebug,
    linkedDataForgeUsers: linkedUsers,
  });
}
