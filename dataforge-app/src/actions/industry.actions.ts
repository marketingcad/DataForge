"use server";

import {
  getIndustries,
  getFoldersByIndustry,
  getUngroupedFoldersByIndustry,
  createIndustry,
  updateIndustry,
  deleteIndustry,
  getSubcategoriesByIndustry,
  getFoldersBySubcategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from "@/lib/industry/service";
import { requireDepartment } from "@/lib/rbac/guards";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/rbac/roles";
import { prisma } from "@/lib/prisma";
import { getCategoryGrants, canSeeCategory, hasFullLeadAccess } from "@/lib/leads/access";

/** Ownership scope for MUTATIONS: lead specialists may only change their own rows. */
function scopedUserId(user: { id: string; role: string }): string | undefined {
  return (user.role as Role) === "lead_specialist" ? user.id : undefined;
}

/**
 * Whether the user may VIEW a category's contents. Boss/admin: always.
 * Lead specialists: only categories granted to them (not ones they own —
 * categories/folders are owned by whoever created them).
 */
async function canViewCategory(user: { id: string; role: string }, industryId: string | null): Promise<boolean> {
  if (hasFullLeadAccess(user.role)) return true;
  const grants = await getCategoryGrants(user.id);
  return canSeeCategory(grants, industryId);
}

export async function getIndustriesAction(savedById?: string) {
  const user = await requireDepartment("leads");
  const all = await getIndustries(undefined, savedById);
  if (hasFullLeadAccess(user.role)) return all;
  const grants = await getCategoryGrants(user.id);
  return all.filter((i) => canSeeCategory(grants, i.id));
}

export async function getFoldersByIndustryAction(industryId: string, savedById?: string) {
  const user = await requireDepartment("leads");
  if (!(await canViewCategory(user, industryId))) return [];
  // No ownership filter — a granted specialist sees every folder in the category.
  return getFoldersByIndustry(industryId, undefined, savedById);
}

export async function getUngroupedFoldersByIndustryAction(industryId: string, savedById?: string) {
  const user = await requireDepartment("leads");
  if (!(await canViewCategory(user, industryId))) return [];
  return getUngroupedFoldersByIndustry(industryId, undefined, savedById);
}

export async function createIndustryAction(name: string, color: string) {
  const user = await requireDepartment("leads");
  const industry = await createIndustry(user.id, name, color);
  revalidatePath("/leads");
  return industry;
}

export async function updateIndustryAction(id: string, name: string, color: string) {
  const user = await requireDepartment("leads");
  await updateIndustry(id, name, color, scopedUserId(user));
  revalidatePath("/leads");
}

export async function deleteIndustryAction(id: string) {
  const user = await requireDepartment("leads");
  await deleteIndustry(id, scopedUserId(user));
  revalidatePath("/leads");
}

// --- Subcategory actions ---

export async function getSubcategoriesByIndustryAction(industryId: string, savedById?: string) {
  const user = await requireDepartment("leads");
  if (!(await canViewCategory(user, industryId))) return [];
  return getSubcategoriesByIndustry(industryId, undefined, savedById);
}

export async function getFoldersBySubcategoryAction(subcategoryId: string, savedById?: string) {
  const user = await requireDepartment("leads");
  if (!hasFullLeadAccess(user.role)) {
    const sub = await prisma.subcategory.findUnique({ where: { id: subcategoryId }, select: { industryId: true } });
    if (!sub || !(await canViewCategory(user, sub.industryId))) return [];
  }
  return getFoldersBySubcategory(subcategoryId, undefined, savedById);
}

export async function createSubcategoryAction(industryId: string, name: string, color: string) {
  const user = await requireDepartment("leads");
  const sub = await createSubcategory(user.id, industryId, name, color);
  revalidatePath("/leads");
  return sub;
}

export async function updateSubcategoryAction(id: string, name: string, color: string) {
  const user = await requireDepartment("leads");
  await updateSubcategory(id, name, color, scopedUserId(user));
  revalidatePath("/leads");
}

export async function deleteSubcategoryAction(id: string) {
  const user = await requireDepartment("leads");
  await deleteSubcategory(id, scopedUserId(user));
  revalidatePath("/leads");
}
