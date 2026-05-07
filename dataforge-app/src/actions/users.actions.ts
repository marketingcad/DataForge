"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac/guards";
import { canCreateRole, type Role } from "@/lib/rbac/roles";
import { getUsers, updateUserRole, createUser, deleteUser, updateUserGhlLink } from "@/lib/users/service";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { prisma, withDbRetry } from "@/lib/prisma";

export async function getUsersAction() {
  await requireRole("boss", "admin");
  return getUsers();
}

export async function updateUserRoleAction(targetUserId: string, newRole: Role) {
  const actor = await requireRole("boss", "admin");

  // Cannot change your own role
  if (targetUserId === actor.id) {
    throw new Error("You cannot change your own role.");
  }

  // Enforce creatable roles
  if (!canCreateRole(actor.role as Role, newRole)) {
    throw new Error(`You are not allowed to assign the '${newRole}' role.`);
  }

  await updateUserRole(targetUserId, newRole);
  revalidatePath("/admin/users");
}

export async function createUserAction(formData: {
  name: string;
  email: string;
  password: string;
  role: Role;
  ghlUserId?: string | null;
  nickname?: string | null;
}) {
  const actor = await requireRole("boss", "admin");

  if (formData.role === "sales_rep") {
    throw new Error("Sales Rep accounts must be created via GHL import.");
  }

  if (!canCreateRole(actor.role as Role, formData.role)) {
    throw new Error(`You are not allowed to create a user with the '${formData.role}' role.`);
  }

  if (!formData.email || !formData.password) throw new Error("Email and password are required.");
  if (formData.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const existing = await prisma.user.findUnique({ where: { email: formData.email } });
  if (existing) throw new Error("An account with that email already exists.");

  const hashed = await bcrypt.hash(formData.password, 12);
  await createUser({
    name: formData.name,
    email: formData.email,
    password: hashed,
    role: formData.role,
    ghlUserId: formData.ghlUserId || null,
    nickname: formData.nickname?.trim() || null,
  });
  revalidatePath("/admin/users");
}

export async function updateUserNicknameAction(targetUserId: string, nickname: string) {
  await requireRole("boss", "admin");
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target) throw new Error("User not found.");
  if (!["sales_rep", "lead_specialist"].includes(target.role)) {
    throw new Error("Nicknames can only be set for Sales Reps and Lead Data Specialists.");
  }
  await prisma.user.update({ where: { id: targetUserId }, data: { nickname: nickname.trim() || null } });
  revalidatePath("/admin/users");
}

export async function updateUserGhlLinkAction(targetUserId: string, ghlUserId: string | null) {
  await requireRole("boss", "admin");
  await updateUserGhlLink(targetUserId, ghlUserId || null);
  revalidatePath("/admin/users");
}

export async function importGhlAgentsAction(
  agents: { ghlUserId: string; name: string; email: string; role: Role }[]
) {
  await requireRole("boss", "admin");
  if (!agents.length) throw new Error("No agents selected.");

  const results: { name: string; email: string; tempPassword?: string; error?: string }[] = [];

  const tempPassword = "Password123";

  for (const agent of agents) {

    try {
      const existing = await prisma.user.findUnique({ where: { email: agent.email } });
      if (existing) {
        // Already exists — just link the ghlUserId
        await prisma.user.update({ where: { id: existing.id }, data: { ghlUserId: agent.ghlUserId } });
        results.push({ name: agent.name, email: agent.email, tempPassword: undefined });
        continue;
      }
      const hashed = await bcrypt.hash(tempPassword, 12);
      await createUser({
        name: agent.name,
        email: agent.email,
        password: hashed,
        role: agent.role,
        ghlUserId: agent.ghlUserId,
      });
      results.push({ name: agent.name, email: agent.email, tempPassword });
    } catch (err) {
      results.push({ name: agent.name, email: agent.email, error: (err as Error).message });
    }
  }

  revalidatePath("/admin/users");
  return results;
}

export async function updateUserEmailAction(targetUserId: string, email: string) {
  await requireRole("boss", "admin");
  if (!email) throw new Error("Email is required.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== targetUserId) throw new Error("Email is already in use by another account.");

  await prisma.user.update({ where: { id: targetUserId }, data: { email } });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(targetUserId: string) {
  const actor = await requireRole("boss", "admin");

  if (actor.id === targetUserId) throw new Error("You cannot delete your own account.");

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target) throw new Error("User not found.");
  if (!canCreateRole(actor.role as Role, target.role as Role)) {
    throw new Error("You do not have permission to delete this user.");
  }

  await deleteUser(targetUserId);
  revalidatePath("/admin/users");
}

export async function banUserAction(targetUserId: string, reason: string) {
  const actor = await requireRole("boss", "admin");
  if (actor.id === targetUserId) throw new Error("You cannot ban yourself.");
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target) throw new Error("User not found.");
  if (!canCreateRole(actor.role as Role, target.role as Role)) throw new Error("You do not have permission to ban this user.");
  await prisma.user.update({
    where: { id: targetUserId },
    data: { isBanned: true, bannedUntil: null, banReason: reason.trim() || null },
  });
  revalidatePath(`/admin/users/${targetUserId}`);
  revalidatePath("/admin/users");
}

export async function suspendUserAction(targetUserId: string, until: Date, reason: string) {
  const actor = await requireRole("boss", "admin");
  if (actor.id === targetUserId) throw new Error("You cannot suspend yourself.");
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target) throw new Error("User not found.");
  if (!canCreateRole(actor.role as Role, target.role as Role)) throw new Error("You do not have permission to suspend this user.");
  if (until <= new Date()) throw new Error("Suspension end date must be in the future.");
  await prisma.user.update({
    where: { id: targetUserId },
    data: { isBanned: true, bannedUntil: until, banReason: reason.trim() || null },
  });
  revalidatePath(`/admin/users/${targetUserId}`);
  revalidatePath("/admin/users");
}

export async function unbanUserAction(targetUserId: string) {
  const actor = await requireRole("boss", "admin");
  if (actor.id === targetUserId) throw new Error("You cannot unban yourself.");
  await prisma.user.update({
    where: { id: targetUserId },
    data: { isBanned: false, bannedUntil: null, banReason: null },
  });
  revalidatePath(`/admin/users/${targetUserId}`);
  revalidatePath("/admin/users");
}

export async function changeUserPasswordAction(targetUserId: string, newPassword: string) {
  const actor = await requireRole("boss", "admin");
  if (actor.id === targetUserId) throw new Error("Use your account settings to change your own password.");
  if (!newPassword || newPassword.length < 8) throw new Error("Password must be at least 8 characters.");

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target) throw new Error("User not found.");
  if (!canCreateRole(actor.role as Role, target.role as Role)) {
    throw new Error("You do not have permission to change this user's password.");
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: targetUserId }, data: { password: hashed } });
  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function getUserDetailAction(userId: string) {
  await requireRole("boss", "admin");
  return withDbRetry(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [user, callsToday, callsThisWeek, callsThisMonth] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          userBadges: {
            include: { badge: true },
            orderBy: { earnedAt: "desc" },
          },
          callLogs: {
            orderBy: { calledAt: "desc" },
            take: 5,
          },
          _count: { select: { callLogs: true, userBadges: true } },
        },
      }),
      prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: todayStart } } }),
      prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: weekStart  } } }),
      prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: monthStart } } }),
    ]);

    return { user, callsToday, callsThisWeek, callsThisMonth };
  });
}
