"use server";

import { requireAuth } from "@/lib/rbac/guards";
import { createKanbanTask, updateKanbanTask, deleteKanbanTask } from "@/lib/kanban/service";
import { withDbRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";

export async function createTaskAction(data: {
  title: string;
  description?: string;
  priority?: KanbanPriority;
  dueDate?: string;
  tags?: string[];
  assigneeId?: string;
}) {
  const session = await requireAuth();

  if (!data.title?.trim()) return { error: "Title is required." };

  await withDbRetry(() =>
    createKanbanTask({
      ...data,
      title: data.title.trim(),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdById: session.user.id!,
    })
  );

  revalidatePath("/kanban");
  return { success: true };
}

export async function moveTaskAction(id: string, column: KanbanColumn, position: number) {
  await requireAuth();
  await withDbRetry(() => updateKanbanTask(id, { column, position }));
  revalidatePath("/kanban");
  return { success: true };
}

export async function deleteTaskAction(id: string) {
  await requireAuth();
  await withDbRetry(() => deleteKanbanTask(id));
  revalidatePath("/kanban");
  return { success: true };
}
