import { prisma } from "@/lib/prisma";

export async function getFolders(userId: string) {
  return prisma.folder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { leads: true } } },
  });
}

export async function createFolder(userId: string, name: string, color: string) {
  return prisma.folder.create({
    data: { userId, name, color },
  });
}

export async function deleteFolder(id: string, userId: string) {
  return prisma.folder.deleteMany({ where: { id, userId } });
}
