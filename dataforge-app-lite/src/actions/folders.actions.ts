"use server";

import { getFolders, createFolder, getOrCreateUngroupedFolder, deleteFolder, updateFolderIndustry, updateFolderSubcategory, renameFolder } from "@/lib/folders/service";
import { requireDepartment } from "@/lib/rbac/guards";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/rbac/roles";

function scopedUserId(user: { id: string; role: string }): string | undefined {
  return (user.role as Role) === "lead_specialist" ? user.id : undefined;
}

export async function getFoldersAction() {
  await requireDepartment("leads");
  return getFolders(); // all roles see all folders
}

export async function createFolderAction(name: string, color: string, industryId?: string | null, subcategoryId?: string | null) {
  const user = await requireDepartment("leads");
  return createFolder(user.id, name.trim(), color, industryId, subcategoryId);
}

/**
 * Resolve (creating if needed) the shared "Ungrouped" folder for a category /
 * subcategory. Used when leads are saved to a category with no specific folder.
 */
export async function getOrCreateUngroupedFolderAction(industryId: string, subcategoryId?: string | null) {
  const user = await requireDepartment("leads");
  const folder = await getOrCreateUngroupedFolder(user.id, industryId, subcategoryId ?? null);
  revalidatePath("/leads");
  return folder;
}

export async function deleteFolderAction(id: string) {
  const user = await requireDepartment("leads");
  return deleteFolder(id, scopedUserId(user));
}

export async function updateFolderCategoryAction(id: string, industryId: string | null) {
  const user = await requireDepartment("leads");
  await updateFolderIndustry(id, scopedUserId(user), industryId);
  revalidatePath("/leads");
}

export async function updateFolderSubcategoryAction(id: string, subcategoryId: string | null) {
  const user = await requireDepartment("leads");
  await updateFolderSubcategory(id, scopedUserId(user), subcategoryId);
  revalidatePath("/leads");
}

export async function renameFolderAction(id: string, name: string) {
  const user = await requireDepartment("leads");
  await renameFolder(id, name.trim(), scopedUserId(user));
  revalidatePath("/leads");
}
