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
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id:        true,
      name:      true,
      nickname:  true,
      email:     true,
      role:      true,
      points:    true,
      createdAt: true,
      _count: {
        select: {
          callLogs:   { where: { calledAt: { gte: startOfMonth } } },
          userBadges: true,
          savedLeads: true,
        },
      },
    },
  });
}

export async function updateUserRole(id: string, role: Role) {
  return prisma.user.update({ where: { id }, data: { role } });
}

export async function getUserCount() {
  return prisma.user.count();
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: Role;
  ghlUserId?: string | null;
  nickname?: string | null;
}) {
  return prisma.user.create({ data });
}

export async function updateUserGhlLink(id: string, ghlUserId: string | null) {
  return prisma.user.update({ where: { id }, data: { ghlUserId } });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
