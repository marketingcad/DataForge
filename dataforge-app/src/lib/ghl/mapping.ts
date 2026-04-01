/**
 * GoHighLevel Webhook — Field Mapping Reference
 *
 * Webhook confirmed live: POST returns {"status":"Success: test request received"} HTTP 200
 *
 * DataForge Lead  →  GHL Contact field
 * ─────────────────────────────────────────────────────────────────
 * businessName    →  companyName
 * contactPerson   →  firstName + lastName (split on first space; all goes to firstName if no space)
 * phone           →  phone  (must be formatted, e.g. "+1 (512) 555-1234"; stored as digits in DB)
 * email           →  email
 * website         →  website  (stored as root domain, e.g. "acme.com")
 * address         →  address1
 * city            →  city
 * state           →  state
 * country         →  country  (default "US" if null)
 * category        →  tags[]   (wrapped in array)
 * source          →  source   (hardcoded "DataForge")
 * dataQualityScore → (not a standard GHL field — omit or add as custom field later)
 * ─────────────────────────────────────────────────────────────────
 *
 * GHL contact fields NOT used / not available in DataForge:
 *   postalCode, timezone, dnd (do not disturb), customFields[]
 */

import type { Lead } from "@/generated/prisma/client";
import { formatPhone } from "@/lib/utils/normalize";

export interface GhlContactPayload {
  companyName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address1?: string;
  city?: string;
  state?: string;
  country: string;
  source: string;
  tags?: string[];
}

export function mapLeadToGhl(lead: Pick<
  Lead,
  | "businessName"
  | "contactPerson"
  | "phone"
  | "email"
  | "website"
  | "address"
  | "city"
  | "state"
  | "country"
  | "category"
>): GhlContactPayload {
  // Split contactPerson into first/last
  const nameParts = lead.contactPerson?.trim().split(/\s+/) ?? [];
  const firstName = nameParts[0] ?? undefined;
  const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  // Format phone from stored digits → readable format
  const phone = lead.phone && lead.phone !== "N/A"
    ? formatPhone(lead.phone) || undefined
    : undefined;

  // Website — prefix with https:// if missing
  const website = lead.website
    ? (lead.website.startsWith("http") ? lead.website : `https://${lead.website}`)
    : undefined;

  const tags = lead.category ? [lead.category] : undefined;

  return {
    companyName: lead.businessName,
    ...(firstName ? { firstName } : {}),
    ...(lastName  ? { lastName  } : {}),
    ...(phone     ? { phone     } : {}),
    ...(lead.email    ? { email:    lead.email    } : {}),
    ...(website   ? { website   } : {}),
    ...(lead.address  ? { address1: lead.address  } : {}),
    ...(lead.city     ? { city:     lead.city     } : {}),
    ...(lead.state    ? { state:    lead.state    } : {}),
    country: lead.country ?? "US",
    source: "DataForge",
    ...(tags ? { tags } : {}),
  };
}
