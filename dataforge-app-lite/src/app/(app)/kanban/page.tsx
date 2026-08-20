import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getKanbanTasks } from "@/lib/kanban/service";
import { getUsers } from "@/lib/users/service";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid } from "lucide-react";
import type { Role } from "@/lib/rbac/roles";

export default async function KanbanPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as Role;
  const isAdmin = role === "boss" || role === "admin";

  const [tasks, users] = await withDbRetry(() =>
    Promise.all([getKanbanTasks(), getUsers()])
  );

  const allUsers = users.map((u) => ({ id: u.id, name: u.name ?? null, role: u.role as string }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Kanban Board</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin
              ? "Assign and manage tasks for your team."
              : "Your assigned tasks — click a card to view details or submit for review."}
          </p>
        </div>
      </div>

      <Separator />

      <KanbanBoard
        initialTasks={tasks as Parameters<typeof KanbanBoard>[0]["initialTasks"]}
        currentUserId={session.user.id!}
        isAdmin={isAdmin}
        allUsers={allUsers}
      />
    </div>
  );
}
