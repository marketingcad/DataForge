"use server";

import { getFolders, createFolder, deleteFolder, updateFolderIndustry } from "@/lib/folders/service";
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

export async function createFolderAction(name: string, color: string, industryId?: string | null) {
  const user = await requireDepartment("leads");
  return createFolder(user.id, name.trim(), color, industryId);
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
