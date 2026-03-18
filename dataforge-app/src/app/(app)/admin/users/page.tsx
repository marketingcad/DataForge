import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUsersAction } from "@/actions/users.actions";
import { ROLE_LABELS, ROLE_CAN_CREATE, type Role } from "@/lib/rbac/roles";
import { UserRoleSelect } from "./UserRoleSelect";
import { Users } from "lucide-react";

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const currentUserRole = ((session.user as unknown as Record<string, unknown>)?.role as Role) ?? "lead_specialist";
  const users = await getUsersAction();
  const assignableRoles = ROLE_CAN_CREATE[currentUserRole];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} account{users.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
          <div key={r} className="rounded-lg border px-3 py-2 text-xs">
            <p className="font-medium">{label}</p>
            <p className="text-muted-foreground mt-0.5">
              {r === "boss" && "Full access · all departments"}
              {r === "admin" && "Full access · manage users"}
              {r === "lead_specialist" && "Leads department only"}
              {r === "sales_rep" && "Marketing department only"}
            </p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => {
              const isCurrentUser = u.id === session.user.id;
              return (
                <tr key={u.id} className={isCurrentUser ? "bg-primary/5" : "hover:bg-muted/30"}>
                  <td className="px-4 py-3 font-medium">
                    {u.name ?? "—"}
                    {isCurrentUser && (
                      <span className="ml-2 text-[10px] text-muted-foreground border rounded-full px-1.5 py-0.5">you</span>
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
      </div>

      <p className="text-xs text-muted-foreground">
        Role changes take effect on the user&apos;s next login.
      </p>
    </div>
  );
}
