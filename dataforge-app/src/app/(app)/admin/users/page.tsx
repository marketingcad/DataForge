import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUsersAction } from "@/actions/users.actions";
import { type Role } from "@/lib/rbac/roles";
import { CreateUserDialog } from "./CreateUserDialog";
import { ImportGhlDialog } from "./ImportGhlDialog";
import { UsersClient } from "./UsersClient";

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const currentUserRole = ((session.user as unknown as Record<string, unknown>)?.role as Role) ?? "lead_specialist";
  if (!["boss", "admin"].includes(currentUserRole)) redirect("/unauthorized");

  const users = await getUsersAction();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalUsers    = users.length;
  const newThisMonth  = users.filter((u) => new Date(u.createdAt) >= startOfMonth).length;
  const salesReps     = users.filter((u) => u.role === "sales_rep").length;
  const admins        = users.filter((u) => u.role === "boss" || u.role === "admin").length;

  const stats = [
    { label: "Total Users",     value: totalUsers,   color: "bg-blue-50 dark:bg-blue-950/30",   icon: "👥", num: "text-blue-600 dark:text-blue-400" },
    { label: "New This Month",  value: newThisMonth, color: "bg-emerald-50 dark:bg-emerald-950/30", icon: "🆕", num: "text-emerald-600 dark:text-emerald-400" },
    { label: "Sales Reps",      value: salesReps,    color: "bg-rose-50 dark:bg-rose-950/30",    icon: "📣", num: "text-rose-600 dark:text-rose-400" },
    { label: "Admins",          value: admins,       color: "bg-violet-50 dark:bg-violet-950/30", icon: "🛡️", num: "text-violet-600 dark:text-violet-400" },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalUsers} account{totalUsers !== 1 ? "s" : ""} across all departments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportGhlDialog />
          <CreateUserDialog actorRole={currentUserRole} />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl ${s.color} px-5 py-4 flex items-center gap-4`}>
            <span className="text-3xl leading-none">{s.icon}</span>
            <div>
              <p className={`text-3xl font-black tabular-nums leading-none ${s.num}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <UsersClient
        users={users}
        actorRole={currentUserRole}
        currentUserId={session.user.id!}
      />
    </div>
  );
}
