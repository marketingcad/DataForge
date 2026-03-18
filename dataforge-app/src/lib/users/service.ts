/**
 * User data access — CRUD for User records.
 * Role assignment lives here; permission logic lives in lib/rbac/.
 */

import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac/roles";

export async function getUserById(id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id } });
}

export async function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id:        true,
      name:      true,
      email:     true,
      role:      true,
      createdAt: true,
    },
  });
}

export async function updateUserRole(id: string, role: Role) {
  return prisma.user.update({ where: { id }, data: { role } });
}

export async function getUserCount() {
  return prisma.user.count();
}
