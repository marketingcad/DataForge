import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Fetch lead + GHL webhook URL in parallel
    const [lead, settings] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    ]);

    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (!settings?.ghlWebhookUrl) {
      return NextResponse.json({ error: "No GHL webhook URL configured in Settings." }, { status: 400 });
    }

    // Build GHL-compatible payload
    const payload = {
      type: "contact_upsert",
      source: "DataForge",
      timestamp: new Date().toISOString(),
      contact: {
        name: lead.contactPerson ?? lead.businessName,
        business: lead.businessName,
        phone: lead.phone,
        email: lead.email ?? undefined,
        website: lead.website ?? undefined,
        address1: lead.address ?? undefined,
        city: lead.city ?? undefined,
        state: lead.state ?? undefined,
        country: lead.country ?? undefined,
        tags: lead.category ? [lead.category] : [],
        customFields: [
          { key: "dataforge_id",    value: lead.id },
          { key: "quality_score",   value: String(lead.dataQualityScore) },
          { key: "category",        value: lead.category ?? "" },
          { key: "source",          value: lead.source },
        ],
      },
    };

    // POST to GHL webhook
    const ghlRes = await fetch(settings.ghlWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!ghlRes.ok) {
      const text = await ghlRes.text().catch(() => "");
      return NextResponse.json(
        { error: `GHL webhook returned ${ghlRes.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    // Mark lead as migrated
    await prisma.lead.update({
      where: { id: leadId },
      data: { migratedToGhl: true, migratedToGhlAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ghl/migrate-lead]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
