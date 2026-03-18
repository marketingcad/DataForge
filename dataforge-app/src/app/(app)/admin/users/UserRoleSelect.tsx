"use client";

import { useState, useTransition } from "react";
import { updateUserRoleAction } from "@/actions/users.actions";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import { useNotifications } from "@/lib/notifications";

interface Props {
  userId: string;
  currentRole: Role;
  assignableRoles: Role[];
  isCurrentUser: boolean;
}

export function UserRoleSelect({ userId, currentRole, assignableRoles, isCurrentUser }: Props) {
  const [role, setRole] = useState<Role>(currentRole);
  const [pending, startTransition] = useTransition();
  const { add } = useNotifications();

  if (isCurrentUser || assignableRoles.length === 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">
        {ROLE_LABELS[role]}
      </span>
    );
  }

  async function handleChange(newRole: Role) {
    setRole(newRole);
    startTransition(async () => {
      try {
        await updateUserRoleAction(userId, newRole);
        add({ title: "Role updated", message: `User role changed to ${ROLE_LABELS[newRole]}`, type: "success" });
      } catch (e) {
        setRole(currentRole);
        add({ title: "Failed", message: (e as Error).message, type: "error" });
      }
    });
  }

  return (
    <select
      value={role}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value as Role)}
      className="text-xs border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
    >
      {ROLE_ORDER_DISPLAY.filter((r) => assignableRoles.includes(r)).map((r) => (
        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
      ))}
    </select>
  );
}

const ROLE_ORDER_DISPLAY: Role[] = ["boss", "admin", "lead_specialist", "sales_rep"];
