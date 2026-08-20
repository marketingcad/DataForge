"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac/guards";
import { revalidatePath } from "next/cache";

/** Lead specialists + how many categories each currently has access to. Boss/admin only. */
export async function getLeadSpecialistsAction() {
  await requireRole("boss", "admin");
  return prisma.user.findMany({
    where: { role: "lead_specialist" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      image: true,
      _count: { select: { categoryAccess: true } },
    },
  });
}

/** All categories (industries) that can be granted. Boss/admin only. */
export async function getCategoriesForAccessAction() {
  await requireRole("boss", "admin");
  return prisma.industry.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, _count: { select: { folders: true } } },
  });
}

/** The categories a specific user has been granted. Boss/admin only. */
export async function getCategoryAccessAction(userId: string) {
  await requireRole("boss", "admin");
  const rows = await prisma.categoryAccess.findMany({
    where: { userId },
    select: { industryId: true },
  });
  return {
    industryIds: rows.map((r) => r.industryId).filter((id): id is string => !!id),
    uncategorized: rows.some((r) => r.industryId === null),
  };
}

/**
 * Grant or revoke a user's access to one category. industryId = null targets the
 * "Uncategorized" bucket. Idempotent. Boss/admin only.
 */
export async function setCategoryAccessAction(userId: string, industryId: string | null, granted: boolean) {
  await requireRole("boss", "admin");
  const existing = await prisma.categoryAccess.findFirst({ where: { userId, industryId } });
  if (granted && !existing) {
    await prisma.categoryAccess.create({ data: { userId, industryId } });
  } else if (!granted && existing) {
    await prisma.categoryAccess.delete({ where: { id: existing.id } });
  }
  revalidatePath("/leads");
  return { granted };
}
