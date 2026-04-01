/**
 * AgentDashboard.tsx
 * Marketing view for Sales Rep role.
 */
import { withDbRetry } from "@/lib/prisma";
import { getAgentStats, getAgentRecentCalls } from "@/lib/marketing/agent.service";
import { getLeaderboard } from "@/lib/marketing/team.service";
import { TaskCard } from "../TaskCard";
import { Phone, Trophy, TrendingUp, Star, Clock, Flame, Medal, Zap } from "lucide-react";
import Link from "next/link";

interface Props {
  userId: string;
  period?: string;
}

const statusStyle: Record<string, string> = {
  completed: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300",
  missed:    "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  voicemail: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
  no_answer: "text-slate-600 bg-slate-100 dark:bg-slate-800/50",
};

export async function AgentDashboard({ userId, period = "week" }: Props) {
  const [stats, recentCalls, leaderboard] = await withDbRetry(() =>
    Promise.all([
      getAgentStats(userId),
      getAgentRecentCalls(userId, 8),
      getLeaderboard("week"),
    ])
  );

  const myRankIdx    = leaderboard.findIndex((a) => a.id === userId);
  const myRank       = myRankIdx + 1;
  const maxCalls     = leaderboard[0]?.callCount || 1;
  const myEntry      = myRankIdx >= 0 ? leaderboard[myRankIdx] : null;
  const leader       = leaderboard[0];
  const behindLeader = leader && myEntry ? leader.callCount - myEntry.callCount : 0;

  const rankEmoji =
    myRank === 1 ? "🥇" :
    myRank === 2 ? "🥈" :
    myRank === 3 ? "🥉" : myRank > 0 ? `#${myRank}` : "—";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const kpis = [
    { label: "Today",       value: stats.today,     icon: <Zap       className="h-4 w-4" />, accent: "text-blue-500",    bg: "bg-blue-500/10"    },
    { label: "This Week",   value: stats.thisWeek,  icon: <TrendingUp className="h-4 w-4" />, accent: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "This Month",  value: stats.thisMonth, icon: <Star      className="h-4 w-4" />, accent: "text-violet-500",  bg: "bg-violet-500/10"  },
    { label: "My Rank",     value: rankEmoji,       icon: <Trophy    className="h-4 w-4" />, accent: "text-amber-500",   bg: "bg-amber-500/10"   },
  ];

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">{greeting}! 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your performance &amp; active challenges.</p>
        </div>
        <Link
          href="/marketing/profile"
          className="inline-flex items-center gap-1.5 rounded-xl bg-card shadow-sm border border-border/40 px-4 py-2 text-sm font-semibold hover:bg-muted/40 transition-colors"
        >
          <Medal className="h-3.5 w-3.5" /> My Profile
        </Link>
      </div>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-card shadow-sm p-5 flex items-start gap-3">
            <div className={`h-9 w-9 rounded-xl ${k.bg} flex items-center justify-center shrink-0 ${k.accent}`}>
              {k.icon}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <p className="text-2xl font-black tabular-nums leading-tight mt-0.5">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Team Race ── */}
      {leaderboard.length > 1 && (
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <p className="font-bold text-sm">Team Race — This Week</p>
            </div>
            {myRank > 0 && (
              behindLeader > 0
                ? <span className="text-xs text-muted-foreground">{behindLeader} call{behindLeader !== 1 ? "s" : ""} from the lead</span>
                : <span className="text-xs font-bold text-amber-600 dark:text-amber-400">🔥 You&apos;re leading!</span>
            )}
          </div>

          <div className="px-5 py-4 space-y-2.5">
            {leaderboard.slice(0, 6).map((entry, i) => {
              const isMe = entry.id === userId;
              const pct  = maxCalls > 0 ? Math.round((entry.callCount / maxCalls) * 100) : 0;
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                    isMe
                      ? "bg-violet-50 dark:bg-violet-950/30 ring-1 ring-violet-300/60 dark:ring-violet-700/40"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <span className="text-sm w-6 text-center shrink-0 font-bold">{medal}</span>

                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${
                    isMe        ? "bg-gradient-to-br from-violet-400 to-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.4)]" :
                    i === 0     ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                    "bg-muted text-foreground"
                  }`}>
                    {(entry.name ?? "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold truncate ${isMe ? "text-violet-700 dark:text-violet-300" : ""}`}>
                        {isMe ? `${entry.name} (you)` : (entry.name ?? "—")}
                      </p>
                      <span className="text-xs font-black tabular-nums shrink-0">{entry.callCount}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isMe    ? "bg-gradient-to-r from-violet-500 to-violet-400" :
                          i === 0 ? "bg-gradient-to-r from-amber-400 to-orange-400" :
                          "bg-muted-foreground/25"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {leaderboard.length > 6 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{leaderboard.length - 6} more agent{leaderboard.length - 6 !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Challenges + Recent calls ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Active challenges */}
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <p className="font-bold text-sm">Active Challenges</p>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          {stats.activeTasks.length === 0
            ? (
              <div className="py-12 text-center">
                <p className="text-2xl mb-2">🎯</p>
                <p className="text-sm text-muted-foreground">No active challenges right now.</p>
              </div>
            )
            : (
              <div className="divide-y divide-border/40">
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
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <p className="font-bold text-sm">Recent Calls</p>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          {recentCalls.length === 0
            ? (
              <div className="py-12 text-center">
                <p className="text-2xl mb-2">📞</p>
                <p className="text-sm text-muted-foreground">No calls logged yet.</p>
              </div>
            )
            : (
              <div className="divide-y divide-border/40">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{call.contactName ?? "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {call.calledAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{Math.round(call.durationSecs / 60)}m
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${statusStyle[call.status] ?? ""}`}>
                      {call.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Badges ── */}
      {stats.badges.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Your Badges</p>
            <Link href="/marketing/profile" className="text-xs text-primary hover:underline font-medium">View full profile →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.badges.map((ub) => (
              <div key={ub.badge.id} title={ub.badge.description} className="flex items-center gap-2.5 rounded-xl bg-card shadow-sm px-4 py-3">
                <span className="text-2xl leading-none">{ub.badge.icon}</span>
                <div>
                  <p className="text-xs font-bold">{ub.badge.name}</p>
                  <p className="text-[10px] text-muted-foreground">{ub.badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-card shadow-sm p-5 flex items-center gap-4">
          <span className="text-3xl">🎯</span>
          <div>
            <p className="text-sm font-bold">No badges yet — keep dialing!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Complete challenges and hit milestones to earn badges.</p>
          </div>
          <Link href="/marketing/profile" className="ml-auto text-xs text-primary hover:underline shrink-0 font-medium">
            View profile →
          </Link>
        </div>
      )}
    </div>
  );
}
