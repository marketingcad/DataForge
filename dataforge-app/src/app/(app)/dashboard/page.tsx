import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard/service";
import { withDbRetry } from "@/lib/prisma";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { LeadsByIndustryChart } from "@/components/dashboard/LeadsByIndustryChart";
import { QualityDistributionChart } from "@/components/dashboard/QualityDistributionChart";
import { RecentLeadsTable } from "@/components/dashboard/RecentLeadsTable";
import {
  Users,
  CheckCircle,
  Star,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { type Role } from "@/lib/rbac/roles";
import Link from "next/link";
import { getLeaderboard } from "@/lib/marketing/team.service";
import { LeaderboardSection } from "@/components/marketing/LeaderboardSection";
import { PeriodToggle } from "@/components/marketing/PeriodToggle";
import type { Period } from "@/components/marketing/PeriodToggle";
import { BossDashboard } from "./BossDashboard";

/* ─── Lead specialist view (unchanged) ─── */
async function SpecialistDashboard() {
  const stats = await withDbRetry(() => getDashboardStats());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of your lead database and scraping activity.
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Leads"
          value={stats.totalLeads.toLocaleString()}
          icon={<Users className="h-4 w-4 text-blue-600" />}
          description="All time"
        />
        <StatsCard
          title="Active Leads"
          value={stats.activeLeads.toLocaleString()}
          icon={<CheckCircle className="h-4 w-4 text-emerald-600" />}
          description="Ready to contact"
        />
        <StatsCard
          title="Avg Quality Score"
          value={`${stats.avgQualityScore}%`}
          icon={<Star className="h-4 w-4 text-amber-500" />}
          description="Data completeness"
        />
        <StatsCard
          title="Duplicates Caught"
          value={stats.duplicatesPrevented.toLocaleString()}
          icon={<ShieldCheck className="h-4 w-4 text-violet-600" />}
          description="Prevented from saving"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadsByIndustryChart data={stats.leadsByIndustry} />
        <QualityDistributionChart data={stats.qualityDistribution} />
      </div>

      <RecentLeadsTable leads={stats.recentLeads} />
    </div>
  );
}

/* ─── Sales rep dashboard — leaderboard front and center ─── */
async function SalesRepDashboard({ userId, period }: { userId: string; period: Period }) {
  const leaderboard = await withDbRetry(() => getLeaderboard(period));
  const myRank = leaderboard.findIndex((a) => a.id === userId) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {myRank > 0
              ? `You're ranked #${myRank} on the team ${period === "yesterday" ? "yesterday" : period === "month" ? "this month" : "this week"}.`
              : "Your marketing and outreach overview."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodToggle period={period} />
          <Link
            href="/marketing"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-500" /> Marketing
          </Link>
        </div>
      </div>

      <Separator />

      {/* Leaderboard — full width, in their face */}
      <LeaderboardSection leaderboard={leaderboard} period={period} />
    </div>
  );
}

/* ─── Entry point — route to correct view by role ─── */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as Role | undefined;

  if (role === "boss" || role === "admin") return <BossDashboard />;

  if (role === "sales_rep") {
    const { period: raw } = await searchParams;
    const period: Period = (["yesterday", "week", "month"] as const).includes(raw as Period)
      ? (raw as Period)
      : "week";
    return <SalesRepDashboard userId={session!.user.id!} period={period} />;
  }

  return <SpecialistDashboard />;
}
