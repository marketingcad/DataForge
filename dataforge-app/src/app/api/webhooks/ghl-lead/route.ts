import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { insertLead } from "@/lib/leads/service";
import { matchRepByName } from "@/lib/ghl/match-rep";

export async function GET() {
  return NextResponse.json({ ok: true, message: "GHL lead webhook is live" });
}

/**
 * Inbound GHL lead webhook — mirrors the appointment webhook.
 *
 * GHL posts a lead here; we fuzzy-match the sales rep by name and store a Lead
 * (source "GHL") tied to that rep via savedById. Like the appointment webhook,
 * if no rep matches we skip it. Optionally protected by the shared
 * `ghlInboundSecret` (?secret=…) configured in Settings → Integrations.
 */
export async function POST(req: NextRequest) {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });

  // Optional shared-secret check (same secret as the call webhooks).
  const expectedSecret = settings?.ghlInboundSecret;
  if (expectedSecret) {
    const provided = req.nextUrl.searchParams.get("secret");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const str = (...keys: string[]) => {
      for (const k of keys) {
        const v = body[k];
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    };

    const businessName  = str("business_name", "businessName", "company", "companyName", "company_name");
    const contactPerson = str("contact_name", "contactPerson", "full_name", "fullName", "name");
    const phone         = str("phone", "client_phone", "phone_number");
    const email         = str("email");
    const website       = str("website", "url");
    const address       = str("address", "address1", "full_address");
    const city          = str("city");
    const state         = str("state", "province");
    const country       = str("country");
    const category      = str("category", "industry");
    const repName       = str("craeted_by", "created_by", "assigned_to", "assignedTo", "owner", "rep", "booked_by");

    // A lead needs at least a business or contact name to identify it.
    const name = businessName || contactPerson;
    if (!name) {
      return NextResponse.json({ error: "Missing business/contact name", received: body }, { status: 400 });
    }

    // ── Match rep by name (shared with the appointment webhook) ──
    const matched = await matchRepByName(repName);
    if (!matched) {
      return NextResponse.json({
        ok: false,
        reason: `Rep "${repName}" not found in DataForge`,
        receivedPayload: body,
      });
    }

    // insertLead handles normalization, dedup (phone/email/website), and scoring.
    const result = await insertLead({
      businessName: name,
      phone,
      email:         email || undefined,
      website:       website || undefined,
      contactPerson: contactPerson || undefined,
      address:       address || undefined,
      city:          city || undefined,
      state:         state || undefined,
      country:       country || undefined,
      category:      category || undefined,
      source:        "GHL",
      savedById:     matched.id,
    });

    revalidatePath("/leads");
    return NextResponse.json({
      ok: true,
      status: result.status, // "created" | "duplicate"
      rep: matched.name,
      businessName: name,
    });
  } catch (err) {
    console.error("[ghl-lead] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
