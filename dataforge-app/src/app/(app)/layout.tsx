import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { AppClientShell } from "@/components/AppClientShell";
import type { Role } from "@/lib/rbac/roles";
import { getDisabledFeatures } from "@/lib/features-guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = ((session.user as { role?: string }).role as Role | undefined) ?? "lead_specialist";
  const disabledFeatures = await getDisabledFeatures();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Suspense fallback={null}>
        <AppSidebar role={role} disabledFeatures={disabledFeatures} />
      </Suspense>
      <AppClientShell userName={session.user?.name} userEmail={session.user?.email} userId={session.user?.id ?? ""}>
        {children}
      </AppClientShell>
    </div>
  );
}
