"use server";

import { auth } from "@/lib/auth";
import { getFolders, createFolder, deleteFolder, updateFolderIndustry } from "@/lib/services/folders.service";
import { revalidatePath } from "next/cache";

function requireUser() {
  return auth().then((s) => {
    if (!s?.user?.id) throw new Error("Not authenticated");
    return s.user.id;
  });
}

export async function getFoldersAction() {
  const userId = await requireUser();
  return getFolders(userId);
}

export async function createFolderAction(
  name: string,
  color: string,
  industryId?: string | null,
) {
  const userId = await requireUser();
  return createFolder(userId, name.trim(), color, industryId);
}

export async function deleteFolderAction(id: string) {
  const userId = await requireUser();
  return deleteFolder(id, userId);
}

export async function updateFolderCategoryAction(id: string, industryId: string | null) {
  const userId = await requireUser();
  await updateFolderIndustry(id, userId, industryId);
  revalidatePath("/leads");
}
