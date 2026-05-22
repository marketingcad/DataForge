import { Users, Phone, BarChart2, CalendarCheck, DollarSign } from "lucide-react";
import Link from "next/link";
import { withDbRetry } from "@/lib/prisma";
import {
  getTeamSummary,
  getLeaderboard,
  getTeamCallsPerDay,
  getTeamCallsAllTime,
  getActiveTasks,
  getTeamMonthlyBreakdown,
  getRepDailyCallsForChart,
  getRepDailyApptsForChart,
  getAgentAvgDurations,
} from "@/lib/marketing/team.service";
import { getSalesReps } from "@/actions/appointments.actions";
import { TaskCard } from "../TaskCard";
import { AddAppointmentModal } from "@/components/marketing/AddAppointmentModal";
import { AppointmentsModalButton } from "@/components/marketing/AppointmentsModal";
import { CallVolumeChart } from "@/components/marketing/CallVolumeChart";
import { LeaderboardClientWrapper } from "@/components/marketing/LeaderboardClientWrapper";
import { AgentRadarChart } from "@/components/marketing/AgentRadarChart";
import { RepPerformanceChart } from "@/components/marketing/RepPerformanceChart";
import { PeriodToggle, type Period } from "@/components/marketing/PeriodToggle";
import { MetricToggle, type Metric, METRIC_LABELS } from "@/components/marketing/MetricToggle";
import { BalloonPopFeed } from "@/components/marketing/BalloonPopFeed";

const PERIOD_LABELS: Record<Period, string> = {
  yesterday: "Yesterday",
  week:      "This Week",
  month:     "This Month",
  all_time:  "All Time",
};

const CHART_DAYS: Record<Exclude<Period, "all_time">, number> = {
  yesterday: 2,
  week:      7,
  month:     30,
};

export async function BossDashboard({ period = "month", metric = "calls" }: { period?: Period; metric?: Metric }) {

  const [summary, leaderboard, volumeData, tasks, monthlyBreakdown, salesReps, agentDurations] = await withDbRetry(() =>
    Promise.all([
      getTeamSummary(),
      getLeaderboard(period, metric),
      period === "all_time" ? getTeamCallsAllTime() : getTeamCallsPerDay(CHART_DAYS[period]),
      getActiveTasks(),
      getTeamMonthlyBreakdown(),
      getSalesReps(),
      getAgentAvgDurations(),
    ])
  );

  const top5 = leaderboard.slice(0, 5);
  const top5Ids = top5.map((r) => r.id);
  const [repCallChartData, repApptChartData] = await Promise.all([
    getRepDailyCallsForChart(top5Ids, 30),
    getRepDailyApptsForChart(top5Ids, 30),
  ]);
  const repCallMeta = top5.map((r) => ({ id: r.id, name: r.name, callCount: r.callCount }));
  const repApptTotals: Record<string, number> = {};
  for (const row of repApptChartData) {
    for (const id of top5Ids) {
      repApptTotals[id] = (repApptTotals[id] ?? 0) + ((row[id] as number) || 0);
    }
  }
  const repApptMeta = top5.map((r) => ({
    id: r.id, name: r.name, callCount: repApptTotals[r.id] ?? 0,
    metricLabel: `${repApptTotals[r.id] ?? 0} appts`,
  }));

  const periodLabel = PERIOD_LABELS[period];

  const callsValue =
    period === "week"     ? summary.callsThisWeek :
    period === "all_time" ? summary.callsAllTime :
    summary.callsThisMonth;

  const avgCallsPerAgent = leaderboard.length > 0
    ? Math.round(leaderboard.reduce((s, a) => s + a.callCount, 0) / leaderboard.length)
    : 0;

  const totalCommissions = leaderboard.reduce((s, a) => s + (a.commissionsEarned ?? 0), 0);

  const chartTitle =
    period === "month"    ? "Team Call Volume — Last 30 Days" :
    period === "all_time" ? "Team Call Volume — All Time (Monthly)" :
    "Team Call Volume — Last 7 Days";

  const kpis = [
    {
      label:  "Agents",
      value:  summary.agentCount,
      sub:    "Sales reps",
      accent: "bg-violet-500",
      num:    "text-violet-600 dark:text-violet-400",
      icon:   <Users className="h-5 w-5 text-violet-500" />,
    },
    {
      label:  `Calls ${periodLabel}`,
      value:  callsValue,
      sub:    "Team total",
      accent: "bg-blue-500",
      num:    "text-blue-600 dark:text-blue-400",
      icon:   <Phone className="h-5 w-5 text-blue-500" />,
    },
    {
      label:  "Avg Calls / Agent",
      value:  avgCallsPerAgent,
      sub:    `${periodLabel} average`,
      accent: "bg-amber-500",
      num:    "text-amber-600 dark:text-amber-400",
      icon:   <BarChart2 className="h-5 w-5 text-amber-500" />,
    },
    {
      label:  "Appts Set",
      value:  summary.teamApptsSet,
      sub:    "GHL opportunities",
      accent: "bg-sky-500",
      num:    "text-sky-600 dark:text-sky-400",
      icon:   <CalendarCheck className="h-5 w-5 text-sky-500" />,
    },
    {
      label:  "Commissions",
      value:  `$${totalCommissions.toLocaleString()}`,
      sub:    `${periodLabel} total`,
      accent: "bg-rose-500",
      num:    "text-rose-600 dark:text-rose-400",
      icon:   <DollarSign className="h-5 w-5 text-rose-500" />,
    },
  ];

  return (
    <div className="space-y-7">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Team performance overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodToggle period={period} />
          <div className="h-5 w-px bg-border hidden sm:block" />
          <MetricToggle metric={metric} />
          <div className="h-5 w-px bg-border hidden sm:block" />
          <AppointmentsModalButton canDelete={true} />
          <AddAppointmentModal reps={salesReps} />
        </div>
      </div>

      {/* ── KPI tiles — 3 cols on md, 6 cols on xl ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-card shadow-sm border border-border/40 p-4 space-y-3 hover:border-border/80 transition-colors">
            <div className="flex items-center justify-between">
              {k.icon}
              <div className={`h-1.5 w-8 rounded-full ${k.accent} opacity-70`} />
            </div>
            <p className={`text-3xl font-black tabular-nums leading-none ${k.num}`}>
              {typeof k.value === "number" ? k.value.toLocaleString() : k.value}
            </p>
            <div>
              <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider leading-none">{k.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Champions leaderboard ── */}
      <LeaderboardClientWrapper
        initialLeaderboard={leaderboard}
        initialPeriod={period}
        initialMetric={metric}
      />

      {/* ── Chart + Active challenges + Balloon feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-2">
          <CallVolumeChart
            data={volumeData}
            title={chartTitle}
          />
        </div>

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

        <BalloonPopFeed />
      </div>

      {/* ── Rep performance line charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RepPerformanceChart
          data={repCallChartData}
          reps={repCallMeta}
          title="Calls Performance"
          subtitle="Daily calls — top 5 reps · last 30 days"
        />
        <RepPerformanceChart
          data={repApptChartData}
          reps={repApptMeta}
          title="Appointments Set"
          subtitle="Daily appointments booked — top 5 reps · last 30 days"
        />
      </div>

      {/* ── Avg Call Duration per Agent ── */}
      {agentDurations.length > 0 && (
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <span className="text-sm">⏱️</span>
            <div>
              <p className="font-bold text-sm">Avg Call Duration per Agent</p>
              <p className="text-xs text-muted-foreground mt-0.5">Completed calls only</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                  {[
                    { label: "This Week",  color: "text-orange-500"  },
                    { label: "This Month", color: "text-violet-500"  },
                    { label: "All Time",   color: "text-emerald-500" },
                  ].map((h) => (
                    <th key={h.label} className={`text-right px-5 py-3 font-semibold uppercase tracking-wider ${h.color}`}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {agentDurations.map((a) => {
                  const fmt = (secs: number) => {
                    if (secs <= 0) return <span className="text-muted-foreground">—</span>;
                    const m = Math.floor(secs / 60), s = secs % 60;
                    return <span className="font-bold tabular-nums">{m === 0 ? `${s}s` : s === 0 ? `${m}m` : `${m}m ${s}s`}</span>;
                  };
                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 max-w-[160px]">
                        <Link href={`/profile/${a.id}`} className="font-semibold hover:text-violet-500 transition-colors truncate block">{a.name}</Link>
                      </td>
                      <td className="px-5 py-3 text-right">{fmt(a.week)}</td>
                      <td className="px-5 py-3 text-right">{fmt(a.month)}</td>
                      <td className="px-5 py-3 text-right">{fmt(a.allTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6-month activity radar + monthly table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <p className="font-bold text-sm">Team 6-Month Breakdown</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total calls vs appointments booked per month</p>
          </div>
          <div className="p-4">
            <AgentRadarChart data={monthlyBreakdown} />
          </div>
        </div>

        <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <p className="font-bold text-sm">Monthly Activity Summary</p>
            <p className="text-xs text-muted-foreground mt-0.5">Calls and appointments booked per month at a glance</p>
          </div>
          <div className="divide-y divide-border/30">
            {monthlyBreakdown.map((row) => (
              <div key={row.month} className="flex items-center gap-4 px-5 py-3">
                <p className="text-xs font-bold w-8 shrink-0">{row.month}</p>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-9 shrink-0">Calls</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-all"
                        style={{ width: `${Math.min(100, (row.calls / Math.max(...monthlyBreakdown.map((r) => r.calls), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-8 text-right">{row.calls}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-9 shrink-0">Appts</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, (row.leads / Math.max(...monthlyBreakdown.map((r) => r.leads), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-8 text-right">{row.leads}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
