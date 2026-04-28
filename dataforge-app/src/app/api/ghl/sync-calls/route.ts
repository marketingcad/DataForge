import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocationCallConversations, mapGhlCallStatus } from "@/lib/ghl/client";

const ALLOWED_ROLES = ["boss", "admin"];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
    if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.ghlApiKey || !settings?.ghlLocationId) {
      return NextResponse.json({ error: "GHL API key and Location ID must be configured in Settings." }, { status: 400 });
    }

    // Build GHL userId → DataForge agent map
    const dfAgents = await prisma.user.findMany({
      where: { ghlUserId: { not: null } },
      select: { id: true, ghlUserId: true, name: true, email: true },
    });

    if (dfAgents.length === 0) {
      return NextResponse.json({ synced: 0, message: "No users linked to GHL. Import agents from GHL first." });
    }

    const agentByGhlId = new Map(dfAgents.map((a) => [a.ghlUserId!, a]));

    // Build phone → lead and contactId → lead lookup
    const allLeads = await prisma.lead.findMany({
      select: { id: true, phone: true, ghlContactId: true },
    });
    const phoneToLeadId = new Map(allLeads.map((l) => [l.phone?.replace(/\D/g, ""), l.id]));
    const contactToLeadId = new Map(
      allLeads.filter((l) => l.ghlContactId).map((l) => [l.ghlContactId!, l.id])
    );

    // Fetch all call-type conversations for the location (paginated, filtered client-side)
    const callConvs = await getLocationCallConversations(settings.ghlApiKey, settings.ghlLocationId);

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalUnmatched = 0;

    for (const conv of callConvs) {
      // Attribute to agent via assignedTo
      const assignedTo = conv.assignedTo as string | undefined;
      const agent = assignedTo ? agentByGhlId.get(assignedTo) : undefined;

      if (!agent) {
        totalUnmatched++;
        continue;
      }

      // Use conversation ID as the unique dedup key
      const ghlMessageId = conv.id;
      const exists = await prisma.callLog.findUnique({ where: { ghlMessageId } });
      if (exists) { totalSkipped++; continue; }

      // Resolve calledAt from whichever date field GHL provides
      const rawDate = conv.lastMessageDate ?? conv.dateUpdated ?? conv.dateAdded;
      const calledAt = rawDate ? new Date(rawDate) : new Date();

      // Lead attribution
      const leadId =
        (conv.contactId ? contactToLeadId.get(conv.contactId) : undefined) ??
        (conv.phone ? phoneToLeadId.get(conv.phone.replace(/\D/g, "")) : undefined) ??
        null;

      await prisma.callLog.create({
        data: {
          agentId: agent.id,
          leadId,
          contactName: conv.contactName ?? null,
          contactPhone: conv.phone ?? null,
          direction: "outbound",
          durationSecs: 0,
          status: mapGhlCallStatus(String(conv.lastMessageType ?? conv.type ?? "")),
          calledAt,
          ghlMessageId,
          notes: "Synced from GHL",
        },
      });

      totalSynced++;
    }

    return NextResponse.json({
      synced: totalSynced,
      skipped: totalSkipped,
      unmatched: totalUnmatched,
      totalCallConversations: callConvs.length,
    });
  } catch (err) {
    console.error("[ghl/sync-calls]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
