/**
 * page.tsx — thin role router
 * Reads the session role and delegates to the correct view component.
 * Business logic lives in _views/BossDashboard.tsx and _views/AgentDashboard.tsx
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/rbac/roles";
import { BossDashboard } from "./_views/BossDashboard";
import { AgentDashboard } from "./_views/AgentDashboard";

export default async function MarketingPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as Role | undefined;
  if (!role || !["boss", "admin", "sales_rep"].includes(role)) redirect("/unauthorized");

  if (role === "boss" || role === "admin") return <BossDashboard />;
  return <AgentDashboard userId={session.user.id!} />;
}
