import { prisma } from "@/lib/prisma";

export async function getFolders(userId: string) {
  return prisma.folder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { leads: true } },
      user: { select: { name: true, email: true } },
    },
  });
}

export async function getFoldersWithLeads(userId: string) {
  return prisma.folder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { leads: true } },
      leads: {
        orderBy: [{ dataQualityScore: "desc" }, { dateCollected: "desc" }],
        take: 30,
        select: {
          id: true,
          businessName: true,
          phone: true,
          email: true,
          website: true,
          city: true,
          state: true,
        },
      },
    },
  });
}

export async function createFolder(
  userId: string,
  name: string,
  color: string,
  industryId?: string | null,
) {
  return prisma.folder.create({
    data: { userId, name, color, ...(industryId ? { industryId } : {}) },
  });
}

export async function deleteFolder(id: string, userId: string) {
  return prisma.folder.deleteMany({ where: { id, userId } });
}

export async function updateFolderIndustry(
  id: string,
  userId: string,
  industryId: string | null,
) {
  return prisma.folder.updateMany({
    where: { id, userId },
    data: { industryId },
  });
}
