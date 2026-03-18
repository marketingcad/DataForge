"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac/guards";
import { canCreateRole, type Role } from "@/lib/rbac/roles";
import { getUsers, updateUserRole, createUser, deleteUser } from "@/lib/users/service";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function getUsersAction() {
  await requireRole("boss", "admin");
  return getUsers();
}

export async function updateUserRoleAction(targetUserId: string, newRole: Role) {
  const actor = await requireRole("boss", "admin");
  const session = await auth();

  // Cannot change your own role
  if (actor.id === session?.user?.id) {
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
}) {
  const actor = await requireRole("boss", "admin");

  if (!canCreateRole(actor.role as Role, formData.role)) {
    throw new Error(`You are not allowed to create a user with the '${formData.role}' role.`);
  }

  if (!formData.email || !formData.password) throw new Error("Email and password are required.");
  if (formData.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const existing = await prisma.user.findUnique({ where: { email: formData.email } });
  if (existing) throw new Error("An account with that email already exists.");

  const hashed = await bcrypt.hash(formData.password, 12);
  await createUser({ name: formData.name, email: formData.email, password: hashed, role: formData.role });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(targetUserId: string) {
  const actor = await requireRole("boss", "admin");
  const session = await auth();

  if (actor.id === session?.user?.id) throw new Error("You cannot delete your own account.");

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target) throw new Error("User not found.");
  if (!canCreateRole(actor.role as Role, target.role as Role)) {
    throw new Error("You do not have permission to delete this user.");
  }

  await deleteUser(targetUserId);
  revalidatePath("/admin/users");
}
