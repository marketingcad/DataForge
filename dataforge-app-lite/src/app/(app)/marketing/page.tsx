/**
 * page.tsx — thin role router
 * Reads the session role and delegates to the correct view component.
 * Business logic lives in _views/BossDashboard.tsx and _views/AgentDashboard.tsx
 */

// Allow up to 5 minutes for server actions on this route (GHL sync can be slow)
export const maxDuration = 300;
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/rbac/roles";
import type { Period } from "@/components/marketing/PeriodToggle";
import { METRIC_LABELS, type Metric } from "@/components/marketing/MetricToggle";
import { BossDashboard } from "./_views/BossDashboard";
import { AgentDashboard } from "./_views/AgentDashboard";
import { assertFeatureEnabled } from "@/lib/features-guard";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; metric?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as Role | undefined;
  if (!role || !["boss", "admin", "sales_rep", "team_lead"].includes(role)) redirect("/unauthorized");
  await assertFeatureEnabled("overview");

  const { period: rawPeriod, metric: rawMetric, from, to } = await searchParams;

  const period: Period = (["today", "week", "month", "all_time", "custom"] as const).includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : "month";

  const validMetrics = Object.keys(METRIC_LABELS) as Metric[];
  const metric: Metric = validMetrics.includes(rawMetric as Metric)
    ? (rawMetric as Metric)
    : "calls";

  if (role === "boss" || role === "admin" || role === "team_lead")
    return <BossDashboard period={period} metric={metric} from={from} to={to} />;
  return <AgentDashboard userId={session.user.id!} period={period} />;
}
