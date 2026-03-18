import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUsersAction } from "@/actions/users.actions";
import { ROLE_CAN_CREATE, type Role } from "@/lib/rbac/roles";
import { UserRoleSelect } from "./UserRoleSelect";
import { CreateUserDialog } from "./CreateUserDialog";
import { Users, Megaphone, ShieldCheck } from "lucide-react";

type DeptSection = {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  roles: Role[];
};

const DEPT_SECTIONS: DeptSection[] = [
  {
    title: "Leads Department",
    icon: Users,
    iconClass: "text-blue-600 bg-blue-500/10",
    roles: ["lead_specialist"],
  },
  {
    title: "Marketing Department",
    icon: Megaphone,
    iconClass: "text-pink-600 bg-pink-500/10",
    roles: ["sales_rep"],
  },
  {
    title: "Administration",
    icon: ShieldCheck,
    iconClass: "text-violet-600 bg-violet-500/10",
    roles: ["boss", "admin"],
  },
];

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const currentUserRole = ((session.user as unknown as Record<string, unknown>)?.role as Role) ?? "lead_specialist";
  if (!["boss", "admin"].includes(currentUserRole)) redirect("/unauthorized");
  const users = await getUsersAction();
  const assignableRoles = ROLE_CAN_CREATE[currentUserRole];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Manage Users</h1>
            <p className="text-sm text-muted-foreground">
              {users.length} account{users.length !== 1 ? "s" : ""} across all departments
            </p>
          </div>
        </div>
        <CreateUserDialog actorRole={currentUserRole} />
      </div>

      {/* Department sections */}
      {DEPT_SECTIONS.map((section) => {
        const sectionUsers = users.filter((u) => section.roles.includes(u.role as Role));
        const Icon = section.icon;

        return (
          <div key={section.title} className="rounded-xl border overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/30 border-b">
              <div className={`flex h-7 w-7 items-center justify-center rounded-md ${section.iconClass}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm font-semibold">{section.title}</p>
              <span className="ml-auto text-xs text-muted-foreground">
                {sectionUsers.length} member{sectionUsers.length !== 1 ? "s" : ""}
              </span>
            </div>

            {sectionUsers.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No users in this department yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/10">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sectionUsers.map((u) => {
                    const isCurrentUser = u.id === session.user.id;
                    return (
                      <tr
                        key={u.id}
                        className={isCurrentUser ? "bg-primary/5" : "hover:bg-muted/30"}
                      >
                        <td className="px-4 py-3 font-medium">
                          {u.name ?? "—"}
                          {isCurrentUser && (
                            <span className="ml-2 text-[10px] text-muted-foreground border rounded-full px-1.5 py-0.5">
                              you
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <UserRoleSelect
                            userId={u.id}
                            currentRole={u.role as Role}
                            assignableRoles={assignableRoles}
                            isCurrentUser={isCurrentUser}
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Role changes take effect on the user&apos;s next login.
      </p>
    </div>
  );
}
