import { getDashboardStats } from "@/lib/dashboard/service";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { LeadsByIndustryChart } from "@/components/dashboard/LeadsByIndustryChart";
import { QualityDistributionChart } from "@/components/dashboard/QualityDistributionChart";
import { RecentLeadsTable } from "@/components/dashboard/RecentLeadsTable";
import { Users, CheckCircle, Star, ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of your lead database and scraping activity.
        </p>
      </div>

      <Separator />

      {/* KPI Cards */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadsByIndustryChart data={stats.leadsByIndustry} />
        <QualityDistributionChart data={stats.qualityDistribution} />
      </div>

      {/* Recent Leads */}
      <RecentLeadsTable leads={stats.recentLeads} />
    </div>
  );
}
