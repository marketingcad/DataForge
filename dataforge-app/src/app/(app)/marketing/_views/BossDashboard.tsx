/**
 * BossDashboard.tsx
 * Marketing view for Boss and Admin roles.
 * Shows team KPIs, leaderboard, active challenges, and yesterday's top performer.
 */
import { withDbRetry } from "@/lib/prisma";
import {
  getTeamSummary,
  getLeaderboard,
  getTeamCallsPerDay,
  getActiveTasks,
  getYesterdaysTopPerformer,
} from "@/lib/marketing/team.service";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Separator } from "@/components/ui/separator";
import { TaskCard } from "../TaskCard";
import { SeedMarketingButton } from "../SeedMarketingButton";
import { Trophy, Phone, TrendingUp, Users, Star, Target, Calendar } from "lucide-react";
import { CallVolumeChart } from "@/components/marketing/CallVolumeChart";
import { LeaderboardSection } from "@/components/marketing/LeaderboardSection";
import { PeriodToggle } from "@/components/marketing/PeriodToggle";
import type { Period } from "@/components/marketing/PeriodToggle";

const PERIOD_LABELS: Record<Period, string> = {
  yesterday: "Yesterday",
  week:      "This Week",
  month:     "This Month",
};

const CHART_DAYS: Record<Period, number> = {
  yesterday: 7,
  week:      7,
  month:     30,
};

export async function BossDashboard({ period = "week" }: { period?: Period }) {
  const [summary, leaderboard, volumeData, tasks, topYesterday] = await withDbRetry(() =>
    Promise.all([
      getTeamSummary(),
      getLeaderboard(period),
      getTeamCallsPerDay(CHART_DAYS[period]),
      getActiveTasks(),
      getYesterdaysTopPerformer(),
    ])
  );

  const periodLabel = PERIOD_LABELS[period];

  // Which KPI card to highlight based on period
  const callsValue =
    period === "yesterday" ? summary.callsToday :
    period === "week"      ? summary.callsThisWeek :
    summary.callsThisMonth;

  const chartTitle =
    period === "month" ? "Team Call Volume — Last 30 Days" :
    "Team Call Volume — Last 7 Days";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Marketing Department</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Team performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodToggle period={period} />
          <SeedMarketingButton />
        </div>
      </div>

      <Separator />

      {/* Sales Leaderboard + Top Performer Panel */}
      <LeaderboardSection leaderboard={leaderboard} period={period} />

      {/* Yesterday's top performer spotlight */}

      {/* Team KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Agents"
          value={summary.agentCount}
          icon={<Users className="h-4 w-4 text-violet-600" />}
          description="Sales reps"
        />
        <StatsCard
          title={`Calls ${periodLabel}`}
          value={callsValue}
          icon={<Phone className="h-4 w-4 text-blue-600" />}
          description="Team total"
        />
        <StatsCard
          title="Calls Today"
          value={summary.callsToday}
          icon={<Calendar className="h-4 w-4 text-emerald-600" />}
          description={period === "yesterday" ? "Current period" : "For reference"}
        />
        <StatsCard
          title="Calls This Month"
          value={summary.callsThisMonth}
          icon={<Star className="h-4 w-4 text-amber-500" />}
          description="Calendar month"
        />
      </div>

      {/* Chart + Active challenges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallVolumeChart
            data={volumeData.map((d) => ({ label: d.date, calls: d.count }))}
            title={chartTitle}
          />
        </div>

        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/20">
            <Target className="h-4 w-4 text-emerald-500" />
            <p className="font-semibold text-sm">Active Challenges</p>
          </div>
          <div className="flex-1 divide-y">
            {tasks.length === 0
              ? <div className="py-10 text-center text-sm text-muted-foreground">No active tasks</div>
              : tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    myProgress={null}
                    teamCompleted={task.progress.filter((p) => p.completed).length}
                    isBoss
                  />
                ))
            }
          </div>
        </div>
      </div>

    </div>
  );
}
