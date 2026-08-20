"use client";

/**
 * Conditionally renders children based on the current user's role.
 * Pass `currentRole` from the server layout/page via props.
 *
 * Usage:
 *   <RoleGate currentRole={role} allowedRoles={["boss", "admin"]}>
 *     <AdminButton />
 *   </RoleGate>
 */

import { canAccessDepartment, type Role, type Department } from "@/lib/rbac/roles";

interface RoleGateProps {
  children: React.ReactNode;
  currentRole: Role;
  /** Show only if the user has one of these roles */
  allowedRoles?: Role[];
  /** Show only if the user's role grants access to this department */
  requiredDept?: Department;
  /** What to render when access is denied (defaults to nothing) */
  fallback?: React.ReactNode;
}

export function RoleGate({
  children,
  currentRole,
  allowedRoles,
  requiredDept,
  fallback = null,
}: RoleGateProps) {
  let allowed = true;

  if (allowedRoles && !allowedRoles.includes(currentRole)) allowed = false;
  if (requiredDept && !canAccessDepartment(currentRole, requiredDept)) allowed = false;

  return <>{allowed ? children : fallback}</>;
}
