"use server";

import { requireRole } from "@/lib/rbac/guards";
import {
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
} from "@/lib/marketing/commissions.service";
import { revalidatePath } from "next/cache";

export async function createCommissionRuleAction(formData: FormData) {
  await requireRole("boss", "admin");

  const milestoneRaw = formData.get("milestoneTarget") as string;

  await createCommissionRule({
    name:            (formData.get("name") as string).trim(),
    description:     (formData.get("description") as string)?.trim() || null,
    type:            formData.get("type") as string,
    amount:          parseFloat(formData.get("amount") as string),
    milestoneTarget: milestoneRaw ? parseInt(milestoneRaw, 10) : null,
    period:          formData.get("period") as string,
    active:          formData.get("active") === "true",
  });

  revalidatePath("/marketing/manage/commissions");
}

export async function updateCommissionRuleAction(id: string, formData: FormData) {
  await requireRole("boss", "admin");

  const milestoneRaw = formData.get("milestoneTarget") as string;

  await updateCommissionRule(id, {
    name:            (formData.get("name") as string).trim(),
    description:     (formData.get("description") as string)?.trim() || null,
    type:            formData.get("type") as string,
    amount:          parseFloat(formData.get("amount") as string),
    milestoneTarget: milestoneRaw ? parseInt(milestoneRaw, 10) : null,
    period:          formData.get("period") as string,
    active:          formData.get("active") === "true",
  });

  revalidatePath("/marketing/manage/commissions");
}

export async function deleteCommissionRuleAction(id: string) {
  await requireRole("boss", "admin");
  await deleteCommissionRule(id);
  revalidatePath("/marketing/manage/commissions");
}
