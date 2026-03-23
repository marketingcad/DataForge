import { prisma } from "@/lib/prisma";

export async function getIndustries(userId?: string, savedById?: string) {
  const industries = await prisma.industry.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { folders: true } },
      user: { select: { name: true, email: true } },
      folders: {
        include: {
          leads: savedById
            ? { where: { savedById }, select: { id: true } }
            : false,
          _count: { select: { leads: true } },
        },
      },
    },
  });

  return industries
    .map((ind) => ({
      ...ind,
      totalLeads: savedById
        ? ind.folders.reduce((sum, f) => sum + (f.leads as { id: string }[]).length, 0)
        : ind.folders.reduce((sum, f) => sum + f._count.leads, 0),
    }))
    .filter((ind) => !savedById || ind.totalLeads > 0);
}

export async function getFoldersByIndustry(industryId: string, userId?: string, savedById?: string) {
  const folders = await prisma.folder.findMany({
    where: { industryId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { leads: true } },
      user: { select: { name: true, email: true } },
      ...(savedById
        ? { leads: { where: { savedById }, select: { id: true } } }
        : {}),
    },
  });

  return folders
    .map((f) => ({
      ...f,
      _count: {
        leads: savedById
          ? (f as unknown as { leads: { id: string }[] }).leads.length
          : f._count.leads,
      },
    }))
    .filter((f) => !savedById || f._count.leads > 0);
}

export async function createIndustry(userId: string, name: string, color: string) {
  return prisma.industry.create({
    data: { userId, name: name.trim(), color },
  });
}

export async function deleteIndustry(id: string, userId?: string) {
  return prisma.industry.deleteMany({ where: { id, ...(userId ? { userId } : {}) } });
}
