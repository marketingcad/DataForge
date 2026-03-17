"use server";

import { insertLead } from "@/lib/services/leads.service";

export interface LeadRow {
  businessName: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state?: string;
  website: string;
  phone?: string;
  email?: string;
  sourceUrl: string;
}

export interface SaveLeadsResult {
  saved: number;
  duplicates: number;
  failed: number;
}

export async function saveLeadsAction(
  leads: LeadRow[],
  folderId?: string
): Promise<SaveLeadsResult> {
  let saved = 0, duplicates = 0, failed = 0;

  for (const lead of leads) {
    try {
      const result = await insertLead({
        businessName: lead.businessName,
        phone: lead.phone || "",
        email: lead.email,
        website: lead.website,
        contactPerson: lead.contactPerson,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        source: `crawl:${lead.sourceUrl}`,
        folderId: folderId || undefined,
      });
      if (result.status === "created") saved++;
      else duplicates++;
    } catch {
      failed++;
    }
  }

  return { saved, duplicates, failed };
}
