import { getDashboardStats } from "@/lib/dashboard/service";
import { getBossWidgets } from "@/lib/dashboard/boss.service";
import { getUsers } from "@/lib/users/service";
import { getTeamSummary, getLeaderboard } from "@/lib/marketing/team.service";
import { withDbRetry } from "@/lib/prisma";
import { IndustryBarChart } from "@/components/dashboard/IndustryBarChart";
import { QualityDonutChart } from "@/components/dashboard/QualityDonutChart";
import Link from "next/link";
import type { Role } from "@/lib/rbac/roles";

/* ── helpers ── */
function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function fmtSecs(s: number): string {
  if (s === 0) return "0s";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function pulseColor(score: number): string {
  if (score >= 8) return "text-violet-500";
  if (score >= 6) return "text-emerald-500";
  if (score >= 4) return "text-amber-500";
  return "text-red-500";
}

const METRIC_TILE_ACCENT = [
  "bg-violet-500/10 text-violet-600",
  "bg-sky-500/10 text-sky-600",
  "bg-indigo-500/10 text-indigo-600",
  "bg-teal-500/10 text-teal-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-amber-500/10 text-amber-600",
];

/* ── Status badge for call ── */
const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600",
  missed:    "bg-red-500/10 text-red-600",
  voicemail: "bg-amber-500/10 text-amber-600",
  no_answer: "bg-muted text-muted-foreground",
};

export async function BossDashboard() {
  const [stats, users, team, leaderboard, widgets] = await withDbRetry(() =>
    Promise.all([
      getDashboardStats(),
      getUsers(),
      getTeamSummary(),
      getLeaderboard("week"),
      getBossWidgets(),
    ])
  );

  const roleGroups: Record<Role, number> = {
    boss: 0, admin: 0, lead_data_analyst: 0, lead_specialist: 0, sales_rep: 0,
  };
  for (const u of users) roleGroups[u.role as Role]++;

  /* Pulse score: quality (60%) + call activity vs target (40%) */
  const callTarget   = Math.max(team.agentCount * 50, 1); // 50 calls/agent/week = target
  const callFactor   = Math.min(team.callsThisWeek / callTarget, 1) * 10;
  const qualityFactor = stats.avgQualityScore / 10;
  const pulseScore   = parseFloat((qualityFactor * 0.6 + callFactor * 0.4).toFixed(1));

  const metricTiles = [
    { label: "Agents",       value: team.agentCount },
    { label: "Calls Today",  value: team.callsToday },
    { label: "Calls / Week", value: team.callsThisWeek },
    { label: "Calls / Month", value: team.callsThisMonth },
    { label: "Active Leads", value: stats.activeLeads },
    { label: "New Leads/Wk", value: stats.leadsThisWeek },
  ];

  const top3 = leaderboard.slice(0, 3);

  /* Build activity feed from recent calls + recent leads */
  type ActivityItem = {
    key: string;
    ts: Date;
    type: "call" | "lead";
    label: string;
    sub: string;
    badge?: string;
  };

  const callItems: ActivityItem[] = widgets.recentCalls.map((c) => ({
    key: `call-${c.id}`,
    ts: new Date(c.calledAt),
    type: "call",
    label: c.agent.name ?? c.agent.email,
    sub: c.contactName ?? "Unknown contact",
    badge: fmtSecs(c.durationSecs),
  }));

  const leadItems: ActivityItem[] = stats.recentLeads.slice(0, 5).map((l) => ({
    key: `lead-${l.id}`,
    ts: new Date(l.dateCollected),
    type: "lead",
    label: l.businessName ?? "Unnamed",
    sub: l.category ?? "No category",
    badge: `${l.dataQualityScore ?? 0}% quality`,
  }));

  const feed = [...callItems, ...leadItems]
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Organisation-wide snapshot across all departments.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Users",    value: users.length,                  accent: "bg-violet-500" },
          { label: "Calls Today",    value: team.callsToday,               accent: "bg-sky-500" },
          { label: "Active Leads",   value: stats.activeLeads.toLocaleString(), accent: "bg-emerald-500" },
          { label: "Avg Quality",    value: `${stats.avgQualityScore}%`,   accent: "bg-amber-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-card shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-6 rounded-full ${k.accent}`} />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {k.label}
              </p>
            </div>
            <p className="text-4xl font-black tabular-nums leading-none">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Bento row 1: Recent Activity (2) + Active Challenges (1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-2xl bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Recent Activity</p>
              <p className="text-xs text-muted-foreground">Latest calls &amp; leads</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-600">
              {feed.length} events
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {feed.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No recent activity yet.
              </p>
            )}
            {feed.map((item) => (
              <div key={item.key} className="flex items-center gap-3 px-5 py-3">
                <span className="text-lg shrink-0">
                  {item.type === "call" ? "📞" : "📋"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {item.badge && (
                    <span className="text-[11px] font-semibold rounded-full bg-muted px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">{timeAgo(item.ts)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Challenges */}
        <div className="rounded-2xl bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Active Challenges</p>
              <p className="text-xs text-muted-foreground">Running right now</p>
            </div>
            <Link
              href="/marketing/manage/tasks"
              className="text-xs text-primary hover:underline font-medium"
            >
              Manage →
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {widgets.activeTasks.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No active challenges.{" "}
                <Link href="/marketing/manage/tasks" className="underline">
                  Create one →
                </Link>
              </p>
            )}
            {widgets.activeTasks.map((task) => {
              const total     = task._count.progress;
              const completed = task.progress.length;
              const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
              const daysLeft  = Math.ceil(
                (new Date(task.endDate).getTime() - Date.now()) / 86_400_000
              );
              return (
                <div key={task.id} className="px-5 py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{task.title}</p>
                    <span className="text-[11px] shrink-0 text-muted-foreground">
                      {daysLeft}d left
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {completed}/{total}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    🎯 {task.targetCalls} calls · ⭐ {task.pointReward} pts
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bento row 2: Team Pulse (2) + Top Agents (1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Team Pulse */}
        <div className="lg:col-span-2 rounded-2xl bg-card shadow-sm p-5 relative overflow-hidden">
          {/* Watermark */}
          <p className="absolute right-4 top-1/2 -translate-y-1/2 text-[80px] font-black text-foreground/[0.03] select-none pointer-events-none leading-none">
            Pulse
          </p>

          <div className="flex items-start gap-8">
            {/* Big score */}
            <div className="shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Team Score
              </p>
              <div className="flex items-end gap-1">
                <span className={`text-6xl font-black tabular-nums leading-none ${pulseColor(pulseScore)}`}>
                  {pulseScore}
                </span>
                <span className="text-xl font-semibold text-muted-foreground mb-1">/10</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Quality + call activity
              </p>
            </div>

            {/* 6 metric tiles */}
            <div className="flex-1 grid grid-cols-3 gap-2.5">
              {metricTiles.map((tile, i) => (
                <div
                  key={tile.label}
                  className={`rounded-xl px-3 py-2.5 ${METRIC_TILE_ACCENT[i]}`}
                >
                  <p className="text-[11px] font-semibold opacity-70 uppercase tracking-wide">
                    {tile.label}
                  </p>
                  <p className="text-xl font-black tabular-nums leading-tight mt-0.5">
                    {typeof tile.value === "number"
                      ? tile.value.toLocaleString()
                      : tile.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Agents */}
        <div className="rounded-2xl bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Top Agents</p>
              <p className="text-xs text-muted-foreground">By calls this week</p>
            </div>
            <Link
              href="/marketing"
              className="text-xs text-primary hover:underline font-medium"
            >
              Leaderboard →
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {top3.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No data yet.
              </p>
            )}
            {top3.map((agent, i) => {
              const RANK_STYLES = [
                "text-amber-500",
                "text-slate-400",
                "text-amber-700",
              ];
              const maxCalls = top3[0]?.callCount || 1;
              const pct = Math.round((agent.callCount / maxCalls) * 100);
              return (
                <div key={agent.id} className="px-5 py-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-base font-black w-5 text-center shrink-0 ${RANK_STYLES[i]}`}
                    >
                      #{i + 1}
                    </span>
                    <p className="text-sm font-semibold truncate flex-1">{agent.name}</p>
                    <span className="text-sm font-bold tabular-nums shrink-0">
                      {agent.callCount}
                    </span>
                  </div>
                  <div className="ml-7 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        i === 0
                          ? "bg-gradient-to-r from-amber-400 to-yellow-300"
                          : i === 1
                          ? "bg-gradient-to-r from-slate-400 to-slate-300"
                          : "bg-gradient-to-r from-amber-700 to-amber-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bento row 3: Charts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Leads by Industry */}
        <div className="rounded-2xl bg-card shadow-sm p-5">
          <div className="mb-3">
            <p className="font-semibold text-sm">Leads by Industry</p>
            <p className="text-xs text-muted-foreground">Top 10 categories</p>
          </div>
          <IndustryBarChart data={stats.leadsByIndustry} />
        </div>

        {/* Quality Distribution */}
        <div className="rounded-2xl bg-card shadow-sm p-5">
          <div className="mb-3">
            <p className="font-semibold text-sm">Quality Distribution</p>
            <p className="text-xs text-muted-foreground">Lead data completeness</p>
          </div>
          <QualityDonutChart data={stats.qualityDistribution} />
        </div>

        {/* Quick Actions + Dept summary */}
        <div className="rounded-2xl bg-card shadow-sm p-5 space-y-4">
          <div>
            <p className="font-semibold text-sm">Quick Actions</p>
            <p className="text-xs text-muted-foreground">Shortcuts for today</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/marketing/manage/tasks",       label: "New Challenge", emoji: "🎯" },
              { href: "/marketing/manage/badges",      label: "New Badge",     emoji: "🏅" },
              { href: "/marketing/manage/commissions", label: "Commissions",   emoji: "💰" },
              { href: "/admin/users",                  label: "Manage Users",  emoji: "👥" },
              { href: "/scraping",                     label: "Scraping",      emoji: "🔍" },
              { href: "/leads",                        label: "All Leads",     emoji: "📋" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-2 rounded-xl bg-muted/40 hover:bg-muted/70 px-3 py-2.5 transition-colors text-sm font-medium"
              >
                <span>{a.emoji}</span>
                <span className="text-xs">{a.label}</span>
              </Link>
            ))}
          </div>

          {/* Team headcount mini */}
          <div className="border-t border-border/40 pt-4 grid grid-cols-2 gap-2 text-center">
            {(["boss", "admin", "lead_specialist", "sales_rep"] as Role[]).map((r) => (
              <div key={r} className="rounded-xl bg-muted/30 py-2">
                <p className="text-base font-bold">{roleGroups[r]}</p>
                <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                  {r.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Org stats footer row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Leads",       value: stats.totalLeads.toLocaleString() },
          { label: "Leads This Week",   value: stats.leadsThisWeek.toLocaleString() },
          { label: "Scraping Jobs Run", value: stats.totalJobsRun.toLocaleString() },
          { label: "Duplicates Caught", value: stats.duplicatesPrevented.toLocaleString() },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-muted/30 px-5 py-4 text-center">
            <p className="text-2xl font-black tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
