"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadInputSchema } from "@/types/lead";
import { insertLead, updateLead, getLeads } from "@/lib/leads/service";
import { prisma } from "@/lib/prisma";
import { requireDepartment } from "@/lib/rbac/guards";

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
  searchField?: "business" | "contact" | "location" | "phone" | "email" | "website" | "score";
  savedById?: string;
};

export async function getLeadsForFolderAction(params: LeadFilterParams & { page?: number }) {
  await requireDepartment("leads");
  return getLeads({
    folderId: params.folderId,
    search: params.search || "",
    sort: params.sort || "newest",
    page: params.page || 1,
    pageSize: 20,
    minScore: params.minScore,
    maxScore: params.maxScore,
    status: params.status || "",
    state: params.state || "",
    hasEmail: params.hasEmail,
    hasWebsite: params.hasWebsite,
    hasContact: params.hasContact,
    hasPhone: params.hasPhone,
    hasBusiness: params.hasBusiness,
    searchField: params.searchField || "business",
    savedById: params.savedById,
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
    searchField: params.searchField || "business",
    savedById: params.savedById,
  });
}

export async function bulkDeleteLeadsAction(ids: string[]) {
  await requireDepartment("leads");
  if (!ids.length) return;
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
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

  let created = 0, duplicates = 0, errors = 0;

  for (const row of rows) {
    try {
      const result = await insertLead({
        businessName: row.businessName,
        phone: row.phone,
        email: row.email,
        website: row.website,
        contactPerson: row.contactPerson,
        address: row.address,
        city: row.city,
        state: row.state,
        country: row.country,
        category: categoryOverride ?? row.category,
        source: "CSV Import",
        folderId: resolvedFolderId,
        savedById,
      });
      if (result.status === "created") created++;
      else duplicates++;
    } catch {
      errors++;
    }
  }

  revalidatePath("/leads");
  return { created, duplicates, errors };
}
