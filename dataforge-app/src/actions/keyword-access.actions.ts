"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac/guards";

/** Lead specialists + how many keywords each currently has access to. Boss/admin only. */
export async function getKeywordSpecialistsAction() {
  await requireRole("boss", "admin");
  return prisma.user.findMany({
    where: { role: "lead_specialist" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      _count: { select: { keywordAccess: true } },
    },
  });
}

/** All auto-scrape keywords that can be granted. Boss/admin only. */
export async function getKeywordsForAccessAction() {
  await requireRole("boss", "admin");
  return prisma.scrapingKeyword.findMany({
    orderBy: [{ category: "asc" }, { keyword: "asc" }],
    select: { id: true, keyword: true, location: true, category: true },
  });
}

/** The keyword IDs a specific user has been granted. Boss/admin only. */
export async function getKeywordAccessAction(userId: string) {
  await requireRole("boss", "admin");
  const rows = await prisma.keywordAccess.findMany({
    where: { userId },
    select: { keywordId: true },
  });
  return rows.map((r) => r.keywordId);
}

/** Grant or revoke a user's access to one keyword. Idempotent. Boss/admin only. */
export async function setKeywordAccessAction(userId: string, keywordId: string, granted: boolean) {
  await requireRole("boss", "admin");
  const existing = await prisma.keywordAccess.findFirst({ where: { userId, keywordId } });
  if (granted && !existing) {
    await prisma.keywordAccess.create({ data: { userId, keywordId } });
  } else if (!granted && existing) {
    await prisma.keywordAccess.delete({ where: { id: existing.id } });
  }
  return { granted };
}
