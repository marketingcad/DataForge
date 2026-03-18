"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac/guards";
import { canCreateRole, type Role } from "@/lib/rbac/roles";
import { getUsers, updateUserRole } from "@/lib/users/service";
import { auth } from "@/lib/auth";

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
