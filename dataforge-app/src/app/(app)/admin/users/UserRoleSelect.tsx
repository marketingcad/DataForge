"use client";

import { useState, useTransition } from "react";
import { updateUserRoleAction } from "@/actions/users.actions";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import { useNotifications } from "@/lib/notifications";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ROLE_ORDER_DISPLAY: Role[] = ["boss", "admin", "lead_specialist", "sales_rep"];

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
    return <Badge variant="secondary" className="text-xs">{ROLE_LABELS[role]}</Badge>;
  }

  function handleChange(newRole: string | null) {
    if (!newRole) return;
    const r = newRole as Role;
    setRole(r);
    startTransition(async () => {
      try {
        await updateUserRoleAction(userId, r);
        add({ title: "Role updated", message: `User role changed to ${ROLE_LABELS[r]}`, type: "success" });
      } catch (e) {
        setRole(currentRole);
        add({ title: "Failed", message: (e as Error).message, type: "error" });
      }
    });
  }

  return (
    <Select value={role} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger className="h-7 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_ORDER_DISPLAY.filter((r) => assignableRoles.includes(r)).map((r) => (
          <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
