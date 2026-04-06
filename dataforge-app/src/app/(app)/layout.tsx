import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppClientShell } from "@/components/AppClientShell";
import type { Role } from "@/lib/rbac/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = ((session.user as unknown as Record<string, unknown>)?.role as Role | undefined) ?? "lead_specialist";

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset>
        <AppClientShell
          userName={session.user?.name}
          userEmail={session.user?.email}
          sidebarTrigger={<SidebarTrigger className="-ml-1" />}
        >
          {children}
        </AppClientShell>
      </SidebarInset>
    </SidebarProvider>
  );
}
