/**
 * Role-Based Access Control — central source of truth.
 * All permission logic lives here. Never scatter permission checks across the app.
 */

export type Role = "boss" | "admin" | "team_lead" | "sales_rep" | "lead_specialist";
export type Department = "leads" | "marketing";

/** Human-readable labels for each role */
export const ROLE_LABELS: Record<Role, string> = {
  boss:            "Boss",
  admin:           "Admin",
  team_lead:       "Team Lead",
  sales_rep:       "Sales Representative",
  lead_specialist: "Lead Data Specialist",
};

/** Which departments each role can access */
export const ROLE_DEPARTMENTS: Record<Role, Department[]> = {
  boss:            ["leads", "marketing"],
  admin:           ["leads", "marketing"],
  team_lead:       ["marketing"],
  sales_rep:       ["marketing"],
  lead_specialist: ["leads"],
};

/**
 * Which roles each role is allowed to create/assign.
 * Boss can create any role. Admin cannot create Boss.
 */
export const ROLE_CAN_CREATE: Record<Role, Role[]> = {
  boss:            ["boss", "admin", "team_lead", "sales_rep", "lead_specialist"],
  admin:           ["admin", "team_lead", "sales_rep", "lead_specialist"],
  team_lead:       [],
  sales_rep:       [],
  lead_specialist: [],
};

/** Whether this role can modify system-wide settings */
export const ROLE_CAN_MODIFY_SETTINGS: Record<Role, boolean> = {
  boss:            true,
  admin:           false,
  team_lead:       false,
  sales_rep:       false,
  lead_specialist: false,
};

export function canAccessDepartment(role: Role, dept: Department): boolean {
  return ROLE_DEPARTMENTS[role]?.includes(dept) ?? false;
}

export function canCreateRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_CAN_CREATE[actorRole]?.includes(targetRole) ?? false;
}

export function canManageUsers(role: Role): boolean {
  return role === "boss" || role === "admin";
}

/** All roles sorted by authority level (highest first) */
export const ROLE_ORDER: Role[] = ["boss", "admin", "team_lead", "lead_specialist", "sales_rep"];
