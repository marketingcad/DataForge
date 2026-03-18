import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUsersAction } from "@/actions/users.actions";
import { type Role } from "@/lib/rbac/roles";
import { CreateUserDialog } from "./CreateUserDialog";
import { UsersClient } from "./UsersClient";

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const currentUserRole = ((session.user as unknown as Record<string, unknown>)?.role as Role) ?? "lead_specialist";
  if (!["boss", "admin"].includes(currentUserRole)) redirect("/unauthorized");

  const users = await getUsersAction();

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} account{users.length !== 1 ? "s" : ""} across all departments
          </p>
        </div>
        <CreateUserDialog actorRole={currentUserRole} />
      </div>

      <UsersClient
        users={users}
        actorRole={currentUserRole}
        currentUserId={session.user.id!}
      />

      <p className="text-xs text-muted-foreground pb-4">
        Role changes take effect on the user&apos;s next login.
      </p>
    </div>
  );
}
