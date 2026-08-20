import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllTasks } from "@/lib/marketing/tasks.service";
import { assertFeatureEnabled } from "@/lib/features-guard";
import { TasksManager } from "./TasksManager";

export default async function ManageTasksPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "boss" && role !== "admin") redirect("/unauthorized");
  await assertFeatureEnabled("challenges");

  const tasks = await getAllTasks();
  return <TasksManager tasks={tasks} />;
}
