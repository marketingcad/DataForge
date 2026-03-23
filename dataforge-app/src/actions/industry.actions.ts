"use server";

import { getIndustries, getFoldersByIndustry, createIndustry, deleteIndustry } from "@/lib/industry/service";
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

export async function createIndustryAction(name: string, color: string) {
  const user = await requireDepartment("leads");
  const industry = await createIndustry(user.id, name, color);
  revalidatePath("/leads");
  return industry;
}

export async function deleteIndustryAction(id: string) {
  const user = await requireDepartment("leads");
  await deleteIndustry(id, scopedUserId(user));
  revalidatePath("/leads");
}
