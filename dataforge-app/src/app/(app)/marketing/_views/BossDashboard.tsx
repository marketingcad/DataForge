/**
 * BossDashboard.tsx
 * Marketing view for Boss and Admin roles.
 */
import { withDbRetry } from "@/lib/prisma";
import {
  getTeamSummary,
  getLeaderboard,
  getTeamCallsPerDay,
  getActiveTasks,
} from "@/lib/marketing/team.service";
import { TaskCard } from "../TaskCard";
import { SeedMarketingButton } from "../SeedMarketingButton";
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

  const avgCallsPerAgent = leaderboard.length > 0
    ? Math.round(leaderboard.reduce((s, a) => s + a.callCount, 0) / leaderboard.length)
    : 0;

  const chartTitle =
    period === "month" ? "Team Call Volume — Last 30 Days" :
    "Team Call Volume — Last 7 Days";

  const kpis = [
    { label: "Agents",            value: summary.agentCount,    sub: "Sales reps",      accent: "bg-violet-500",  num: "text-violet-600 dark:text-violet-400" },
    { label: `Calls ${periodLabel}`, value: callsValue,         sub: "Team total",      accent: "bg-blue-500",    num: "text-blue-600 dark:text-blue-400" },
    { label: "Calls Today",       value: summary.callsToday,    sub: "Current day",     accent: "bg-emerald-500", num: "text-emerald-600 dark:text-emerald-400" },
    { label: "Avg / Agent",       value: avgCallsPerAgent,      sub: periodLabel,       accent: "bg-amber-500",   num: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Team performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodToggle period={period} />
          <SeedMarketingButton />
        </div>
      </div>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-card shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-6 rounded-full ${k.accent}`} />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {k.label}
              </p>
            </div>
            <p className={`text-4xl font-black tabular-nums leading-none ${k.num}`}>
              {k.value}
            </p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Champions leaderboard ── */}
      <LeaderboardSection leaderboard={leaderboard} period={period} />

      {/* ── Chart + Active challenges ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <CallVolumeChart
            data={volumeData.map((d) => ({ label: d.date, calls: d.count }))}
            title={chartTitle}
          />
        </div>

        {/* Active challenges */}
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40">
            <p className="font-bold text-sm">Active Challenges</p>
            <p className="text-xs text-muted-foreground mt-0.5">Current team tasks</p>
          </div>
          <div className="flex-1 divide-y divide-border/40">
            {tasks.length === 0
              ? (
                <div className="flex-1 py-12 text-center">
                  <p className="text-2xl mb-2">🎯</p>
                  <p className="text-sm text-muted-foreground">No active tasks</p>
                </div>
              )
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
