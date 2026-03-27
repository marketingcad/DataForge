"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadInputSchema } from "@/types/lead";
import { insertLead, updateLead, getLeads } from "@/lib/leads/service";
import { prisma } from "@/lib/prisma";
import { requireDepartment } from "@/lib/rbac/guards";

export async function getLeadsForFolderAction(params: {
  folderId: string;
  search?: string;
  sort?: "name_asc" | "name_desc" | "newest" | "oldest";
  page?: number;
  minScore?: number;
  maxScore?: number;
  status?: string;
  state?: string;
  hasEmail?: boolean;
  hasWebsite?: boolean;
  hasContact?: boolean;
  searchField?: "business" | "contact" | "location" | "phone" | "email" | "website" | "score";
  savedById?: string;
}) {
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
    searchField: params.searchField || "business",
    savedById: params.savedById,
  });
}

export async function getAllLeadsForExportAction(folderId: string) {
  await requireDepartment("leads");
  return getLeads({ folderId, pageSize: 5000 });
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
