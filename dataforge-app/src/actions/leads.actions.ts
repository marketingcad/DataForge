"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadInputSchema } from "@/types/lead";
import { insertLead, updateLead, getLeads } from "@/lib/leads/service";
import { prisma } from "@/lib/prisma";
import { requireDepartment } from "@/lib/rbac/guards";
import { normalizePhone, normalizeEmail, normalizeWebsite } from "@/lib/utils/normalize";
import { calculateDataQualityScore } from "@/lib/utils/scoring";

type LeadFilterParams = {
  folderId: string;
  search?: string;
  sort?: "name_asc" | "name_desc" | "newest" | "oldest";
  minScore?: number;
  maxScore?: number;
  status?: string;
  state?: string;
  hasEmail?: boolean;
  hasWebsite?: boolean;
  hasContact?: boolean;
  hasPhone?: boolean;
  hasBusiness?: boolean;
  noEmail?: boolean;
  noWebsite?: boolean;
  noContact?: boolean;
  noPhone?: boolean;
  noBusiness?: boolean;
  hasScore?: boolean;
  noScore?: boolean;
  searchField?: "business" | "contact" | "location" | "phone" | "email" | "website" | "score";
  savedById?: string;
  pageSize?: number;
  exportStatus?: "exported" | "not_exported";
  exportedFrom?: string;
  exportedTo?: string;
};

export async function getLeadsForFolderAction(params: LeadFilterParams & { page?: number }) {
  await requireDepartment("leads");
  return getLeads({
    folderId: params.folderId,
    search: params.search || "",
    sort: params.sort || "newest",
    page: params.page || 1,
    pageSize: params.pageSize ?? 20,
    minScore: params.minScore,
    maxScore: params.maxScore,
    status: params.status || "",
    state: params.state || "",
    hasEmail: params.hasEmail,
    hasWebsite: params.hasWebsite,
    hasContact: params.hasContact,
    hasPhone: params.hasPhone,
    hasBusiness: params.hasBusiness,
    noEmail: params.noEmail,
    noWebsite: params.noWebsite,
    noContact: params.noContact,
    noPhone: params.noPhone,
    noBusiness: params.noBusiness,
    hasScore: params.hasScore,
    noScore: params.noScore,
    searchField: params.searchField || "business",
    savedById: params.savedById,
    exportStatus: params.exportStatus,
    exportedFrom: params.exportedFrom,
    exportedTo: params.exportedTo,
  });
}

export async function getAllLeadsForExportAction(params: LeadFilterParams) {
  await requireDepartment("leads");
  return getLeads({
    folderId: params.folderId,
    search: params.search || "",
    sort: params.sort || "newest",
    pageSize: 5000,
    minScore: params.minScore,
    maxScore: params.maxScore,
    status: params.status || "",
    state: params.state || "",
    hasEmail: params.hasEmail,
    hasWebsite: params.hasWebsite,
    hasContact: params.hasContact,
    hasPhone: params.hasPhone,
    hasBusiness: params.hasBusiness,
    noEmail: params.noEmail,
    noWebsite: params.noWebsite,
    noContact: params.noContact,
    noPhone: params.noPhone,
    noBusiness: params.noBusiness,
    hasScore: params.hasScore,
    noScore: params.noScore,
    searchField: params.searchField || "business",
    savedById: params.savedById,
    exportStatus: params.exportStatus,
    exportedFrom: params.exportedFrom,
    exportedTo: params.exportedTo,
  });
}

/** All leads saved by a given agent — for the Reports agent-leads popup. */
export async function getAgentLeadsAction(agentId: string) {
  await requireDepartment("leads");
  return prisma.lead.findMany({
    where: { savedById: agentId },
    select: {
      id: true,
      businessName: true,
      phone: true,
      email: true,
      city: true,
      state: true,
      category: true,
      source: true,
      dataQualityScore: true,
      dateCollected: true,
      exportedAt: true,
    },
    orderBy: { dateCollected: "desc" },
    take: 2000,
  });
}

export async function bulkDeleteLeadsAction(ids: string[]) {
  await requireDepartment("leads");
  if (!ids.length) return;
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/leads");
}

/** Mark the given leads as exported now (overwrites any previous export date). */
export async function markLeadsExportedAction(ids: string[]) {
  await requireDepartment("leads");
  if (!ids.length) return;
  await prisma.lead.updateMany({
    where: { id: { in: ids } },
    data: { exportedAt: new Date() },
  });
  revalidatePath("/leads");
}

export async function deleteAllKeywordLeadsAction(kwId: string) {
  await requireDepartment("leads");
  await prisma.lead.deleteMany({ where: { source: { startsWith: `GoogleMaps:keyword_${kwId}` } } });
  revalidatePath("/leads");
}

export async function moveLeadsToFolderAction(ids: string[], folderId: string | null) {
  await requireDepartment("leads");
  if (!ids.length) return;
  // When saving to a real folder, clear keywordId so the keyword card count resets.
  // The lead's `source` field already records which keyword found it.
  const data: { folderId: string | null; keywordId?: null } = { folderId };
  if (folderId !== null) data.keywordId = null;
  await prisma.lead.updateMany({ where: { id: { in: ids } }, data });
  revalidatePath("/leads");
}

export async function createLeadAction(formData: FormData) {
  const user = await requireDepartment("leads");
  const raw = Object.fromEntries(formData.entries());
  const parsed = LeadInputSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await insertLead({ ...parsed.data, savedById: user.id });

  revalidatePath("/leads");

  if (result.status === "duplicate") {
    redirect(`/leads/${result.existingId}?notice=duplicate`);
  }

  redirect("/leads");
}

export async function updateLeadAction(id: string, formData: FormData) {
  await requireDepartment("leads");
  const raw = Object.fromEntries(formData.entries());
  const parsed = LeadInputSchema.partial().safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await updateLead(id, parsed.data);

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}?notice=updated`);
}

export async function updateLeadInlineAction(
  id: string,
  data: {
    businessName?: string;
    phone?: string;
    email?: string;
    website?: string;
    contactPerson?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  }
) {
  await requireDepartment("leads");
  try {
    await updateLead(id, data);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

export async function deleteLeadAction(id: string) {
  await requireDepartment("leads");
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function updateLeadStatusAction(id: string, status: "active" | "flagged" | "invalid") {
  await requireDepartment("leads");
  await prisma.lead.update({
    where: { id },
    data: { recordStatus: status },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export type CsvLeadRow = {
  businessName: string;
  phone: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  category?: string;
};

async function getOrCreateDefaultCsvFolder(userId: string): Promise<string> {
  let industry = await prisma.industry.findFirst({ where: { name: "CSV Imports", userId } });
  if (!industry) {
    industry = await prisma.industry.create({
      data: { userId, name: "CSV Imports", color: "#64748b" },
    });
  }
  let folder = await prisma.folder.findFirst({ where: { name: "General", industryId: industry.id } });
  if (!folder) {
    folder = await prisma.folder.create({
      data: { userId, name: "General", color: "#64748b", industryId: industry.id },
    });
  }
  return folder.id;
}

export async function importLeadsFromCsvAction(
  rows: CsvLeadRow[],
  folderId: string | null,
  categoryOverride: string | null,
  savedById: string,
) {
  await requireDepartment("leads");

  if (!rows.length) return { created: 0, duplicates: 0, errors: 0 };

  const resolvedFolderId = folderId || await getOrCreateDefaultCsvFolder(savedById);

  // Normalize all rows upfront — no per-row DB calls yet
  type NormalizedRow = Omit<CsvLeadRow, "category"> & { phone: string; email: string; website: string; category: string | null };
  let errors = 0;
  const normalized: NormalizedRow[] = [];
  for (const row of rows) {
    try {
      normalized.push({
        ...row,
        businessName: row.businessName?.trim() ?? "",
        phone: normalizePhone(row.phone ?? ""),
        email: row.email ? normalizeEmail(row.email) : "",
        website: row.website ? normalizeWebsite(row.website) : "",
        category: categoryOverride ?? row.category ?? null,
      });
    } catch {
      errors++;
    }
  }

  // ── Bulk dedup: phone is the only reliable unique key per business location ──
  // Business name and website both produce false positives for chains/franchises
  // (e.g. "State Farm Insurance" or "mcdonalds.com" shared across hundreds of locations).
  // We fall back to website-domain only when a row has no phone at all.
  const phones   = [...new Set(normalized.map(r => r.phone).filter(Boolean))];
  const noPhoneWebsites = [...new Set(
    normalized.filter(r => !r.phone).map(r => r.website).filter(Boolean)
  )];

  const existingLeads = (phones.length || noPhoneWebsites.length)
    ? await prisma.lead.findMany({
        where: {
          OR: [
            ...(phones.length         ? [{ phone:   { in: phones         } }] : []),
            ...(noPhoneWebsites.length ? [{ website: { in: noPhoneWebsites } }] : []),
          ],
        },
        select: { phone: true, website: true },
      })
    : [];

  const existingPhones   = new Set(existingLeads.map(e => e.phone).filter(Boolean) as string[]);
  const existingWebsites = new Set(existingLeads.map(e => e.website).filter(Boolean) as string[]);

  // ── Build insert list ──────────────────────────────────────────────────
  let duplicates = 0;
  const toCreate: {
    businessName: string; phone: string; email: string | null; website: string | null;
    contactPerson: string | null; address: string | null; city: string | null;
    state: string | null; country: string | null; category: string | null;
    source: string; industriesFoundIn: string[]; dataQualityScore: number;
    folderId: string; savedById: string;
  }[] = [];

  for (const row of normalized) {
    // Duplicate if: phone matches, OR (no phone AND website matches)
    const isDuplicate =
      (row.phone   && existingPhones.has(row.phone)) ||
      (!row.phone && row.website && existingWebsites.has(row.website));

    if (isDuplicate) { duplicates++; continue; }

    const industries = row.category ? [row.category] : [];
    const score = calculateDataQualityScore(
      { ...row, phone: row.phone, email: row.email || undefined, website: row.website || undefined, category: row.category ?? undefined },
      industries.length,
    );

    toCreate.push({
      businessName: row.businessName,
      phone:        row.phone,
      email:        row.email        || null,
      website:      row.website      || null,
      contactPerson: row.contactPerson || null,
      address:      row.address      || null,
      city:         row.city         || null,
      state:        row.state        || null,
      country:      row.country      || null,
      category:     row.category     ?? null,
      source:       "CSV Import",
      industriesFoundIn: industries,
      dataQualityScore:  score,
      folderId:    resolvedFolderId,
      savedById,
    });
  }

  // ── Bulk insert in batches of 500 ──────────────────────────────────────
  let created = 0;
  for (let i = 0; i < toCreate.length; i += 500) {
    const result = await prisma.lead.createMany({ data: toCreate.slice(i, i + 500) });
    created += result.count;
  }

  revalidatePath("/leads");
  return { created, duplicates, errors };
}
