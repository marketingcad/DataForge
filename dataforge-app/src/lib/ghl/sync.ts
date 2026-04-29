import { prisma } from "@/lib/prisma";
import { getLocationCallConversations, getConversationCalls, mapGhlCallStatus, getAgentOpportunities } from "@/lib/ghl/client";

/**
 * Fetch call durations for a batch of conversations in parallel.
 * GHL stores duration in message meta — either meta.durationSecs (seconds)
 * or meta.duration (milliseconds). We normalise to whole seconds.
 * Batched to 10 concurrent requests to stay within GHL rate limits.
 */
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

export async function autoSyncGhlCalls(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.ghlApiKey || !settings?.ghlLocationId) return;

    // Stamp before fetching so parallel renders don't double-sync
    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: { ghlCallsLastSyncedAt: new Date() },
    });

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

    const since = settings.ghlCallsLastSyncedAt ?? undefined;
    const callConvs = await getLocationCallConversations(
      settings.ghlApiKey,
      settings.ghlLocationId,
      since
    );

    if (callConvs.length === 0) return;

    // Find which conversations already exist in DB so we don't overwrite their duration
    const convIds = callConvs.map((c) => c.id);
    const existing = await prisma.callLog.findMany({
      where: { ghlMessageId: { in: convIds } },
      select: { ghlMessageId: true, durationSecs: true },
    });
    const existingMap = new Map(existing.map((e) => [e.ghlMessageId, e.durationSecs]));

    // Only fetch durations for NEW conversations (not in DB yet), cap at 50 per sync
    const newConvIds = convIds
      .filter((id) => !existingMap.has(id))
      .slice(0, 50);
    const durations = await fetchDurations(settings.ghlApiKey, newConvIds);

    await Promise.all(callConvs.map((conv) => {
      const dfAgentId = conv.assignedTo ? agentByGhlId.get(conv.assignedTo) : undefined;
      if (!dfAgentId) return;

      const ghlMessageId = conv.id;
      const rawDate = conv.sort?.[0] ?? conv.lastMessageDate ?? conv.dateUpdated ?? conv.dateAdded;
      const calledAt = rawDate ? new Date(Number(rawDate)) : new Date();
      const leadId = conv.contactId ? (contactToLeadId.get(conv.contactId) ?? null) : null;
      // New record: use fetched duration. Existing record: preserve what's already stored.
      const durationSecs = existingMap.has(ghlMessageId)
        ? (existingMap.get(ghlMessageId) ?? 0)
        : (durations.get(ghlMessageId) ?? 0);

      const record = {
        agentId: dfAgentId,
        leadId,
        contactName: conv.contactName ?? null,
        contactPhone: conv.phone ?? null,
        direction: "outbound" as const,
        durationSecs,
        status: mapGhlCallStatus(String(conv.lastMessageType ?? conv.type ?? "")),
        calledAt,
        ghlMessageId,
        notes: "Synced from GHL",
      };

      return prisma.callLog.upsert({
        where: { ghlMessageId },
        create: record,
        update: { calledAt, agentId: dfAgentId, leadId, status: record.status },
      });
    }));
  } catch (err) {
    console.error("[autoSyncGhlCalls]", err);
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

    // Only fetch leads already linked to GHL contacts
    const linkedLeads = await prisma.lead.findMany({
      where: { ghlContactId: { not: null } },
      select: { id: true, ghlContactId: true },
    });
    const contactToLeadId = new Map(linkedLeads.map((l) => [l.ghlContactId!, l.id]));

    await Promise.all(dfAgents.map(async (agent) => {
      const opps = await getAgentOpportunities(
        ghlApiKey,
        ghlLocationId,
        agent.ghlUserId!
      );

      await Promise.all(opps.map((opp) => {
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
      }));
    }));
  } catch (err) {
    console.error("[autoSyncGhlOpportunities]", err);
  }
}
