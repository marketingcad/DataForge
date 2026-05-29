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

/** Boss/admin see everything; lead_specialist sees only their own data. */
function scopedUserId(user: { id: string; role: string }): string | undefined {
  return (user.role as Role) === "lead_specialist" ? user.id : undefined;
}

export async function getIndustriesAction(savedById?: string) {
  const user = await requireDepartment("leads");
  return getIndustries(scopedUserId(user), savedById);
}

export async function getFoldersByIndustryAction(industryId: string, savedById?: string) {
  const user = await requireDepartment("leads");
  return getFoldersByIndustry(industryId, scopedUserId(user), savedById);
}

export async function getUngroupedFoldersByIndustryAction(industryId: string, savedById?: string) {
  const user = await requireDepartment("leads");
  return getUngroupedFoldersByIndustry(industryId, scopedUserId(user), savedById);
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
  return getSubcategoriesByIndustry(industryId, scopedUserId(user), savedById);
}

export async function getFoldersBySubcategoryAction(subcategoryId: string, savedById?: string) {
  const user = await requireDepartment("leads");
  return getFoldersBySubcategory(subcategoryId, scopedUserId(user), savedById);
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
