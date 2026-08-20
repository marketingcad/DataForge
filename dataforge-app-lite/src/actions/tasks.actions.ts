"use server";

import { requireRole } from "@/lib/rbac/guards";
import { createTask, updateTask, deleteTask } from "@/lib/marketing/tasks.service";
import { revalidatePath } from "next/cache";

export async function createTaskAction(formData: FormData) {
  const user = await requireRole("boss", "admin");

  await createTask({
    title:       (formData.get("title") as string).trim(),
    description: (formData.get("description") as string)?.trim() || null,
    targetCalls: parseInt(formData.get("targetCalls") as string, 10),
    pointReward: parseInt(formData.get("pointReward") as string, 10),
    startDate:   new Date(formData.get("startDate") as string),
    endDate:     new Date(formData.get("endDate") as string),
    createdById: user.id,
  });

  revalidatePath("/marketing/manage/tasks");
  revalidatePath("/marketing");
}

export async function updateTaskAction(id: string, formData: FormData) {
  await requireRole("boss", "admin");

  await updateTask(id, {
    title:       (formData.get("title") as string).trim(),
    description: (formData.get("description") as string)?.trim() || null,
    targetCalls: parseInt(formData.get("targetCalls") as string, 10),
    pointReward: parseInt(formData.get("pointReward") as string, 10),
    startDate:   new Date(formData.get("startDate") as string),
    endDate:     new Date(formData.get("endDate") as string),
  });

  revalidatePath("/marketing/manage/tasks");
  revalidatePath("/marketing");
}

export async function deleteTaskAction(id: string) {
  await requireRole("boss", "admin");
  await deleteTask(id);
  revalidatePath("/marketing/manage/tasks");
  revalidatePath("/marketing");
}
