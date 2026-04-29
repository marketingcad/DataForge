/**
 * page.tsx — thin role router
 * Reads the session role and delegates to the correct view component.
 * Business logic lives in _views/BossDashboard.tsx and _views/AgentDashboard.tsx
 */

// Allow up to 5 minutes for server actions on this route (GHL sync can be slow)
export const maxDuration = 300;
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/rbac/roles";
import type { Period } from "@/components/marketing/PeriodToggle";
import type { Metric } from "@/components/marketing/MetricToggle";
import { BossDashboard } from "./_views/BossDashboard";
import { AgentDashboard } from "./_views/AgentDashboard";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; metric?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as Role | undefined;
  if (!role || !["boss", "admin", "sales_rep", "team_lead"].includes(role)) redirect("/unauthorized");

  const { period: rawPeriod, metric: rawMetric } = await searchParams;

  const period: Period = (["yesterday", "week", "month", "all_time"] as const).includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : "week";

  const metric: Metric = (["calls", "leads", "appts_set", "deals_won", "commissions", "avg_call_time", "badges"] as const).includes(rawMetric as Metric)
    ? (rawMetric as Metric)
    : "appts_set";

  if (role === "boss" || role === "admin" || role === "team_lead") return <BossDashboard period={period} metric={metric} />;
  return <AgentDashboard userId={session.user.id!} period={period} />;
}
