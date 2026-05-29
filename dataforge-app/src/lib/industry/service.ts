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
          _count: {
            select: {
              leads: savedById ? { where: { savedById } } : true,
            },
          },
        },
      },
    },
  });

  return industries
    .map((ind) => ({
      ...ind,
      totalLeads: ind.folders.reduce((sum, f) => sum + f._count.leads, 0),
    }))
    .filter((ind) => !savedById || ind.totalLeads > 0);
}

export async function getFoldersByIndustry(industryId: string, userId?: string, savedById?: string) {
  const folders = await prisma.folder.findMany({
    where: { industryId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          leads: savedById ? { where: { savedById } } : true,
        },
      },
      user: { select: { name: true, email: true } },
    },
  });

  return folders.filter((f) => !savedById || f._count.leads > 0);
}

export async function getUngroupedFoldersByIndustry(industryId: string, userId?: string, savedById?: string) {
  const folders = await prisma.folder.findMany({
    where: { industryId, subcategoryId: null, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          leads: savedById ? { where: { savedById } } : true,
        },
      },
      user: { select: { name: true, email: true } },
    },
  });

  return folders.filter((f) => !savedById || f._count.leads > 0);
}

export async function createIndustry(userId: string, name: string, color: string) {
  return prisma.industry.create({
    data: { userId, name: name.trim(), color },
  });
}

export async function updateIndustry(id: string, name: string, color: string, userId?: string) {
  return prisma.industry.updateMany({
    where: { id, ...(userId ? { userId } : {}) },
    data: { name: name.trim(), color },
  });
}

export async function deleteIndustry(id: string, userId?: string) {
  return prisma.industry.deleteMany({ where: { id, ...(userId ? { userId } : {}) } });
}

// --- Subcategory ---

export async function getSubcategoriesByIndustry(industryId: string, userId?: string, savedById?: string) {
  const subcategories = await prisma.subcategory.findMany({
    where: { industryId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { folders: true } },
      folders: {
        include: {
          _count: {
            select: {
              leads: savedById ? { where: { savedById } } : true,
            },
          },
        },
      },
    },
  });

  return subcategories.map((sub) => ({
    ...sub,
    totalLeads: sub.folders.reduce((sum, f) => sum + f._count.leads, 0),
  }));
}

export async function getFoldersBySubcategory(subcategoryId: string, userId?: string, savedById?: string) {
  const folders = await prisma.folder.findMany({
    where: { subcategoryId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          leads: savedById ? { where: { savedById } } : true,
        },
      },
      user: { select: { name: true, email: true } },
    },
  });

  return folders.filter((f) => !savedById || f._count.leads > 0);
}

export async function createSubcategory(userId: string, industryId: string, name: string, color: string) {
  return prisma.subcategory.create({
    data: { userId, industryId, name: name.trim(), color },
  });
}

export async function updateSubcategory(id: string, name: string, color: string, userId?: string) {
  return prisma.subcategory.updateMany({
    where: { id, ...(userId ? { userId } : {}) },
    data: { name: name.trim(), color },
  });
}

export async function deleteSubcategory(id: string, userId?: string) {
  return prisma.subcategory.deleteMany({ where: { id, ...(userId ? { userId } : {}) } });
}
