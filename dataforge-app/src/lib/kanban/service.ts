import { prisma } from "@/lib/prisma";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";

export async function getKanbanTasks() {
  return prisma.kanbanTask.findMany({
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee:  { select: { id: true, name: true } },
    },
    orderBy: [{ column: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
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
  return prisma.kanbanTask.create({ data: { ...data, position: count } });
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
  return prisma.kanbanTask.update({ where: { id }, data });
}

export async function deleteKanbanTask(id: string) {
  return prisma.kanbanTask.delete({ where: { id } });
}
