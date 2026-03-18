"use server";

import { auth } from "@/lib/auth";
import {
  getIndustries,
  getFoldersByIndustry,
  createIndustry,
  deleteIndustry,
} from "@/lib/industry/service";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) throw new Error("Not authenticated");
  return s.user.id;
}

export async function getIndustriesAction() {
  const userId = await requireUser();
  return getIndustries(userId);
}

export async function getFoldersByIndustryAction(industryId: string) {
  const userId = await requireUser();
  return getFoldersByIndustry(industryId, userId);
}

export async function createIndustryAction(name: string, color: string) {
  const userId = await requireUser();
  const industry = await createIndustry(userId, name, color);
  revalidatePath("/leads");
  return industry;
}

export async function deleteIndustryAction(id: string) {
  const userId = await requireUser();
  await deleteIndustry(id, userId);
  revalidatePath("/leads");
}
