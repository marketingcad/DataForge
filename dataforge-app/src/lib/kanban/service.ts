import { prisma } from "@/lib/prisma";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";

const TASK_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  assignee:  { select: { id: true, name: true, role: true } },
  comments: {
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function getKanbanTasks() {
  return prisma.kanbanTask.findMany({
    include: TASK_INCLUDE,
    orderBy: [{ column: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
}

export async function getKanbanTask(id: string) {
  return prisma.kanbanTask.findUniqueOrThrow({ where: { id }, include: TASK_INCLUDE });
}

export async function createKanbanTask(data: {
  title: string;
  description?: string;
  column?: KanbanColumn;
  priority?: KanbanPriority;
  dueDate?: Date;
  tags?: string[];
  createdById: string;
  assigneeId?: string;
}) {
  const count = await prisma.kanbanTask.count({ where: { column: data.column ?? "backlog" } });
  return prisma.kanbanTask.create({ data: { ...data, position: count }, include: TASK_INCLUDE });
}

export async function updateKanbanTask(id: string, data: {
  title?: string;
  description?: string;
  column?: KanbanColumn;
  priority?: KanbanPriority;
  dueDate?: Date | null;
  tags?: string[];
  assigneeId?: string | null;
  position?: number;
}) {
  return prisma.kanbanTask.update({ where: { id }, data, include: TASK_INCLUDE });
}

export async function deleteKanbanTask(id: string) {
  return prisma.kanbanTask.delete({ where: { id } });
}

export async function addKanbanComment(taskId: string, authorId: string, content: string) {
  return prisma.kanbanComment.create({
    data: { taskId, authorId, content },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
}
