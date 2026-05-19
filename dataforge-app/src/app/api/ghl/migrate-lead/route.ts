import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrUpdateContact, searchContactByPhone } from "@/lib/ghl/client";
import { mapLeadToGhl } from "@/lib/ghl/mapping";

const ALLOWED_ROLES = ["boss", "admin", "lead_specialist"];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
    if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });

    const [lead, settings] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    ]);

    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const hasDirectApi = !!(settings?.ghlApiKey && settings?.ghlLocationId);
    const hasWebhook   = !!settings?.ghlWebhookUrl;

    if (!hasDirectApi && !hasWebhook) {
      return NextResponse.json(
        { error: "GHL not configured. Add your API key + Location ID in Settings." },
        { status: 400 }
      );
    }

    let ghlContactId: string | null = lead.ghlContactId ?? null;

    // ── Path 1: Direct GHL Contacts API (preferred — uses API key + location ID) ──
    if (hasDirectApi) {
      const contactPayload = mapLeadToGhl(lead);

      const result = await createOrUpdateContact(
        settings!.ghlApiKey!,
        settings!.ghlLocationId!,
        contactPayload as unknown as Record<string, unknown>,
      );

      if (!result) {
        return NextResponse.json(
          { error: "GHL API rejected the contact. Check your API key and Location ID in Settings." },
          { status: 502 }
        );
      }

      ghlContactId = result.id;

      // Also fire the webhook if one is configured (e.g. to trigger a GHL workflow)
      if (hasWebhook) {
        try {
          await fetch(settings!.ghlWebhookUrl!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "contact_upsert",
              source: "DataForge",
              timestamp: new Date().toISOString(),
              contact: { ...contactPayload, ghlContactId },
            }),
          });
        } catch { /* non-fatal — webhook is optional */ }
      }
    }

    // ── Path 2: Webhook-only fallback ─────────────────────────────────────────
    else if (hasWebhook) {
      const contactPayload = mapLeadToGhl(lead);

      const ghlRes = await fetch(settings!.ghlWebhookUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contact_upsert",
          source: "DataForge",
          timestamp: new Date().toISOString(),
          contact: contactPayload,
        }),
      });

      if (!ghlRes.ok) {
        const text = await ghlRes.text().catch(() => "");
        return NextResponse.json(
          { error: `GHL webhook returned ${ghlRes.status}: ${text.slice(0, 200)}` },
          { status: 502 }
        );
      }

      // Try to look up contact ID from GHL after webhook push
      if (settings?.ghlApiKey && settings?.ghlLocationId && !ghlContactId) {
        try {
          const contact = await searchContactByPhone(settings.ghlApiKey, settings.ghlLocationId, lead.phone);
          ghlContactId = contact?.id ?? null;
        } catch { /* non-fatal */ }
      }
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        migratedToGhl: true,
        migratedToGhlAt: new Date(),
        ...(ghlContactId ? { ghlContactId } : {}),
      },
    });

    return NextResponse.json({ success: true, ghlContactId });
  } catch (err) {
    console.error("[ghl/migrate-lead]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
