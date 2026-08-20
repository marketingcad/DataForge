import { prisma } from "@/lib/prisma";

export async function getAllBadges() {
  return prisma.badge.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { userBadges: true } } },
  });
}

export async function createBadge(data: {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  imageUrl?: string | null;
  criteriaType?: string | null;
  criteriaValue?: number | null;
}) {
  return prisma.badge.create({ data });
}

export async function updateBadge(
  id: string,
  data: {
    key?: string;
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    imageUrl?: string | null;
    criteriaType?: string | null;
    criteriaValue?: number | null;
  }
) {
  return prisma.badge.update({ where: { id }, data });
}

export async function deleteBadge(id: string) {
  return prisma.badge.delete({ where: { id } });
}
