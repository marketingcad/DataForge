import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { AppClientShell } from "@/components/AppClientShell";
import type { Role } from "@/lib/rbac/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = ((session.user as unknown as Record<string, unknown>)?.role as Role | undefined) ?? "lead_specialist";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar role={role} />
      <AppClientShell userName={session.user?.name} userEmail={session.user?.email}>
        {children}
      </AppClientShell>
    </div>
  );
}
