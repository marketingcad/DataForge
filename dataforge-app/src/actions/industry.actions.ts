"use server";

import { getIndustries, getFoldersByIndustry, createIndustry, deleteIndustry } from "@/lib/industry/service";
import { requireDepartment } from "@/lib/rbac/guards";
import { revalidatePath } from "next/cache";

export async function getIndustriesAction() {
  const user = await requireDepartment("leads");
  return getIndustries(user.id);
}

export async function getFoldersByIndustryAction(industryId: string) {
  const user = await requireDepartment("leads");
  return getFoldersByIndustry(industryId, user.id);
}

export async function createIndustryAction(name: string, color: string) {
  const user = await requireDepartment("leads");
  const industry = await createIndustry(user.id, name, color);
  revalidatePath("/leads");
  return industry;
}

export async function deleteIndustryAction(id: string) {
  const user = await requireDepartment("leads");
  await deleteIndustry(id, user.id);
  revalidatePath("/leads");
}
