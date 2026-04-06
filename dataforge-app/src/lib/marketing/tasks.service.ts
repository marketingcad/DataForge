import { prisma } from "@/lib/prisma";

export async function getAllTasks() {
  return prisma.marketingTask.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { progress: true } },
      progress: { where: { completed: true }, select: { id: true } },
    },
  });
}

export async function createTask(data: {
  title: string;
  description?: string | null;
  targetCalls: number;
  pointReward: number;
  startDate: Date;
  endDate: Date;
  createdById?: string;
}) {
  return prisma.marketingTask.create({ data });
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    targetCalls?: number;
    pointReward?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  return prisma.marketingTask.update({ where: { id }, data });
}

export async function deleteTask(id: string) {
  return prisma.marketingTask.delete({ where: { id } });
}
