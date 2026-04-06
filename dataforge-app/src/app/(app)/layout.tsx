import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppClientShell } from "@/components/AppClientShell";
import type { Role } from "@/lib/rbac/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = ((session.user as unknown as Record<string, unknown>)?.role as Role | undefined) ?? "lead_specialist";

  // Read sidebar cookie server-side to avoid hydration mismatch
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
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
