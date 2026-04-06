"use server";

import { requireRole } from "@/lib/rbac/requireRole";
import { createBadge, updateBadge, deleteBadge } from "@/lib/marketing/badges.service";
import { revalidatePath } from "next/cache";

export async function createBadgeAction(formData: FormData) {
  await requireRole("boss", "admin");

  const criteriaValueRaw = formData.get("criteriaValue") as string;

  await createBadge({
    key:           (formData.get("key") as string).trim().toLowerCase().replace(/\s+/g, "_"),
    name:          (formData.get("name") as string).trim(),
    description:   (formData.get("description") as string).trim(),
    icon:          (formData.get("icon") as string).trim() || "🏅",
    color:         (formData.get("color") as string) || "#6366f1",
    imageUrl:      (formData.get("imageUrl") as string) || null,
    criteriaType:  (formData.get("criteriaType") as string) || null,
    criteriaValue: criteriaValueRaw ? parseInt(criteriaValueRaw, 10) : null,
  });

  revalidatePath("/marketing/manage/badges");
}

export async function updateBadgeAction(id: string, formData: FormData) {
  await requireRole("boss", "admin");

  const criteriaValueRaw = formData.get("criteriaValue") as string;

  await updateBadge(id, {
    key:           (formData.get("key") as string).trim().toLowerCase().replace(/\s+/g, "_"),
    name:          (formData.get("name") as string).trim(),
    description:   (formData.get("description") as string).trim(),
    icon:          (formData.get("icon") as string).trim() || "🏅",
    color:         (formData.get("color") as string) || "#6366f1",
    imageUrl:      (formData.get("imageUrl") as string) || null,
    criteriaType:  (formData.get("criteriaType") as string) || null,
    criteriaValue: criteriaValueRaw ? parseInt(criteriaValueRaw, 10) : null,
  });

  revalidatePath("/marketing/manage/badges");
}

export async function deleteBadgeAction(id: string) {
  await requireRole("boss", "admin");
  await deleteBadge(id);
  revalidatePath("/marketing/manage/badges");
}
