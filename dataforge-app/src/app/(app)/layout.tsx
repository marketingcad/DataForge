import { Suspense } from "react";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { AppClientShell } from "@/components/AppClientShell";
import { TabsProvider } from "@/contexts/TabsContext";
import type { Role } from "@/lib/rbac/roles";
import { getDisabledFeatures } from "@/lib/features-guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = ((session.user as { role?: string }).role as Role | undefined) ?? "lead_specialist";
  const disabledFeatures = await getDisabledFeatures();

  // Read the remembered sidebar state so the first paint has the right width
  // (no expand→collapse flash on load).
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get("df-sidebar-collapsed")?.value === "1";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Suspense fallback={null}>
        <TabsProvider>
          <AppSidebar role={role} disabledFeatures={disabledFeatures} initialCollapsed={sidebarCollapsed} />
          <AppClientShell userName={session.user?.name} userEmail={session.user?.email} userId={session.user?.id ?? ""}>
            {children}
          </AppClientShell>
        </TabsProvider>
      </Suspense>
    </div>
  );
}
