import { prisma } from "@/lib/prisma";

export async function getIndustries(userId?: string) {
  const industries = await prisma.industry.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { folders: true } },
      user: { select: { name: true, email: true } },
      folders: {
        include: { _count: { select: { leads: true } } },
      },
    },
  });

  return industries.map((ind) => ({
    ...ind,
    totalLeads: ind.folders.reduce((sum, f) => sum + f._count.leads, 0),
  }));
}

export async function getFoldersByIndustry(industryId: string, userId?: string) {
  return prisma.folder.findMany({
    where: { industryId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { leads: true } },
      user: { select: { name: true, email: true } },
    },
  });
}

export async function createIndustry(userId: string, name: string, color: string) {
  return prisma.industry.create({
    data: { userId, name: name.trim(), color },
  });
}

export async function deleteIndustry(id: string, userId?: string) {
  return prisma.industry.deleteMany({ where: { id, ...(userId ? { userId } : {}) } });
}
