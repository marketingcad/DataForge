"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { getAgentProfile } from "@/lib/marketing/agent.service";

type ProfileData = Awaited<ReturnType<typeof getAgentProfile>>;

const ROLE_LABELS: Record<string, string> = {
  boss:            "Boss",
  admin:           "Administrator",
  team_lead:       "Team Lead",
  sales_rep:       "Sales Representative",
  lead_specialist: "Lead Specialist",
};

const ROLE_BANNER: Record<string, string> = {
  boss:            "from-slate-700 via-slate-600 to-zinc-500",
  admin:           "from-blue-700 via-blue-600 to-cyan-500",
  team_lead:       "from-violet-700 via-violet-600 to-purple-500",
  sales_rep:       "from-violet-700 via-violet-600 to-purple-500",
  lead_specialist: "from-emerald-700 via-emerald-600 to-teal-500",
};

const ROLE_AVATAR: Record<string, string> = {
  boss:            "bg-slate-700 text-white",
  admin:           "bg-blue-700 text-white",
  team_lead:       "bg-violet-700 text-white",
  sales_rep:       "bg-violet-700 text-white",
  lead_specialist: "bg-emerald-700 text-white",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  earned:  "bg-emerald-500/10 text-emerald-600",
};

function calcTrend(current: number, previous: number) {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { dir: "up" as const, pct: 100 };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return null; // negligible
  return { dir: pct > 0 ? ("up" as const) : ("down" as const), pct: Math.abs(pct) };
}

export function ProfileView({
  data,
  isOwn,
  currency = "₱",
}: {
  data: ProfileData;
  isOwn: boolean;
  currency?: string;
}) {
  const { user, stats, allBadges, completedTasks, callHistory, repCommissions } = data;

  const role       = (user as unknown as { role?: string }).role ?? "lead_specialist";
  const isSalesRep = role === "sales_rep";
  const earned     = allBadges.filter((b) => b.earned);
  const locked     = allBadges.filter((b) => !b.earned);
  const initials   = (user.name ?? user.email).slice(0, 2).toUpperCase();
  const joinedLabel = user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const pendingCommissions = repCommissions.filter((r) => r.status === "pending");
  const earnedCommissions  = repCommissions.filter((r) => r.status === "earned");
  const totalEarned        = earnedCommissions.reduce((s, r) => s + r.amount, 0);
  const totalPending       = pendingCommissions.reduce((s, r) => s + r.amount, 0);

  // Trends — compare this month vs last month for badge and commission counts
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

  const badgesThisMonth = user.userBadges.filter((ub) => new Date(ub.earnedAt) >= thisMonthStart).length;
  const badgesLastMonth = user.userBadges.filter((ub) => {
    const d = new Date(ub.earnedAt);
    return d >= lastMonthStart && d < thisMonthStart;
  }).length;

  const commsThisMonth = repCommissions.filter((r) => new Date(r.createdAt) >= thisMonthStart).length;
  const commsLastMonth = repCommissions.filter((r) => {
    const d = new Date(r.createdAt);
    return d >= lastMonthStart && d < thisMonthStart;
  }).length;

  const statCards = isSalesRep
    ? [
        { label: "Total Calls",   value: stats.totalCalls.toLocaleString(), sub: `${stats.callsThisMonth} this month`,    trend: calcTrend(stats.callsThisMonth, stats.callsLastMonth) },
        { label: "Points",        value: user.points.toLocaleString(),       sub: `${stats.callsThisWeek} calls this week`, trend: calcTrend(stats.callsThisWeek, stats.callsLastWeek)   },
        { label: "Badges Earned", value: earned.length.toString(),           sub: `${locked.length} still locked`,          trend: calcTrend(badgesThisMonth, badgesLastMonth)            },
        { label: "Commissions",   value: repCommissions.length.toString(),   sub: `${pendingCommissions.length} pending`,   trend: calcTrend(commsThisMonth, commsLastMonth)              },
      ]
    : [
        { label: "Total Calls",     value: stats.totalCalls.toLocaleString(), sub: `${stats.callsThisMonth} this month`,    trend: calcTrend(stats.callsThisMonth, stats.callsLastMonth) },
        { label: "Points",          value: user.points.toLocaleString(),       sub: `avg ${stats.avgPerMonth}/month`,         trend: calcTrend(stats.callsThisWeek, stats.callsLastWeek)   },
        { label: "Badges Earned",   value: earned.length.toString(),           sub: `${locked.length} still locked`,          trend: calcTrend(badgesThisMonth, badgesLastMonth)            },
        { label: "Challenges Done", value: completedTasks.length.toString(),   sub: "completed",                              trend: null                                                   },
      ];

  return (
    <div className="max-w-5xl space-y-4 mx-auto">

      {/* ── Profile card ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-border/30 bg-card shadow-sm">

        {/* Banner */} 
        <div className={`h-50 bg-gray-200 relative overflow-hidden`}>
          {/* subtle dot pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Content below banner */}
        <div className="px-6 relative pb-6">
          {/* Avatar overlaps banner */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div
              className={`h-20 w-20 rounded-full border-[3px] border-card flex items-center justify-center text-xl font-black shadow-lg shrink-0 ${ROLE_AVATAR[role] ?? ROLE_AVATAR.lead_specialist}`}
            >
              {initials}
            </div>

            {!isOwn && (
              <div className="flex items-center gap-2 pb-1">
                <button className="rounded-lg bg-foreground text-background text-sm font-bold px-5 py-2 hover:opacity-80 transition-opacity">
                  Follow
                </button>
                <button className="rounded-lg border border-border text-sm font-semibold px-5 py-2 hover:bg-muted/40 transition-colors">
                  Message
                </button>
              </div>
            )}
          </div>

          {/* Name + role + meta */}
          <div className="space-y-0.5">
            <h1 className="text-xl font-black tracking-tight">
              {user.name ?? user.email}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ROLE_LABELS[role] ?? role} at DataForge
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
              <span>📅 Joined {joinedLabel}</span>
              <span>⭐ {user.points.toLocaleString()} points</span>
              {isSalesRep && earned.length > 0 && (
                <span>🏅 {earned.length} badge{earned.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-card border border-border/30 shadow-sm px-5 py-4 space-y-1"
          >
            <p className="text-xs font-semibold text-muted-foreground truncate">{s.label}</p>
            <p className="text-2xl font-black tabular-nums leading-tight">{s.value}</p>
            {s.trend ? (
              <p className={`text-[11px] font-semibold flex items-center gap-0.5 ${s.trend.dir === "up" ? "text-emerald-600" : "text-red-500"}`}>
                {s.trend.dir === "up"
                  ? <TrendingUp className="h-3 w-3 shrink-0" />
                  : <TrendingDown className="h-3 w-3 shrink-0" />}
                {s.trend.pct.toFixed(1)}% from last month
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{s.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Badges ────────────────────────────────────────────────────────── */}
      {allBadges.length > 0 && (
        <div className="rounded-2xl bg-card shadow-sm p-5 space-y-4">
          <p className="text-sm font-bold">Badges &amp; Achievements</p>

          {earned.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Earned ({earned.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {earned.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    style={{ borderColor: `${b.color}40`, background: `${b.color}08` }}
                  >
                    <span className="text-2xl shrink-0">{b.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{b.name}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Locked ({locked.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {locked.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-border/30 p-3 opacity-40 grayscale"
                  >
                    <span className="text-2xl shrink-0">{b.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{b.name}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Commissions (sales rep only) ──────────────────────────────────── */}
      {isSalesRep && (
        <div className="rounded-2xl bg-card shadow-sm p-5 space-y-4">
          <p className="text-sm font-bold">Commissions</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-center">
              <p className="text-xl font-black text-amber-600 tabular-nums">
                {currency}{totalPending.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {pendingCommissions.length} Pending
              </p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
              <p className="text-xl font-black text-emerald-600 tabular-nums">
                {currency}{totalEarned.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {earnedCommissions.length} Earned
              </p>
            </div>
          </div>

          {repCommissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              No commissions assigned yet.
            </p>
          ) : (
            <div className="space-y-2">
              {repCommissions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3 gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.rule ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                          {r.rule.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Manual
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                        {r.status === "earned" ? "✅ Earned" : "⏳ Pending"}
                      </span>
                    </div>
                    {r.note && (
                      <p className="text-xs text-muted-foreground truncate">{r.note}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="text-lg font-black text-amber-600 shrink-0 tabular-nums">
                    {currency}{r.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Completed challenges ──────────────────────────────────────────── */}
      {completedTasks.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/30 shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold">Completed Challenges</p>
          <div className="divide-y divide-border/30">
            {completedTasks.map((tp) => (
              <div key={tp.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="text-lg shrink-0">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tp.task.title}</p>
                  {tp.completedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tp.completedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                  +{tp.task.pointReward} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
