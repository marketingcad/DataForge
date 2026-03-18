"use server";

import { getFolders, createFolder, deleteFolder, updateFolderIndustry } from "@/lib/folders/service";
import { requireDepartment } from "@/lib/rbac/guards";
import { revalidatePath } from "next/cache";

export async function getFoldersAction() {
  const user = await requireDepartment("leads");
  return getFolders(user.id);
}

export async function createFolderAction(name: string, color: string, industryId?: string | null) {
  const user = await requireDepartment("leads");
  return createFolder(user.id, name.trim(), color, industryId);
}

export async function deleteFolderAction(id: string) {
  const user = await requireDepartment("leads");
  return deleteFolder(id, user.id);
}

export async function updateFolderCategoryAction(id: string, industryId: string | null) {
  const user = await requireDepartment("leads");
  await updateFolderIndustry(id, user.id, industryId);
  revalidatePath("/leads");
}
