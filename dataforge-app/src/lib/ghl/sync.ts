import { prisma } from "@/lib/prisma";
import { getLocationCallConversations, getConversationCalls, mapGhlCallStatus, getAgentOpportunities, getLocationCalendars, getAppointmentsByCalendar, getContactOwners, getContactById, getContactsByTag } from "@/lib/ghl/client";

async function runBatched<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

async function fetchDurations(
  apiKey: string,
  convIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const BATCH = 10;

  for (let i = 0; i < convIds.length; i += BATCH) {
    const batch = convIds.slice(i, i + BATCH);
    await Promise.all(batch.map(async (id) => {
      try {
        const messages = await getConversationCalls(apiKey, id);
        let best = 0;
        for (const m of messages) {
          const secs  = typeof m.meta?.durationSecs === "number" ? m.meta.durationSecs : 0;
          const fromMs = typeof m.meta?.duration    === "number" ? Math.round(m.meta.duration / 1000) : 0;
          best = Math.max(best, secs, fromMs);
        }
        map.set(id, best);
      } catch {
        map.set(id, 0);
      }
    }));
  }

  return map;
}

export async function autoSyncGhlCalls(
  full = false,
  options?: { startAfterDate?: number; maxPages?: number },
): Promise<{ synced: number; skipped: number; unmatched: number; total: number; noAgents?: boolean; nextCursor?: number }> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.ghlApiKey || !settings?.ghlLocationId) {
    throw new Error("GHL API key and Location ID must be configured in Settings.");
  }

  const dfAgents = await prisma.user.findMany({
    where: { ghlUserId: { not: null } },
    select: { id: true, ghlUserId: true },
  });
  if (dfAgents.length === 0) {
    return { synced: 0, skipped: 0, unmatched: 0, total: 0, noAgents: true };
  }

  const agentByGhlId = new Map(dfAgents.map((a) => [a.ghlUserId!, a.id]));

  const linkedLeads = await prisma.lead.findMany({
    where: { ghlContactId: { not: null } },
    select: { id: true, ghlContactId: true },
  });
  const contactToLeadId = new Map(linkedLeads.map((l) => [l.ghlContactId!, l.id]));

  // Full sync: no since-filter, fetch all pages. Incremental: use last-synced stamp, 5 pages.
  const since = full ? undefined : (settings.ghlCallsLastSyncedAt ?? undefined);
  const maxPages = options?.maxPages ?? (full ? 600 : 5);
  const isBatchedFullSync = full && options?.maxPages !== undefined;

  // For incremental sync: stamp before fetching so concurrent runs don't overlap.
  // For batched full sync: caller manages the timestamp; don't stamp here.
  // For unbatched full sync (legacy): stamp before fetching as before.
  if (!isBatchedFullSync) {
    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: { ghlCallsLastSyncedAt: new Date() },
    });
  }

  const { conversations: callConvs, nextCursor } = await getLocationCallConversations(
    settings.ghlApiKey,
    settings.ghlLocationId,
    since,
    maxPages,
    options?.startAfterDate,
  );

  if (callConvs.length === 0) {
    return { synced: 0, skipped: 0, unmatched: 0, total: 0, nextCursor: nextCursor ?? undefined };
  }

  const convIds = callConvs.map((c) => c.id);
  const existing = await prisma.callLog.findMany({
    where: { ghlMessageId: { in: convIds } },
    select: { ghlMessageId: true, durationSecs: true },
  });
  const existingMap = new Map(existing.map((e) => [e.ghlMessageId, e.durationSecs]));

  const newConvIds = convIds.filter((id) => !existingMap.has(id)).slice(0, 50);
  const durations = await fetchDurations(settings.ghlApiKey, newConvIds);

  let synced = 0;
  let skipped = 0;
  let unmatched = 0;

  await runBatched(callConvs, 25, async (conv) => {
    const dfAgentId = conv.assignedTo ? agentByGhlId.get(conv.assignedTo) : undefined;
    if (!dfAgentId) { unmatched++; return; }

    const ghlMessageId = conv.id;

    if (existingMap.has(ghlMessageId)) { skipped++; return; }

    const rawDate = conv.sort?.[0] ?? conv.lastMessageDate ?? conv.dateUpdated ?? conv.dateAdded;
    const calledAt = rawDate != null
      ? (typeof rawDate === "number" ? new Date(rawDate) : new Date(rawDate))
      : new Date();
    const leadId = conv.contactId ? (contactToLeadId.get(conv.contactId) ?? null) : null;
    const durationSecs = durations.get(ghlMessageId) ?? 0;

    await prisma.callLog.upsert({
      where: { ghlMessageId },
      create: {
        agentId: dfAgentId,
        leadId,
        contactName: conv.contactName ?? null,
        contactPhone: conv.phone ?? null,
        direction: "outbound",
        durationSecs,
        status: mapGhlCallStatus(String(conv.lastMessageType ?? conv.type ?? "")),
        calledAt,
        ghlMessageId,
        notes: "Synced from GHL",
      },
      update: { calledAt, agentId: dfAgentId, leadId, status: mapGhlCallStatus(String(conv.lastMessageType ?? conv.type ?? "")) },
    });
    synced++;
  });

  return { synced, skipped, unmatched, total: callConvs.length, nextCursor: nextCursor ?? undefined };
}

const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "deleted"]);

/**
 * Sync GHL calendar appointments → GhlAppointment table.
 *
 * Strategy:
 *   1. Fetch all calendars for the location
 *   2. Fetch appointments per calendarId (deduplicate by appointment ID)
 *   3. For each appointment, resolve contact.assignedTo (the owner) via batch contact fetch
 *   4. Attribute to contact owner → DataForge agent; fall back to assignedUserId
 */
export async function autoSyncGhlAppointments(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.ghlApiKey || !settings?.ghlLocationId) return;
    const { ghlApiKey, ghlLocationId } = settings;
    const calendarApiKey = settings.ghlSubAccountApiKey ?? ghlApiKey;

    const dfAgents = await prisma.user.findMany({
      where: { ghlUserId: { not: null } },
      select: { id: true, ghlUserId: true },
    });
    if (dfAgents.length === 0) return;
    const agentByGhlId = new Map(dfAgents.map((a) => [a.ghlUserId!, a.id]));

    const linkedLeads = await prisma.lead.findMany({
      where: { ghlContactId: { not: null } },
      select: { id: true, ghlContactId: true },
    });
    const contactToLeadId = new Map(linkedLeads.map((l) => [l.ghlContactId!, l.id]));

    const hasAny = await prisma.ghlAppointment.count();
    const since = hasAny > 0 ? (settings.ghlAppsLastSyncedAt ?? undefined) : undefined;

    // ── Step 1: fetch all calendars for the location ──
    const calendars = await getLocationCalendars(calendarApiKey, ghlLocationId);
    if (calendars.length === 0) {
      console.log("[autoSyncGhlAppointments] no calendars found for location");
      return;
    }

    // ── Step 2: fetch appointments per calendarId, deduplicate by ID ──
    type RawAppt = Record<string, unknown>;
    const seen = new Set<string>();
    const allAppointments: RawAppt[] = [];

    for (const cal of calendars) {
      const appts = await getAppointmentsByCalendar(calendarApiKey, cal.id, since);
      for (const a of appts as RawAppt[]) {
        const id = String(a.id);
        if (!seen.has(id)) {
          seen.add(id);
          allAppointments.push(a);
        }
      }
    }

    if (allAppointments.length === 0) return;

    const active = allAppointments.filter((a) => {
      const status = String(a.appoinmentStatus ?? a.appointmentStatus ?? a.status ?? "");
      return !CANCELLED_STATUSES.has(status.toLowerCase());
    });

    if (active.length === 0) return;

    // ── Step 3: resolve contact owners (agency key has contacts scope) ──
    const contactIds = [...new Set(active.map((a) => a.contactId as string).filter(Boolean))];
    const contactOwnerMap = await getContactOwners(ghlApiKey, contactIds);

    // ── Step 3: upsert, attributed to contact owner ──
    let saved = 0;
    await runBatched(active, 25, (a) => {
      const contactOwnerGhlId = a.contactId ? contactOwnerMap.get(a.contactId as string) : undefined;
      const fallbackGhlId = a.assignedUserId as string | undefined;
      const agentId = (contactOwnerGhlId && agentByGhlId.get(contactOwnerGhlId))
        ?? (fallbackGhlId && agentByGhlId.get(fallbackGhlId))
        ?? null;

      if (!agentId) return Promise.resolve();

      const status = String(a.appoinmentStatus ?? a.appointmentStatus ?? a.status ?? "new").toLowerCase();
      const startTime = a.startTime ? new Date(a.startTime as string) : new Date();
      const endTime = a.endTime ? new Date(a.endTime as string) : undefined;
      const leadId = a.contactId ? (contactToLeadId.get(a.contactId as string) ?? null) : null;

      saved++;

      const record = {
        ghlId: String(a.id),
        agentId,
        contactId: (a.contactId as string | undefined) ?? null,
        leadId,
        status,
        title: (a.title as string | undefined) ?? null,
        startTime,
        endTime: endTime ?? null,
        calendarId: (a.calendarId as string | undefined) ?? null,
      };

      return prisma.ghlAppointment.upsert({
        where: { ghlId: record.ghlId },
        create: record,
        update: { status, agentId, leadId, startTime, endTime: endTime ?? null },
      });
    });

    if (saved > 0) {
      await prisma.appSettings.update({
        where: { id: "singleton" },
        data: { ghlAppsLastSyncedAt: new Date() },
      });
    }

    console.log(`[autoSyncGhlAppointments] fetched=${allAppointments.length} active=${active.length} saved=${saved}`);
  } catch (err) {
    console.error("[autoSyncGhlAppointments]", err);
  }
}

export async function autoSyncGhlOpportunities(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.ghlApiKey || !settings?.ghlLocationId) return;
    const { ghlApiKey, ghlLocationId } = settings;

    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: { ghlOppsLastSyncedAt: new Date() },
    });

    const dfAgents = await prisma.user.findMany({
      where: { ghlUserId: { not: null } },
      select: { id: true, ghlUserId: true },
    });
    if (dfAgents.length === 0) return;

    const linkedLeads = await prisma.lead.findMany({
      where: { ghlContactId: { not: null } },
      select: { id: true, ghlContactId: true },
    });
    const contactToLeadId = new Map(linkedLeads.map((l) => [l.ghlContactId!, l.id]));

    // Process agents sequentially; upsert opportunities in batches of 25
    for (const agent of dfAgents) {
      const opps = await getAgentOpportunities(ghlApiKey, ghlLocationId, agent.ghlUserId!);

      await runBatched(opps, 25, (opp) => {
        const leadId = opp.contactId ? (contactToLeadId.get(opp.contactId) ?? null) : null;
        const record = {
          ghlId: opp.id,
          agentId: agent.id,
          status: opp.status ?? "open",
          monetaryValue: opp.monetaryValue ?? 0,
          source: opp.source ?? null,
          contactId: opp.contactId ?? null,
          leadId,
          createdAt: opp.createdAt ? new Date(opp.createdAt) : new Date(),
        };

        return prisma.ghlOpportunity.upsert({
          where: { ghlId: opp.id },
          create: record,
          update: {
            status: record.status,
            monetaryValue: record.monetaryValue,
            agentId: record.agentId,
            leadId: record.leadId,
          },
        });
      });
    }
  } catch (err) {
    console.error("[autoSyncGhlOpportunities]", err);
  }
}

/**
 * Sync contacts tagged "appointment-booked" → GhlBookedContact table.
 * The contact's assignedTo (owner) determines which DataForge agent gets credit.
 */
export async function autoSyncGhlBookedContacts(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.ghlApiKey || !settings?.ghlLocationId) return;
    const { ghlApiKey, ghlLocationId } = settings;

    const dfAgents = await prisma.user.findMany({
      where: { ghlUserId: { not: null } },
      select: { id: true, ghlUserId: true },
    });
    if (dfAgents.length === 0) return;
    const agentByGhlId = new Map(dfAgents.map((a) => [a.ghlUserId!, a.id]));

    const contacts = await getContactsByTag(ghlApiKey, ghlLocationId, "appointment-booked");
    if (contacts.length === 0) return;

    await runBatched(contacts, 25, (contact) => {
      const ownerGhlId = contact.assignedTo;
      const agentId = ownerGhlId ? agentByGhlId.get(ownerGhlId) : undefined;
      if (!agentId) return Promise.resolve();

      return prisma.ghlBookedContact.upsert({
        where: { ghlId: contact.id },
        create: { ghlId: contact.id, agentId },
        update: { agentId },
      });
    });

    console.log(`[autoSyncGhlBookedContacts] synced=${contacts.length}`);
  } catch (err) {
    console.error("[autoSyncGhlBookedContacts]", err);
  }
}
