import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { AppClientShell } from "@/components/AppClientShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const user = session.user;
  const role = (user?.role as string | undefined) ?? "lead_specialist";

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-background shrink-0">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 shrink-0">
            <Database className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">DataForge</span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-4">
          <p className="px-5 mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Navigation
          </p>
          <SidebarNav role={role as import("@/lib/rbac/roles").Role} />
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3">
          <p className="text-[10px] text-muted-foreground/40 text-center">DataForge v1.0</p>
        </div>
      </aside>

      {/* ── Main area (client shell provides MigrationContext + header) ── */}
      <AppClientShell userName={user?.name} userEmail={user?.email}>
        {children}
      </AppClientShell>
    </div>
  );
}
