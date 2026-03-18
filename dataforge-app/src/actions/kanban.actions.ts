"use server";

import { requireAuth, requireRole } from "@/lib/rbac/guards";
import {
  createKanbanTask,
  updateKanbanTask,
  deleteKanbanTask,
  addKanbanComment,
  getKanbanTask,
} from "@/lib/kanban/service";
import { createNotification, createNotificationsForRole } from "@/lib/notifications/service";
import { withDbRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";

/* ── Create task (boss/admin only — they own the board) ── */
export async function createTaskAction(data: {
  title: string;
  description?: string;
  priority?: KanbanPriority;
  dueDate?: string;
  tags?: string[];
  assigneeId?: string;
}) {
  const user = await requireRole("boss", "admin");
  if (!data.title?.trim()) return { error: "Title is required." };

  const task = await withDbRetry(() =>
    createKanbanTask({
      ...data,
      title: data.title.trim(),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdById: user.id,
    })
  );

  // Notify assignee if set
  if (data.assigneeId) {
    await withDbRetry(() =>
      createNotification({
        userId: data.assigneeId!,
        type: "info",
        title: "New task assigned to you",
        message: `"${task.title}" — ${data.priority ?? "medium"} priority`,
        link: "/kanban",
      })
    );
  }

  revalidatePath("/kanban");
  return { success: true, task };
}

/* ── Move task — role-based rules ── */
export async function moveTaskAction(taskId: string, column: KanbanColumn) {
  const session = await requireAuth();
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  const isAdmin = role === "boss" || role === "admin";

  const task = await withDbRetry(() => getKanbanTask(taskId));

  // Regular users: can only move to in_review (Submit for QA)
  if (!isAdmin) {
    if (task.assigneeId !== session.user.id) return { error: "You can only move tasks assigned to you." };
    if (column !== "in_review") return { error: "You can only submit tasks for QA review." };
  }

  // Boss/admin: can move freely (including back to in_progress from done/in_review)
  const updated = await withDbRetry(() => updateKanbanTask(taskId, { column }));

  // Notify relevant parties
  if (!isAdmin && column === "in_review") {
    // Assignee submitted for review — notify boss/admin
    await withDbRetry(() =>
      createNotificationsForRole(["boss", "admin"], {
        type: "info",
        title: "Task ready for QA review",
        message: `"${task.title}" was submitted for review by ${task.assignee?.name ?? "a team member"}`,
        link: "/kanban",
      })
    );
  }

  if (isAdmin && column === "done" && task.assigneeId) {
    // Boss/admin approved — notify assignee
    await withDbRetry(() =>
      createNotification({
        userId: task.assigneeId!,
        type: "success",
        title: "Task approved ✓",
        message: `"${task.title}" was marked as Done`,
        link: "/kanban",
      })
    );
  }

  if (isAdmin && column === "in_progress" && (task.column === "in_review" || task.column === "done") && task.assigneeId) {
    // Sent back — notify assignee
    await withDbRetry(() =>
      createNotification({
        userId: task.assigneeId!,
        type: "warning",
        title: "Task sent back to In Progress",
        message: `"${task.title}" needs more work`,
        link: "/kanban",
      })
    );
  }

  revalidatePath("/kanban");
  return { success: true, task: updated };
}

/* ── Update task details (boss/admin only) ── */
export async function updateTaskAction(id: string, data: {
  title?: string;
  description?: string;
  priority?: KanbanPriority;
  dueDate?: string | null;
  tags?: string[];
  assigneeId?: string | null;
}) {
  const user = await requireRole("boss", "admin");

  const prev = await withDbRetry(() => getKanbanTask(id));

  const updated = await withDbRetry(() =>
    updateKanbanTask(id, {
      ...data,
      dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
    })
  );

  // If assignee changed, notify the new assignee
  if (data.assigneeId && data.assigneeId !== prev.assigneeId) {
    await withDbRetry(() =>
      createNotification({
        userId: data.assigneeId!,
        type: "info",
        title: "Task assigned to you",
        message: `"${updated.title}" — assigned by ${user.name ?? "admin"}`,
        link: "/kanban",
      })
    );
  }

  revalidatePath("/kanban");
  return { success: true, task: updated };
}

/* ── Delete task (boss/admin only) ── */
export async function deleteTaskAction(id: string) {
  await requireRole("boss", "admin");
  await withDbRetry(() => deleteKanbanTask(id));
  revalidatePath("/kanban");
  return { success: true };
}

/* ── Add comment (any authenticated user) ── */
export async function addCommentAction(taskId: string, content: string) {
  const session = await requireAuth();
  if (!content?.trim()) return { error: "Comment cannot be empty." };

  const comment = await withDbRetry(() =>
    addKanbanComment(taskId, session.user.id!, content.trim())
  );

  // Notify task assignee (if it's not the commenter)
  const task = await withDbRetry(() => getKanbanTask(taskId));
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  const isAdmin = role === "boss" || role === "admin";

  if (task.assigneeId && task.assigneeId !== session.user.id) {
    await withDbRetry(() =>
      createNotification({
        userId: task.assigneeId!,
        type: "info",
        title: "New comment on your task",
        message: `"${task.title}": ${content.trim().slice(0, 60)}`,
        link: "/kanban",
      })
    );
  }
  // If a non-admin commented, notify boss/admin too
  if (!isAdmin) {
    await withDbRetry(() =>
      createNotificationsForRole(["boss", "admin"], {
        type: "info",
        title: "Comment on task",
        message: `"${task.title}": ${content.trim().slice(0, 60)}`,
        link: "/kanban",
      })
    );
  }

  return { success: true, comment };
}
