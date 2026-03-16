import { getDashboardStats } from "@/lib/services/dashboard.service";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { LeadsByIndustryChart } from "@/components/dashboard/LeadsByIndustryChart";
import { QualityDistributionChart } from "@/components/dashboard/QualityDistributionChart";
import { RecentLeadsTable } from "@/components/dashboard/RecentLeadsTable";
import { Users, CheckCircle, Star, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your lead database.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Leads"
          value={stats.totalLeads}
          icon={<Users className="h-4 w-4 text-blue-600" />}
        />
        <StatsCard
          title="Active Leads"
          value={stats.activeLeads}
          icon={<CheckCircle className="h-4 w-4 text-green-600" />}
        />
        <StatsCard
          title="Avg Quality Score"
          value={`${stats.avgQualityScore}%`}
          icon={<Star className="h-4 w-4 text-yellow-500" />}
        />
        <StatsCard
          title="Duplicates Prevented"
          value={stats.duplicatesPrevented}
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsByIndustryChart data={stats.leadsByIndustry} />
        <QualityDistributionChart data={stats.qualityDistribution} />
      </div>

      {/* Recent Leads */}
      <RecentLeadsTable leads={stats.recentLeads} />
    </div>
  );
}
