import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard/service";
import { getUsers } from "@/lib/users/service";
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
  Megaphone,
  ScanSearch,
  UserCog,
  Trophy,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import Link from "next/link";
import { getLeaderboard } from "@/lib/marketing/team.service";
import { LeaderboardSection } from "@/components/marketing/LeaderboardSection";
import { PeriodToggle } from "@/components/marketing/PeriodToggle";
import type { Period } from "@/components/marketing/PeriodToggle";

/* ─── Boss / Admin overview ─── */
async function BossDashboard() {
  const [stats, users] = await withDbRetry(() =>
    Promise.all([getDashboardStats(), getUsers()])
  );

  const roleGroups: Record<Role, number> = {
    boss:              0,
    admin:             0,
    lead_data_analyst: 0,
    lead_specialist:   0,
    sales_rep:         0,
  };
  for (const u of users) roleGroups[u.role as Role]++;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Organisation-wide snapshot across all departments.
        </p>
      </div>

      <Separator />

      {/* Org KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={users.length.toString()}
          icon={<UserCog className="h-4 w-4 text-violet-600" />}
          description="Across all roles"
        />
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
      </div>

      {/* Department cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leads dept */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Leads Department</p>
                <p className="text-xs text-muted-foreground">
                  {roleGroups.lead_specialist} specialist{roleGroups.lead_specialist !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Link
              href="/leads"
              className="text-xs text-primary hover:underline font-medium"
            >
              View Leads →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Total leads</p>
              <p className="text-base font-semibold">{stats.totalLeads.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">This week</p>
              <p className="text-base font-semibold">{stats.leadsThisWeek.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Scraping jobs</p>
              <p className="text-base font-semibold">{stats.totalJobsRun}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Duplicates caught</p>
              <p className="text-base font-semibold">{stats.duplicatesPrevented}</p>
            </div>
          </div>
          <Link
            href="/scraping"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            Go to Scraping
          </Link>
        </div>

        {/* Marketing dept */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10">
                <Megaphone className="h-4 w-4 text-pink-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Marketing Department</p>
                <p className="text-xs text-muted-foreground">
                  {roleGroups.sales_rep} sales rep{roleGroups.sales_rep !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Link
              href="/marketing"
              className="text-xs text-primary hover:underline font-medium"
            >
              View Marketing →
            </Link>
          </div>
          <div className="flex items-center justify-center h-24 rounded-lg bg-muted/40">
            <p className="text-xs text-muted-foreground">
              Campaign features coming soon
            </p>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <p className="text-sm font-semibold">Team</p>
          <Link
            href="/admin/users"
            className="text-xs text-primary hover:underline font-medium"
          >
            Manage Users →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x">
          {(["boss", "admin", "lead_specialist", "sales_rep"] as Role[]).map((r) => (
            <div key={r} className="px-4 py-3 text-center">
              <p className="text-lg font-semibold">{roleGroups[r]}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ROLE_LABELS[r]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadsByIndustryChart data={stats.leadsByIndustry} />
        <QualityDistributionChart data={stats.qualityDistribution} />
      </div>

      <RecentLeadsTable leads={stats.recentLeads} />
    </div>
  );
}

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
