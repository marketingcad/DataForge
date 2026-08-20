import { prisma } from "@/lib/prisma";

/**
 * Attach an `exportedCount` (leads with a non-null exportedAt) to each folder,
 * honoring the same optional savedById scope used for the total lead count.
 * One groupBy for the whole list keeps it to a single extra query.
 */
export async function attachExportedCounts<T extends { id: string }>(
  folders: T[],
  savedById?: string,
): Promise<(T & { exportedCount: number })[]> {
  const ids = folders.map((f) => f.id);
  if (ids.length === 0) return folders.map((f) => ({ ...f, exportedCount: 0 }));
  const grouped = await prisma.lead.groupBy({
    by: ["folderId"],
    where: {
      folderId: { in: ids },
      exportedAt: { not: null },
      ...(savedById ? { savedById } : {}),
    },
    _count: { _all: true },
  });
  const byFolder = new Map(grouped.map((g) => [g.folderId, g._count._all]));
  return folders.map((f) => ({ ...f, exportedCount: byFolder.get(f.id) ?? 0 }));
}

export async function getFolders(userId?: string, savedById?: string) {
  const folders = await prisma.folder.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          leads: savedById ? { where: { savedById } } : true,
        },
      },
      user: { select: { name: true, email: true } },
      industry: { select: { id: true, name: true, color: true } },
      subcategory: { select: { id: true, name: true, color: true } },
    },
  });

  const filtered = folders.filter((f) => !savedById || f._count.leads > 0);
  return attachExportedCounts(filtered, savedById);
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
  subcategoryId?: string | null,
) {
  return prisma.folder.create({
    data: {
      userId,
      name,
      color,
      ...(industryId ? { industryId } : {}),
      ...(subcategoryId ? { subcategoryId } : {}),
    },
  });
}

/**
 * Return the shared "Ungrouped" folder for a category (optionally a subcategory),
 * creating it once if it doesn't exist. This is where leads saved to a category
 * WITHOUT choosing a specific folder land — so they stay inside the category as an
 * openable bucket instead of becoming globally unfiled. One bucket per
 * (industry, subcategory) pair, shared across users (visibility is category-based).
 */
export async function getOrCreateUngroupedFolder(
  userId: string,
  industryId: string,
  subcategoryId?: string | null,
) {
  const where = {
    name: "Ungrouped",
    industryId,
    subcategoryId: subcategoryId ?? null,
  };
  const existing = await prisma.folder.findFirst({
    where,
    select: { id: true, name: true, color: true },
  });
  if (existing) return existing;
  return prisma.folder.create({
    data: {
      userId,
      name: "Ungrouped",
      color: "#64748b",
      industryId,
      ...(subcategoryId ? { subcategoryId } : {}),
    },
    select: { id: true, name: true, color: true },
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

export async function updateFolderSubcategory(
  id: string,
  userId: string | undefined,
  subcategoryId: string | null,
) {
  return prisma.folder.updateMany({
    where: { id, ...(userId ? { userId } : {}) },
    data: { subcategoryId },
  });
}

export async function renameFolder(id: string, name: string, userId?: string) {
  return prisma.folder.updateMany({
    where: { id, ...(userId ? { userId } : {}) },
    data: { name },
  });
}
