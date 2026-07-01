import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { insertLead } from "@/lib/leads/service";
import { matchRepByName } from "@/lib/ghl/match-rep";

export async function GET() {
  return NextResponse.json({ ok: true, message: "GHL lead webhook is live" });
}

// Record the last payload + outcome for debugging (viewable via /api/ghl/webhook-status).
async function logOutcome(payload: string, outcome: string) {
  try {
    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: {
        webhookLastPayload: (payload || "(empty body)").slice(0, 4000),
        webhookLastOutcome: `lead: ${outcome} at ${new Date().toISOString()}`,
      },
    });
  } catch {
    /* logging is best-effort */
  }
}

/**
 * Inbound GHL lead webhook — mirrors the appointment webhook (unauthenticated).
 *
 * GHL posts a lead here; we fuzzy-match the sales rep by name (created_by /
 * consultant name) and store a Lead (source "GHL") tied to that rep via
 * savedById. Like the appointment webhook, if no rep matches we skip it.
 */
export async function POST(req: NextRequest) {
  const rawStr = await req.text().catch(() => "");

  let body: Record<string, unknown>;
  try {
    body = rawStr ? (JSON.parse(rawStr) as Record<string, unknown>) : {};
  } catch {
    await logOutcome(rawStr, "invalid_json");
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
    const repName       = str("craeted_by", "created_by", "consultant_name", "assigned_to", "assignedTo", "owner", "rep", "booked_by");

    // A lead needs at least a business or contact name to identify it.
    const name = businessName || contactPerson;
    if (!name) {
      await logOutcome(rawStr, "missing_name");
      return NextResponse.json({ error: "Missing business/contact name", received: body }, { status: 400 });
    }

    // ── Match rep by name (shared with the appointment webhook) ──
    const matched = await matchRepByName(repName);
    if (!matched) {
      await logOutcome(rawStr, `rep_not_found — "${repName}"`);
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

    await logOutcome(rawStr, `${result.status} — rep="${matched.name}" lead="${name}"`);
    revalidatePath("/leads");
    return NextResponse.json({
      ok: true,
      status: result.status, // "created" | "duplicate"
      rep: matched.name,
      businessName: name,
    });
  } catch (err) {
    await logOutcome(rawStr, `error — ${String(err).slice(0, 200)}`);
    console.error("[ghl-lead] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
