/**
 * AgentDashboard.tsx
 * Marketing view for Sales Rep role.
 * Shows personal stats, active challenges with progress bars, recent calls, badges.
 */
import { withDbRetry } from "@/lib/prisma";
import { getAgentStats, getAgentRecentCalls } from "@/lib/marketing/agent.service";
import { getLeaderboard } from "@/lib/marketing/team.service";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Separator } from "@/components/ui/separator";
import { TaskCard } from "../TaskCard";
import {
  Phone, Trophy, TrendingUp, Star, Clock, Flame, Medal, Zap,
} from "lucide-react";
import Link from "next/link";

interface Props {
  userId: string;
  period?: string;
}

export async function AgentDashboard({ userId, period = "week" }: Props) {
  const [stats, recentCalls, leaderboard] = await withDbRetry(() =>
    Promise.all([
      getAgentStats(userId),
      getAgentRecentCalls(userId, 8),
      getLeaderboard("week"),
    ])
  );

  const myRank = leaderboard.findIndex((a) => a.id === userId) + 1;

  const statusColor: Record<string, string> = {
    completed: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    missed:    "text-red-500 bg-red-50 dark:bg-red-950/30",
    voicemail: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
    no_answer: "text-slate-500 bg-slate-100 dark:bg-slate-800/40",
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{greeting}! 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your performance &amp; active challenges.</p>
        </div>
        <Link
          href="/marketing/profile"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Medal className="h-3.5 w-3.5" /> My Profile
        </Link>
      </div>

      <Separator />

      {/* Personal KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Calls Today"  value={stats.today}     icon={<Zap       className="h-4 w-4 text-blue-600"   />} description="So far" />
        <StatsCard title="This Week"    value={stats.thisWeek}  icon={<TrendingUp className="h-4 w-4 text-emerald-600"/>} description="Last 7 days" />
        <StatsCard title="This Month"   value={stats.thisMonth} icon={<Star       className="h-4 w-4 text-violet-600" />} description="Calendar month" />
        <StatsCard title="My Rank"      value={myRank > 0 ? `#${myRank}` : "—"} icon={<Trophy className="h-4 w-4 text-amber-500"/>} description="This week" />
      </div>

      {/* Active challenges + Recent calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Active challenges */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Active Challenges</h2>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          {stats.activeTasks.length === 0
            ? (
              <div className="rounded-xl border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">No active challenges right now. Check back soon!</p>
              </div>
            )
            : (
              <div className="rounded-xl border bg-card divide-y overflow-hidden">
                {stats.activeTasks.map((tp) => (
                  <TaskCard
                    key={tp.id}
                    task={tp.task}
                    myProgress={{ callCount: tp.callCount, completed: tp.completed }}
                    teamCompleted={null}
                    isBoss={false}
                  />
                ))}
              </div>
            )
          }
        </div>

        {/* Recent calls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Calls</h2>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            {recentCalls.length === 0
              ? <div className="p-6 text-center text-sm text-muted-foreground">No calls logged yet.</div>
              : recentCalls.map((call, i) => (
                  <div key={call.id} className={`flex items-center gap-3 px-4 py-3 ${i !== recentCalls.length - 1 ? "border-b" : ""}`}>
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{call.contactName ?? "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {call.calledAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{Math.round(call.durationSecs / 60)}m
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[call.status] ?? ""}`}>
                      {call.status.replace("_", " ")}
                    </span>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* Badges showcase */}
      {stats.badges.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your Badges</h2>
            <Link href="/marketing/profile" className="text-xs text-primary hover:underline">View full profile →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.badges.map((ub) => (
              <div key={ub.badge.id} title={ub.badge.description} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <span className="text-xl leading-none">{ub.badge.icon}</span>
                <div>
                  <p className="text-xs font-semibold">{ub.badge.name}</p>
                  <p className="text-[10px] text-muted-foreground">{ub.badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-5 flex items-center gap-4">
          <span className="text-3xl">🎯</span>
          <div>
            <p className="text-sm font-semibold">No badges yet — keep dialing!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Complete challenges and hit milestones to earn badges.</p>
          </div>
          <Link href="/marketing/profile" className="ml-auto text-xs text-primary hover:underline shrink-0">
            View profile →
          </Link>
        </div>
      )}
    </div>
  );
}
