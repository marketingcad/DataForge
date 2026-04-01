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
} from "@/lib/marketing/team.service";
import { Separator } from "@/components/ui/separator";
import { TaskCard } from "../TaskCard";
import { SeedMarketingButton } from "../SeedMarketingButton";
import { Phone, Target, Calendar, Users, TrendingUp } from "lucide-react";
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
  const [summary, leaderboard, volumeData, tasks] = await withDbRetry(() =>
    Promise.all([
      getTeamSummary(),
      getLeaderboard(period),
      getTeamCallsPerDay(CHART_DAYS[period]),
      getActiveTasks(),
    ])
  );

  const periodLabel = PERIOD_LABELS[period];

  const callsValue =
    period === "yesterday" ? summary.callsToday :
    period === "week"      ? summary.callsThisWeek :
    summary.callsThisMonth;

  const chartTitle =
    period === "month" ? "Team Call Volume — Last 30 Days" :
    "Team Call Volume — Last 7 Days";

  // Compute connect rate from leaderboard if available
  const totalCalls    = leaderboard.reduce((s, a) => s + a.callCount, 0);
  const avgCallsPerAgent = leaderboard.length > 0
    ? Math.round(totalCalls / leaderboard.length)
    : 0;

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

      {/* Quick KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Agents</p>
            <p className="text-2xl font-black tabular-nums leading-tight">{summary.agentCount}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Phone className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Calls {periodLabel}</p>
            <p className="text-2xl font-black tabular-nums leading-tight text-blue-700 dark:text-blue-400">{callsValue}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/20 dark:to-transparent px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Calendar className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Calls Today</p>
            <p className="text-2xl font-black tabular-nums leading-tight text-emerald-700 dark:text-emerald-400">{summary.callsToday}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20 dark:to-transparent px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Avg / Agent</p>
            <p className="text-2xl font-black tabular-nums leading-tight text-amber-700 dark:text-amber-400">{avgCallsPerAgent}</p>
          </div>
        </div>
      </div>

      {/* Leaderboard + Top Performer */}
      <LeaderboardSection leaderboard={leaderboard} period={period} />

      {/* Chart + Active challenges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallVolumeChart
            data={volumeData.map((d) => ({ label: d.date, calls: d.count }))}
            title={chartTitle}
          />
        </div>

        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gradient-to-r from-emerald-500/10 via-card to-card">
            <Target className="h-4 w-4 text-emerald-500" />
            <p className="font-bold text-sm">Active Challenges</p>
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
