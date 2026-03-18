import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getKanbanTasks } from "@/lib/kanban/service";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid } from "lucide-react";

export default async function KanbanPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const tasks = await withDbRetry(() => getKanbanTasks());

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Kanban Board</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} across all columns
        </p>
      </div>

      <Separator />

      <KanbanBoard initialTasks={tasks as Parameters<typeof KanbanBoard>[0]["initialTasks"]} />
    </div>
  );
}
