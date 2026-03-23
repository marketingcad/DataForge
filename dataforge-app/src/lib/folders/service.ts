import { prisma } from "@/lib/prisma";

export async function getFolders(userId?: string, savedById?: string) {
  const folders = await prisma.folder.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { leads: true } },
      user: { select: { name: true, email: true } },
      industry: { select: { id: true, name: true, color: true } },
      ...(savedById ? { leads: { where: { savedById }, select: { id: true } } } : {}),
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

export async function deleteFolder(id: string, userId?: string) {
  return prisma.folder.deleteMany({ where: { id, ...(userId ? { userId } : {}) } });
}

export async function updateFolderIndustry(
  id: string,
  userId: string | undefined,
  industryId: string | null,
) {
  return prisma.folder.updateMany({
    where: { id, ...(userId ? { userId } : {}) },
    data: { industryId },
  });
}
