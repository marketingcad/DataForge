/**
 * Per-keyword access control for the auto-scrape keywords page.
 *
 * Lead specialists are default-deny: they only see/manage keywords a boss/admin
 * has granted them (KeywordAccess rows). Boss/admin bypass grants entirely.
 */
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac/roles";

/** Roles that see and manage every keyword regardless of grants. */
export function hasFullKeywordAccess(role: Role | string | undefined): boolean {
  return role === "boss" || role === "admin";
}

/** The keyword IDs a user has been granted access to. */
export async function getGrantedKeywordIds(userId: string): Promise<string[]> {
  const rows = await prisma.keywordAccess.findMany({
    where: { userId },
    select: { keywordId: true },
  });
  return rows.map((r) => r.keywordId);
}

/** Whether a user may access (view/run/manage) a specific keyword. */
export async function canAccessKeyword(
  user: { id: string; role: string },
  keywordId: string,
): Promise<boolean> {
  if (hasFullKeywordAccess(user.role)) return true;
  const row = await prisma.keywordAccess.findFirst({
    where: { userId: user.id, keywordId },
    select: { id: true },
  });
  return !!row;
}
