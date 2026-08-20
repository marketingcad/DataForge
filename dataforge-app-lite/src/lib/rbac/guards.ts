/**
 * Server-side RBAC guards.
 * Import and call these at the top of server actions and server components
 * to enforce role and department access before any business logic runs.
 */

import { auth } from "@/lib/auth";
import { ROLE_DEPARTMENTS, type Role, type Department } from "./roles";
import { getUserById } from "@/lib/users/service";
import { withDbRetry } from "@/lib/prisma";

/** Throws if the caller is not authenticated. Returns the session. */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  return session;
}

/**
 * Throws if the caller does not have one of the specified roles.
 * Returns the full user record (with role).
 */
export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  const user = await withDbRetry(() => getUserById(session.user.id!));
  if (!roles.includes(user.role as Role)) {
    throw new Error(`Access denied. Required role: ${roles.join(" or ")}`);
  }
  return user;
}

/**
 * Throws if the caller's role does not grant access to the given department.
 * Returns the full user record (with role).
 */
export async function requireDepartment(dept: Department) {
  const session = await requireAuth();
  const user = await withDbRetry(() => getUserById(session.user.id!));
  const allowed = ROLE_DEPARTMENTS[user.role as Role] ?? [];
  if (!allowed.includes(dept)) {
    throw new Error(`Access denied. You do not have access to the '${dept}' department.`);
  }
  return user;
}

/**
 * Returns the current user's role from the session JWT (no DB call).
 * Returns "lead_specialist" as the safest fallback if role is missing.
 */
export async function getSessionRole(): Promise<Role> {
  const session = await auth();
  return ((session?.user as unknown as Record<string, unknown>)?.role as Role) ?? "lead_specialist";
}
