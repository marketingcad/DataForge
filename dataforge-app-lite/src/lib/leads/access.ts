/**
 * Category-level access control for the leads page.
 *
 * Lead specialists are default-deny: they see a category only if a boss/admin
 * has granted it via the CategoryAccess table. Boss/admin see everything.
 * A grant with industryId = null means access to the "Uncategorized" bucket
 * (folders with no category + leads in no folder).
 */
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac/roles";

export interface CategoryGrants {
  industryIds: string[];
  uncategorized: boolean;
}

/** Roles that bypass category grants and see all leads. */
export function hasFullLeadAccess(role: Role | string | undefined): boolean {
  return role === "boss" || role === "admin";
}

/** The categories a given user has been granted. */
export async function getCategoryGrants(userId: string): Promise<CategoryGrants> {
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
 * Whether a scoped user may see content in the given category.
 * industryId = null / undefined tests the Uncategorized bucket.
 */
export function canSeeCategory(grants: CategoryGrants, industryId: string | null | undefined): boolean {
  if (!industryId) return grants.uncategorized;
  return grants.industryIds.includes(industryId);
}

/**
 * A Prisma `Lead` where-fragment restricting rows to the user's granted
 * categories. Meant to be pushed into an AND array. When the user has no
 * grants at all it matches nothing.
 */
export function leadAccessWhere(grants: CategoryGrants): Record<string, unknown> {
  const or: Record<string, unknown>[] = [];
  if (grants.industryIds.length) {
    or.push({ folder: { industryId: { in: grants.industryIds } } });
  }
  if (grants.uncategorized) {
    or.push({ folderId: null });
    or.push({ folder: { is: { industryId: null } } });
  }
  return or.length ? { OR: or } : { id: "__no_category_access__" };
}
