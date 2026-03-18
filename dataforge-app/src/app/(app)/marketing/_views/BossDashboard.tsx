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
import {
  Trophy, Phone, TrendingUp, Users, Star, Target,
  Medal, Crown,
} from "lucide-react";
import Link from "next/link";
import { CallVolumeChart } from "@/components/marketing/CallVolumeChart";

export async function BossDashboard() {
  const [summary, leaderboard, volumeData, tasks, topYesterday] = await withDbRetry(() =>
    Promise.all([
      getTeamSummary(),
      getLeaderboard("week"),
      getTeamCallsPerDay(30),
      getActiveTasks(),
      getYesterdaysTopPerformer(),
    ])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Marketing Department</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Team performance overview</p>
        </div>
        <SeedMarketingButton />
      </div>

      <Separator />

      {/* Yesterday's top performer spotlight */}
      {topYesterday && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-5">
          <div className="absolute top-3 right-4 opacity-10">
            <Trophy className="h-20 w-20 text-amber-500" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 font-bold text-lg shrink-0">
              {topYesterday.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600/80 mb-0.5">
                Yesterday&apos;s Top Performer
              </p>
              <p className="text-base font-bold">{topYesterday.name}</p>
              <p className="text-sm text-muted-foreground">
                {topYesterday.callCount} calls completed yesterday 🔥
              </p>
            </div>
            <div className="ml-auto text-right hidden sm:block">
              <p className="text-3xl font-bold text-amber-600">{topYesterday.callCount}</p>
              <p className="text-xs text-muted-foreground">calls</p>
            </div>
          </div>
        </div>
      )}

      {/* Team KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Agents"          value={summary.agentCount}     icon={<Users      className="h-4 w-4 text-violet-600" />} description="Sales reps" />
        <StatsCard title="Calls Today"     value={summary.callsToday}     icon={<Phone      className="h-4 w-4 text-blue-600"   />} description="Team total" />
        <StatsCard title="Calls This Week" value={summary.callsThisWeek}  icon={<TrendingUp className="h-4 w-4 text-emerald-600"/>} description="Last 7 days" />
        <StatsCard title="Calls This Month"value={summary.callsThisMonth} icon={<Star       className="h-4 w-4 text-amber-500"  />} description="Calendar month" />
      </div>

      {/* Chart + Active challenges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallVolumeChart
            data={volumeData.map((d) => ({ label: d.date, calls: d.count }))}
            title="Team Call Volume — Last 30 Days"
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

      <Separator />

      {/* Leaderboard */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/20">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="font-semibold text-sm">Weekly Leaderboard</p>
        </div>
        <div className="divide-y">
          {leaderboard.length === 0
            ? <div className="py-12 text-center text-sm text-muted-foreground">No data yet. Seed dummy data to get started.</div>
            : leaderboard.map((agent, i) => {
                const rankIcons = ["🥇", "🥈", "🥉"];
                const rankColors = ["text-amber-500", "text-slate-400", "text-orange-600"];
                return (
                  <div key={agent.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors ${i === 0 ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                    <div className={`w-7 text-center text-sm font-bold ${rankColors[i] ?? "text-muted-foreground"}`}>
                      {i < 3 ? rankIcons[i] : `#${i + 1}`}
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold shrink-0">
                      {(agent.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {agent.topBadges.slice(0, 3).map((b) => (
                          <span key={b.id} title={b.name} className="text-xs">{b.icon}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{agent.callCount}</p>
                      <p className="text-[10px] text-muted-foreground">calls</p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-sm font-semibold text-violet-600">{agent.points.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">pts</p>
                    </div>
                    <Link href={`/marketing/profile/${agent.id}`} className="text-xs text-muted-foreground hover:text-primary ml-1">→</Link>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* Agent overview table */}
      {leaderboard.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">Agent Overview</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/10 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">This Week</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Points</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Badges</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leaderboard.map((agent) => (
                <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{agent.name}</td>
                  <td className="px-4 py-3 text-right font-semibold">{agent.callCount}</td>
                  <td className="px-4 py-3 text-right text-violet-600 font-semibold">{agent.points.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {agent.topBadges.map((b) => <span key={b.id} title={b.name}>{b.icon}</span>)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/marketing/profile/${agent.id}`} className="text-xs text-primary hover:underline">
                      Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
