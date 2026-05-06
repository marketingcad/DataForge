/**
 * AgentDashboard.tsx
 * Marketing view for Sales Rep role — gamified theme.
 */
import { withDbRetry } from "@/lib/prisma";
import {
  getAgentStats,
  getAgentRecentCalls,
  getAgentMonthlyBreakdown,
  getAgentLeads,
} from "@/lib/marketing/agent.service";
import {
  getLeaderboard,
  getRepDailyCallsForChart,
  getRepDailyLeadsForChart,
} from "@/lib/marketing/team.service";
import { TaskCard } from "../TaskCard";
import { Phone, Clock, Flame, ArrowRight, BookmarkCheck, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AppointmentsModalButton } from "@/components/marketing/AppointmentsModal";
import { AgentRadarChart } from "@/components/marketing/AgentRadarChart";
import { RepPerformanceChart } from "@/components/marketing/RepPerformanceChart";
import { LeaderboardClientWrapper } from "@/components/marketing/LeaderboardClientWrapper";
import { BalloonPopFeed } from "@/components/marketing/BalloonPopFeed";

interface Props {
  userId: string;
  period?: string;
}

const STATUS_STYLE: Record<string, string> = {
  completed: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300",
  missed:    "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  voicemail: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
  no_answer: "text-slate-600 bg-slate-100 dark:bg-slate-800/50",
};

const RECORD_STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground border-border",
  archived: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400",
};

const RANK_TIER = (rank: number) => {
  if (rank === 1) return { label: "Champion",  color: "text-amber-400",   bg: "bg-amber-500/15  border-amber-500/30",  glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]"  };
  if (rank === 2) return { label: "Elite",     color: "text-cyan-400",    bg: "bg-cyan-500/15   border-cyan-500/30",   glow: "shadow-[0_0_16px_rgba(6,182,212,0.25)]"  };
  if (rank === 3) return { label: "Pro",       color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30", glow: "shadow-[0_0_16px_rgba(249,115,22,0.25)]" };
  if (rank <= 5) return { label: "Advanced",  color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20", glow: "" };
  return              { label: "Agent",      color: "text-slate-400",   bg: "bg-muted         border-border",         glow: "" };
};

export async function AgentDashboard({ userId }: Props) {
  const [stats, recentCalls, leaderboard, monthlyBreakdown, leadData] = await withDbRetry(() =>
    Promise.all([
      getAgentStats(userId),
      getAgentRecentCalls(userId, 8),
      getLeaderboard("week"),
      getAgentMonthlyBreakdown(userId),
      getAgentLeads(userId),
    ])
  );

  const top5Ids = leaderboard.slice(0, 5).map((r) => r.id);
  if (!top5Ids.includes(userId)) top5Ids.splice(4, 1, userId);
  const [repCallChartData, repLeadChartData] = await Promise.all([
    getRepDailyCallsForChart(top5Ids, 30),
    getRepDailyLeadsForChart(top5Ids, 30),
  ]);
  const repCallMeta = top5Ids.map((id) => {
    const entry = leaderboard.find((r) => r.id === id);
    return { id, name: entry?.name ?? "You", callCount: entry?.callCount ?? stats.thisWeek };
  });
  const repLeadTotals: Record<string, number> = {};
  for (const row of repLeadChartData) {
    for (const id of top5Ids) {
      repLeadTotals[id] = (repLeadTotals[id] ?? 0) + ((row[id] as number) || 0);
    }
  }
  const repLeadMeta = top5Ids.map((id) => {
    const entry = leaderboard.find((r) => r.id === id);
    return {
      id, name: entry?.name ?? "You",
      callCount: repLeadTotals[id] ?? 0,
      metricLabel: `${repLeadTotals[id] ?? 0} leads`,
    };
  });

  const myRankIdx    = leaderboard.findIndex((a) => a.id === userId);
  const myRank       = myRankIdx + 1;
  const maxCalls     = leaderboard[0]?.callCount || 1;
  const myEntry      = myRankIdx >= 0 ? leaderboard[myRankIdx] : null;
  const leader       = leaderboard[0];
  const behindLeader = leader && myEntry ? leader.callCount - myEntry.callCount : 0;
  const tier         = RANK_TIER(myRank);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  // XP bar: percentage of calls toward team leader
  const xpPct = myEntry && maxCalls > 0 ? Math.min(100, Math.round((myEntry.callCount / maxCalls) * 100)) : 0;

  const statCards = [
    { label: "Today",       value: stats.today,          icon: "⚡", color: "text-blue-500",    bg: "bg-blue-500/10",    bar: "bg-blue-500"    },
    { label: "This Week",   value: stats.thisWeek,        icon: "🔥", color: "text-orange-500",  bg: "bg-orange-500/10",  bar: "bg-orange-500"  },
    { label: "This Month",  value: stats.thisMonth,       icon: "📈", color: "text-violet-500",  bg: "bg-violet-500/10",  bar: "bg-violet-500"  },
    { label: "Total Calls", value: stats.total,           icon: "📞", color: "text-emerald-500", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
    { label: "Appts Set",   value: stats.appointmentsSet, icon: "📅", color: "text-sky-500",     bg: "bg-sky-500/10",     bar: "bg-sky-500"     },
    { label: "Deals Won",   value: stats.dealsWon,        icon: "🏆", color: "text-amber-500",   bg: "bg-amber-500/10",   bar: "bg-amber-500"   },
  ];

  return (
    <div className="space-y-7">

      {/* ── Hero header: rank card + greeting ── */}
      <div className={`rounded-2xl border p-5 ${tier.bg} ${tier.glow} flex items-center justify-between gap-4 flex-wrap`}>
        <div className="flex items-center gap-4">
          <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-2xl font-black shadow-lg shrink-0`}>
            {myRank > 0 ? (myRank === 1 ? "👑" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : `#${myRank}`) : "—"}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{greeting}</p>
            <p className="text-lg font-black leading-tight">
              {myRank > 0 ? `Ranked #${myRank} on the team` : "Welcome back!"}
            </p>
            <p className={`text-xs font-bold ${tier.color} mt-0.5`}>{tier.label} Tier</p>
          </div>
        </div>

        {/* XP bar toward leader */}
        <div className="flex-1 min-w-[160px] max-w-xs space-y-1.5">
          <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Progress to #1</span>
            <span className={tier.color}>{xpPct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-black/20 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-300 transition-all duration-700 shadow-[0_0_8px_rgba(139,92,246,0.6)]"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          {behindLeader > 0
            ? <p className="text-[10px] text-muted-foreground">{behindLeader} call{behindLeader !== 1 ? "s" : ""} behind the leader</p>
            : <p className="text-[10px] text-amber-500 font-bold">🔥 You&apos;re leading the pack!</p>
          }
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AppointmentsModalButton agentId={userId} />
          <Link
            href="/marketing/profile"
            className="inline-flex items-center gap-1.5 rounded-xl bg-card/80 shadow-sm border border-border/40 px-4 py-2 text-sm font-semibold hover:bg-muted/40 transition-colors"
          >
            My Profile →
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((k) => (
          <div key={k.label} className="rounded-2xl bg-card shadow-sm p-4 space-y-2">
            <div className={`h-9 w-9 rounded-xl ${k.bg} flex items-center justify-center text-lg shrink-0`}>
              {k.icon}
            </div>
            <p className="text-2xl font-black tabular-nums leading-tight">{k.value.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Performance charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RepPerformanceChart
          data={repCallChartData}
          reps={repCallMeta}
          myId={userId}
          title="Performance vs Team"
          subtitle="Your daily calls vs top reps — last 30 days"
        />
        <RepPerformanceChart
          data={repLeadChartData}
          reps={repLeadMeta}
          myId={userId}
          title="Leads Secured vs Team"
          subtitle="Your daily leads vs top reps — last 30 days"
        />
      </div>

      {/* ── Radar + Leads ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40">
            <p className="font-bold text-sm">6-Month Activity</p>
            <p className="text-xs text-muted-foreground mt-0.5">Calls made vs leads saved per month</p>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <AgentRadarChart data={monthlyBreakdown} />
          </div>
        </div>

        <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">My Leads</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {leadData.totalSaved} saved · {leadData.totalAssigned} assigned
              </p>
            </div>
            <Link href="/marketing/my-leads" className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline shrink-0">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-1">
            {[
              { label: `Saved (${leadData.totalSaved})`,       icon: BookmarkCheck, list: leadData.savedLeads,    color: "text-violet-600" },
              { label: `Assigned (${leadData.totalAssigned})`, icon: Users,         list: leadData.assignedLeads, color: "text-blue-600"   },
            ].map(({ label, icon: Icon, list, color }, idx) => (
              <div key={label} className={`flex-1 min-w-0 ${idx === 0 ? "border-r border-border/40" : ""}`}>
                <div className={`px-4 py-2.5 border-b border-border/40 flex items-center gap-1.5 text-xs font-semibold ${color}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </div>
                <div className="divide-y divide-border/30 overflow-y-auto max-h-[280px]">
                  {list.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-8">No leads.</p>
                    : list.map((lead) => (
                        <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{lead.businessName}</p>
                            <p className="text-[10px] text-muted-foreground">{[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${RECORD_STATUS_STYLE[lead.recordStatus] ?? ""}`}>
                            {lead.recordStatus}
                          </span>
                        </Link>
                      ))
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
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
                : <span className="text-xs font-bold text-amber-500">🔥 You&apos;re leading!</span>
            )}
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {leaderboard.slice(0, 6).map((entry, i) => {
              const isMe = entry.id === userId;
              const pct  = maxCalls > 0 ? Math.round((entry.callCount / maxCalls) * 100) : 0;
              const medal = i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
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
                    isMe    ? "bg-gradient-to-br from-violet-400 to-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.4)]" :
                    i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" :
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
              <p className="text-xs text-center text-muted-foreground pt-1">+{leaderboard.length - 6} more agents</p>
            )}
          </div>
        </div>
      )}

      {/* ── Challenges + Recent calls ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <p className="font-bold text-sm">Active Challenges</p>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          {stats.activeTasks.length === 0
            ? <div className="py-12 text-center"><p className="text-2xl mb-2">🎯</p><p className="text-sm text-muted-foreground">No active challenges right now.</p></div>
            : <div className="divide-y divide-border/40">{stats.activeTasks.map((tp) => (
                <TaskCard key={tp.id} task={tp.task} myProgress={{ callCount: tp.callCount, completed: tp.completed }} teamCompleted={null} isBoss={false} />
              ))}</div>
          }
        </div>

        <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <p className="font-bold text-sm">Recent Calls</p>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          {recentCalls.length === 0
            ? <div className="py-12 text-center"><p className="text-2xl mb-2">📞</p><p className="text-sm text-muted-foreground">No calls logged yet.</p></div>
            : <div className="divide-y divide-border/40">{recentCalls.map((call) => (
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
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[call.status] ?? ""}`}>
                    {call.status.replace("_", " ")}
                  </span>
                </div>
              ))}</div>
          }
        </div>
      </div>

      {/* ── Badges / Achievements ── */}
      {stats.badges.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Achievements Unlocked</p>
            <Link href="/marketing/profile?tab=badges" className="text-xs text-primary hover:underline font-medium">View all →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.badges.map((ub) => (
              <div key={ub.badge.id} title={ub.badge.description} className="flex items-center gap-2.5 rounded-xl bg-card shadow-sm border border-border/40 px-4 py-3 hover:border-violet-300/60 transition-colors">
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
        <div className="rounded-2xl bg-card shadow-sm border border-dashed border-border/60 p-5 flex items-center gap-4">
          <span className="text-3xl">🎯</span>
          <div>
            <p className="text-sm font-bold">No achievements yet — keep dialing!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Complete challenges and hit milestones to unlock badges.</p>
          </div>
          <Link href="/marketing/profile" className="ml-auto text-xs text-primary hover:underline shrink-0 font-medium">View profile →</Link>
        </div>
      )}

      {/* ── Team Leaderboard ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Team Leaderboard</p>
          <span className="text-xs text-muted-foreground">This week · appointments set</span>
        </div>
        <Suspense fallback={<div className="rounded-3xl border bg-card h-40 flex items-center justify-center text-sm text-muted-foreground">Loading leaderboard…</div>}>
          <LeaderboardClientWrapper
            initialLeaderboard={leaderboard}
            initialPeriod="week"
            initialMetric="appts_set"
          />
        </Suspense>
      </div>

      {/* ── Balloon Pop Feed ── */}
      <div className="h-80">
        <BalloonPopFeed manageHref="/balloons" />
      </div>

    </div>
  );
}
