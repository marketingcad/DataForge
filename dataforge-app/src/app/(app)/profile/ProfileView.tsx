"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, Medal, Trophy, Star,
  DollarSign, Clock, CheckCircle2, BarChart2, Zap, Target,
  Phone, CalendarDays, Flame,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { getAgentProfile } from "@/lib/marketing/agent.service";

type ProfileData = Awaited<ReturnType<typeof getAgentProfile>>;

type RankingEntry = {
  id: string; name: string | null; email: string;
  appointmentsSet: number; points: number; rank: number;
};
type Rankings = { entries: RankingEntry[]; myRank: number; total: number; myEntry: RankingEntry | null } | null;

// ── constants ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  boss: "Boss", admin: "Administrator",
  team_lead: "Team Lead",
  sales_rep: "Sales Representative",
  lead_specialist: "Lead Specialist",
};

const ROLE_AVATAR: Record<string, string> = {
  boss:            "bg-slate-700  text-white",
  admin:           "bg-blue-700   text-white",
  team_lead:       "bg-violet-700  text-white",
  sales_rep:       "bg-violet-700 text-white",
  lead_specialist: "bg-emerald-700 text-white",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  earned:  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

// ── helpers ────────────────────────────────────────────────────────────────────

function calcTrend(current: number, previous: number) {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { dir: "up" as const, pct: 100 };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return null;
  return { dir: pct >= 0 ? ("up" as const) : ("down" as const), pct: Math.abs(pct) };
}

function TrendBadge({ trend }: { trend: ReturnType<typeof calcTrend> }) {
  if (!trend) return null;
  const up = trend.dir === "up";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold", up ? "text-emerald-600" : "text-red-500")}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {trend.pct.toFixed(1)}%
    </span>
  );
}

function RepAvatar({ name, email, size = "sm" }: { name: string | null; email: string; size?: "sm" | "md" }) {
  const s = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  const initials = ((name ?? email).slice(0, 2)).toUpperCase();
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  const color = colors[Math.abs([...email].reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) % colors.length];
  return (
    <div className={cn(s, "rounded-full flex items-center justify-center font-bold text-white shrink-0", color)}>
      {initials}
    </div>
  );
}

// ── tabs ───────────────────────────────────────────────────────────────────────

const TABS_SALES_REP = [
  { key: "overview",     label: "Overview",             icon: BarChart2   },
  { key: "badges",       label: "Badges & Achievements", icon: Medal       },
  { key: "commissions",  label: "Commissions",           icon: DollarSign  },
] as const;

const TABS_TEAM_LEAD = [
  { key: "overview", label: "Overview",             icon: BarChart2 },
  { key: "badges",   label: "Badges & Achievements", icon: Medal     },
] as const;

// ── main component ─────────────────────────────────────────────────────────────

export function ProfileView({
  data, isOwn, currency = "₱", rankings,
}: {
  data: ProfileData;
  isOwn: boolean;
  currency?: string;
  rankings?: Rankings;
}) {
  const { user, stats, allBadges, completedTasks, callHistory, repCommissions } = data;

  const role         = (user as unknown as { role?: string }).role ?? "lead_specialist";
  const isSalesRep   = role === "sales_rep";
  const hasAnalytics = role === "sales_rep" || role === "team_lead";
  const initials     = (user.name ?? user.email).slice(0, 2).toUpperCase();
  const joinedLabel  = user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const earned = allBadges.filter((b) => b.earned);
  const locked  = allBadges.filter((b) => !b.earned);

  const pendingComms = repCommissions.filter((r) => r.status === "pending");
  const earnedComms  = repCommissions.filter((r) => r.status === "earned");
  const totalEarned  = earnedComms.reduce((s, r) => s + r.amount, 0);
  const totalPending = pendingComms.reduce((s, r) => s + r.amount, 0);

  const tabs = isSalesRep ? TABS_SALES_REP : hasAnalytics ? TABS_TEAM_LEAD : [];
  const [activeTab, setActiveTab] = useState<string>("overview");

  const monthTrend = calcTrend(stats.callsThisMonth, stats.callsLastMonth);
  const weekTrend  = calcTrend(stats.callsThisWeek,  stats.callsLastWeek);

  return (
    <div className="max-w-7xl mx-auto space-y-4">

      {/* ── Profile header card ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm">
        {/* Neutral banner with subtle dot grid */}
        <div className="h-28 bg-muted/60 relative">
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }}
          />
        </div>

        <div className="px-6 pb-5 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between -mt-9 mb-4 gap-3">
            <div className={cn("h-[72px] w-[72px] rounded-full border-4 border-card flex items-center justify-center text-xl font-black shadow-md shrink-0", ROLE_AVATAR[role] ?? ROLE_AVATAR.lead_specialist)}>
              {initials}
            </div>
            {!isOwn && (
              <div className="flex gap-2 sm:pb-1">
                <button className="rounded-lg border bg-white border-border text-sm font-semibold px-4 py-1.5 hover:bg-muted/40 transition-colors">Message</button>
              </div>
            )}
          </div>

          <h1 className="text-xl font-black tracking-tight">{user.name ?? user.email}</h1>
          <p className="text-sm text-muted-foreground">{ROLE_LABELS[role] ?? role} · DataForge</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{user.email}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Joined {joinedLabel}</span>
            {hasAnalytics && (
              <>
                <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" /> {user.points.toLocaleString()} points</span>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {stats.totalCalls.toLocaleString()} total calls</span>
                {earned.length > 0 && (
                  <span className="flex items-center gap-1"><Medal className="h-3 w-3 text-violet-500" /> {earned.length} badge{earned.length !== 1 ? "s" : ""}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tab bar — only for analytics-eligible roles */}
        {hasAnalytics && (
          <div className="flex items-center gap-0 border-t border-border/40 px-2">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                  activeTab === key
                    ? "border-violet-500 text-violet-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {hasAnalytics && activeTab === "overview" && (
        <div className={cn("gap-4", isSalesRep && rankings ? "grid grid-cols-1 lg:grid-cols-[1fr_280px]" : "flex flex-col min-w-0")}>

          {/* Left / main column */}
          <div className="space-y-4 min-w-0">

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  icon: Phone,  label: "This Month",  value: stats.callsThisMonth,
                  sub: "calls", trend: monthTrend,    color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30",
                },
                {
                  icon: Zap,    label: "This Week",   value: stats.callsThisWeek,
                  sub: "calls", trend: weekTrend,     color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30",
                },
                {
                  icon: Flame,  label: "Best Day",    value: stats.bestDay,
                  sub: "calls", trend: null,          color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30",
                },
                {
                  icon: Target, label: "Daily Avg",   value: stats.avgPerDay,
                  sub: "calls/day", trend: null,      color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30",
                },
              ].map(({ icon: Icon, label, value, sub, trend, color, bg }) => (
                <div key={label} className="rounded-2xl border border-border/40 bg-card shadow-sm px-4 py-4 space-y-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", bg)}>
                    <Icon className={cn("h-4 w-4", color)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <p className={cn("text-2xl font-black tabular-nums leading-tight", color)}>
                      {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {trend
                        ? <TrendBadge trend={trend} />
                        : <span className="text-[11px] text-muted-foreground">{sub}</span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Avg call duration — sales rep only */}
            {isSalesRep && (
              <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-violet-500" />
                  <p className="text-sm font-bold">Avg Call Duration</p>
                  <span className="text-xs text-muted-foreground">completed calls only</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border/40">
                  {([
                    { label: "This Week",  value: stats.avgDuration.week,    color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
                    { label: "This Month", value: stats.avgDuration.month,   color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
                    { label: "All Time",   value: stats.avgDuration.allTime, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
                  ] as { label: string; value: number; color: string; bg: string }[]).map((d) => {
                    const m = Math.floor(d.value / 60), s = d.value % 60;
                    const fmt = d.value <= 0 ? "—" : m === 0 ? `${s}s` : s === 0 ? `${m}m` : `${m}m ${s}s`;
                    return (
                      <div key={d.label} className="px-5 py-4 space-y-2">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", d.bg)}>
                          <Clock className={cn("h-4 w-4", d.color)} />
                        </div>
                        <p className={cn("text-2xl font-black tabular-nums leading-tight", d.value <= 0 ? "text-muted-foreground" : d.color)}>{fmt}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{d.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 30-day chart */}
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Call Activity</p>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Monthly avg</p>
                  <p className="text-sm font-black">{stats.avgPerMonth} <span className="text-xs font-normal text-muted-foreground">calls</span></p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={callHistory} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => (
                      <text x={x} y={y} dy={10} textAnchor="middle" style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}>
                        {payload.value}
                      </text>
                    )}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => (
                      <text x={x} y={y} dy={4} textAnchor="end" style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}>
                        {payload.value}
                      </text>
                    )}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "hsl(var(--card-foreground))",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "11px" }}
                    itemStyle={{ color: "hsl(var(--card-foreground))" }}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  />
                  <Bar dataKey="calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance breakdown */}
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4">
              <p className="text-sm font-bold">Performance Breakdown</p>
              <div className="space-y-3">
                {[
                  {
                    label: "Monthly consistency",
                    value: stats.callsThisMonth,
                    max: Math.max(stats.callsThisMonth, stats.callsLastMonth, 1),
                    desc: `${stats.callsThisMonth} this month vs ${stats.callsLastMonth} last month`,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Weekly pace",
                    value: stats.callsThisWeek,
                    max: Math.max(stats.callsThisWeek, stats.callsLastWeek, 1),
                    desc: `${stats.callsThisWeek} this week vs ${stats.callsLastWeek} last week`,
                    color: "bg-violet-500",
                  },
                  {
                    label: "Best single day",
                    value: stats.bestDay,
                    max: Math.max(stats.bestDay, stats.avgPerDay * 3, 1),
                    desc: `${stats.bestDay} calls — personal record`,
                    color: "bg-rose-500",
                  },
                ].map(({ label, value, max, desc, color }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{label}</span>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", color)}
                        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed challenges — if any */}
            {completedTasks.length > 0 && (
              <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Completed Challenges</p>
                  <Badge variant="outline">{completedTasks.length}</Badge>
                </div>
                <div className="divide-y divide-border/30">
                  {completedTasks.map((tp) => (
                    <div key={tp.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="text-lg shrink-0">✅</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tp.task.title}</p>
                        {tp.completedAt && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(tp.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        +{tp.task.pointReward} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — ranking widget (sales rep only) */}
          {isSalesRep && rankings && (
            <div className="space-y-4">

              {/* My rank card */}
              <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-bold">Leaderboard Rank</p>
                </div>

                <div className="text-center py-2">
                  <div className="inline-flex flex-col items-center gap-1">
                    <p className="text-5xl font-black tabular-nums leading-none">
                      {rankings.myRank <= 3
                        ? RANK_MEDALS[rankings.myRank - 1]
                        : `#${rankings.myRank}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      out of {rankings.total} rep{rankings.total !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Gap to #1 */}
                {rankings.myRank > 1 && rankings.entries[0] && (
                  <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
                    <p className="text-[11px] text-muted-foreground">Gap to #1</p>
                    <p className="text-sm font-black text-amber-600">
                      {(rankings.entries[0].appointmentsSet - (rankings.myEntry?.appointmentsSet ?? 0)).toLocaleString()} appts
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      behind {rankings.entries[0].name ?? rankings.entries[0].email.split("@")[0]}
                    </p>
                  </div>
                )}

                {/* Progress bar to #1 */}
                {(() => {
                  const me  = rankings.myEntry;
                  const top = rankings.entries[0];
                  if (!me || !top || top.appointmentsSet === 0) return null;
                  const pct = Math.min(100, Math.round((me.appointmentsSet / top.appointmentsSet) * 100));
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>You</span>
                        <span>{pct}% of #1</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Top 5 leaderboard */}
              <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-3">
                <p className="text-sm font-bold">Top Reps</p>
                <div className="space-y-2">
                  {rankings.entries.map((entry) => {
                    const isMe = entry.id === user.id;
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors",
                          isMe
                            ? "bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800"
                            : "bg-muted/30 hover:bg-muted/50"
                        )}
                      >
                        {/* Rank / medal */}
                        <div className="w-5 text-center shrink-0">
                          {entry.rank <= 3
                            ? <span className="text-base leading-none">{RANK_MEDALS[entry.rank - 1]}</span>
                            : <span className="text-xs font-bold text-muted-foreground">#{entry.rank}</span>
                          }
                        </div>

                        <RepAvatar name={entry.name} email={entry.email} />

                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-semibold truncate", isMe && "text-violet-700 dark:text-violet-400")}>
                            {isMe ? "You" : (entry.name ?? entry.email.split("@")[0])}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{entry.appointmentsSet.toLocaleString()} appts booked</p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-black tabular-nums">{entry.points.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">pts</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show "your position" if you're outside top 5 */}
                  {rankings.myRank > 5 && rankings.myEntry && (() => {
                    const me = rankings.myEntry;
                    return (
                      <>
                        <div className="flex items-center gap-1 px-3 py-0.5">
                          <div className="flex-1 border-t border-dashed border-border/60" />
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <div className="flex-1 border-t border-dashed border-border/60" />
                        </div>
                        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800">
                          <div className="w-5 text-center shrink-0">
                            <span className="text-xs font-bold text-muted-foreground">#{me.rank}</span>
                          </div>
                          <RepAvatar name={me.name} email={me.email} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate text-violet-700 dark:text-violet-400">You</p>
                            <p className="text-[10px] text-muted-foreground">{me.appointmentsSet.toLocaleString()} appts booked</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black tabular-nums">{me.points.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">pts</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BADGES TAB ────────────────────────────────────────────────────── */}
      {hasAnalytics && activeTab === "badges" && (
        <div className="space-y-4">

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm px-5 py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 ring-4 ring-amber-100 dark:ring-amber-900 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Earned</p>
                <p className="text-2xl font-black text-amber-600 tabular-nums">{earned.length}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm px-5 py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-muted ring-4 ring-border/40 flex items-center justify-center">
                <Medal className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Still Locked</p>
                <p className="text-2xl font-black tabular-nums">{locked.length}</p>
              </div>
            </div>
          </div>

          {allBadges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center space-y-2">
              <Medal className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-semibold">No badges configured yet</p>
            </div>
          ) : (
            <>
              {earned.length > 0 && (
                <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-bold">Earned Badges</p>
                    <Badge variant="outline" className="ml-auto border-amber-200 bg-amber-50 text-amber-700 text-[10px]">{earned.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 lg:grid-cols-10">
                    {earned.map((b) => {
                      const ub = user.userBadges.find((ub) => ub.badge.key === b.key);
                      return (
                        <div
                          key={b.id}
                          className="flex flex-col items-center gap-3 rounded-xl p-1 relative overflow-hidden"
                        >
                          <span className="text-4xl shrink-0">{b.icon}</span>
                          <div className="min-w-0 text-center flex-1">
                            <p className="text-sm font-bold truncate">{b.name}</p>
                          
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {locked.length > 0 && (
                <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Medal className="h-4 w-4 text-muted-foreground/50" />
                    <p className="text-sm font-bold text-muted-foreground">Locked Badges</p>
                    <Badge variant="outline" className="ml-auto text-[10px]">{locked.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    {locked.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-col text-center items-center gap-3 rounded-xl border border-border/30 bg-muted/20 p-4 opacity-50 grayscale flex-col">
                        <span className="text-3xl shrink-0">{b.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{b.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── COMMISSIONS TAB (sales rep only) ─────────────────────────────── */}
      {hasAnalytics && activeTab === "commissions" && isSalesRep && (
        <div className="space-y-4">

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: DollarSign,  label: "Total Assigned",     value: repCommissions.length,                      display: `${repCommissions.length}`,                      color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30",    ring: "ring-blue-100 dark:ring-blue-900" },
              { icon: Clock,       label: "Pending Payout",     value: totalPending,                               display: `${currency}${totalPending.toLocaleString()}`,   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30",  ring: "ring-amber-100 dark:ring-amber-900" },
              { icon: CheckCircle2, label: "Total Earned",      value: totalEarned,                                display: `${currency}${totalEarned.toLocaleString()}`,    color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", ring: "ring-emerald-100 dark:ring-emerald-900" },
            ].map(({ icon: Icon, label, display, color, bg, ring }) => (
              <div key={label} className="rounded-2xl border border-border/40 bg-card shadow-sm px-5 py-4 flex items-center gap-4">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-4", bg, ring)}>
                  <Icon className={cn("h-5 w-5", color)} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                  <p className={cn("text-2xl font-black tabular-nums", color)}>{display}</p>
                </div>
              </div>
            ))}
          </div>

          {repCommissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center space-y-2">
              <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-semibold">No commissions yet</p>
              <p className="text-xs text-muted-foreground">Your manager will assign commissions here.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <p className="text-sm font-bold">Commission History</p>
                <span className="text-xs text-muted-foreground">{repCommissions.length} records</span>
              </div>
              <div className="divide-y divide-border/30">
                {repCommissions.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Status icon */}
                    <div className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                      r.status === "earned" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"
                    )}>
                      {r.status === "earned"
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : <Clock className="h-4 w-4 text-amber-600" />
                      }
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.rule ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                            {r.rule.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Manual</span>
                        )}
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_STYLE[r.status])}>
                          {r.status === "earned" ? "Earned" : "Pending"}
                        </Badge>
                      </div>
                      {r.note && <p className="text-xs text-muted-foreground truncate">{r.note}</p>}
                      <p className="text-[11px] text-muted-foreground">
                        Assigned {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {r.status === "earned" && r.earnedAt && (
                          <> · Earned {new Date(r.earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                        )}
                      </p>
                    </div>

                    {/* Amount */}
                    <p className={cn(
                      "text-lg font-black tabular-nums shrink-0",
                      r.status === "earned" ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {currency}{r.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
