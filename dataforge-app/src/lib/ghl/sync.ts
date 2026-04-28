import { prisma } from "@/lib/prisma";
import { getLocationCallConversations, mapGhlCallStatus, getAgentOpportunities } from "@/lib/ghl/client";

// 1 hour — keeps DB transfer low; syncs still happen automatically but not on every page load
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export async function autoSyncGhlCalls(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.ghlApiKey || !settings?.ghlLocationId) return;

    if (settings.ghlCallsLastSyncedAt) {
      const age = Date.now() - settings.ghlCallsLastSyncedAt.getTime();
      if (age < SYNC_COOLDOWN_MS) return;
    }

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

    // Only fetch leads that are already linked to GHL contacts — avoids a full table scan
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

    for (const conv of callConvs) {
      const dfAgentId = conv.assignedTo ? agentByGhlId.get(conv.assignedTo) : undefined;
      if (!dfAgentId) continue;

      const ghlMessageId = conv.id;
      const rawDate = conv.sort?.[0] ?? conv.lastMessageDate ?? conv.dateUpdated ?? conv.dateAdded;
      const calledAt = rawDate ? new Date(Number(rawDate)) : new Date();
      const leadId = conv.contactId ? (contactToLeadId.get(conv.contactId) ?? null) : null;

      const record = {
        agentId: dfAgentId,
        leadId,
        contactName: conv.contactName ?? null,
        contactPhone: conv.phone ?? null,
        direction: "outbound" as const,
        durationSecs: 0,
        status: mapGhlCallStatus(String(conv.lastMessageType ?? conv.type ?? "")),
        calledAt,
        ghlMessageId,
        notes: "Synced from GHL",
      };

      await prisma.callLog.upsert({
        where: { ghlMessageId },
        create: record,
        update: { calledAt, agentId: dfAgentId, leadId, status: record.status },
      });
    }
  } catch (err) {
    console.error("[autoSyncGhlCalls]", err);
  }
}

export async function autoSyncGhlOpportunities(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.ghlApiKey || !settings?.ghlLocationId) return;

    if (settings.ghlOppsLastSyncedAt) {
      const age = Date.now() - settings.ghlOppsLastSyncedAt.getTime();
      if (age < SYNC_COOLDOWN_MS) return;
    }

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

    for (const agent of dfAgents) {
      const opps = await getAgentOpportunities(
        settings.ghlApiKey,
        settings.ghlLocationId,
        agent.ghlUserId!
      );

      for (const opp of opps) {
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

        await prisma.ghlOpportunity.upsert({
          where: { ghlId: opp.id },
          create: record,
          update: {
            status: record.status,
            monetaryValue: record.monetaryValue,
            agentId: record.agentId,
            leadId: record.leadId,
          },
        });
      }
    }
  } catch (err) {
    console.error("[autoSyncGhlOpportunities]", err);
  }
}
