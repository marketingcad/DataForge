import { getDashboardStats } from "@/lib/dashboard/service";
import { getBossWidgets } from "@/lib/dashboard/boss.service";
import { getUsers } from "@/lib/users/service";
import { getTeamSummary, getLeaderboard } from "@/lib/marketing/team.service";
import { withDbRetry } from "@/lib/prisma";
import { IndustryBarChart } from "@/components/dashboard/IndustryBarChart";
import { QualityDonutChart } from "@/components/dashboard/QualityDonutChart";
import Link from "next/link";
import {
  Phone,
  FileText,
  Flag,
  Award,
  DollarSign,
  Users,
  ScanSearch,
  Layers,
  Target,
  CheckCircle2,
  Zap,
  TrendingUp,
} from "lucide-react";
import type { Role } from "@/lib/rbac/roles";

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

  const callTarget   = Math.max(team.agentCount * 50, 1);
  const callFactor   = Math.min(team.callsThisWeek / callTarget, 1) * 10;
  const qualityFactor = stats.avgQualityScore / 10;
  const pulseScore   = parseFloat((qualityFactor * 0.6 + callFactor * 0.4).toFixed(1));

  const metricTiles = [
    { label: "Agents",        value: team.agentCount },
    { label: "Calls Today",   value: team.callsToday },
    { label: "Calls / Wk",   value: team.callsThisWeek },
    { label: "Calls / Mo",   value: team.callsThisMonth },
    { label: "Active Leads",  value: stats.activeLeads },
    { label: "New Leads / Wk", value: stats.leadsThisWeek },
  ];

  const top3 = leaderboard.slice(0, 3);

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
    badge: `${l.dataQualityScore ?? 0}%`,
  }));

  const feed = [...callItems, ...leadItems]
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 8);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Organisation-wide snapshot</p>
      </div>

      {/* ── BENTO HERO ── */}
      <div
        className="grid grid-cols-4 gap-3"
        style={{ gridTemplateRows: "minmax(140px,auto) minmax(140px,auto)" }}
      >
        {/* Team Pulse — dark anchor, spans 2 cols × 2 rows */}
        <div className="col-span-2 row-span-2 rounded-2xl bg-foreground text-background p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2">
              Team Pulse
            </p>
            <div className="flex items-end gap-2">
              <span className="text-7xl font-black tabular-nums leading-none">
                {pulseScore}
              </span>
              <span className="text-2xl font-semibold opacity-40 mb-1">/10</span>
            </div>
            <p className="text-xs opacity-40 mt-1">quality + call activity index</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metricTiles.map((tile) => (
              <div key={tile.label} className="rounded-xl bg-background/[0.08] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-50">
                  {tile.label}
                </p>
                <p className="text-lg font-black tabular-nums leading-tight mt-0.5">
                  {typeof tile.value === "number"
                    ? tile.value.toLocaleString()
                    : tile.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Calls Today */}
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Calls Today
          </p>
          <div>
            <p className="text-5xl font-black tabular-nums leading-none">{team.callsToday}</p>
            <p className="text-xs text-muted-foreground mt-1">logged so far</p>
          </div>
        </div>

        {/* Active Leads */}
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Active Leads
          </p>
          <div>
            <p className="text-5xl font-black tabular-nums leading-none">
              {stats.activeLeads.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">in the pipeline</p>
          </div>
        </div>

        {/* Team Size */}
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Team Size
          </p>
          <div>
            <p className="text-5xl font-black tabular-nums leading-none">{users.length}</p>
            <p className="text-xs text-muted-foreground mt-1">total users</p>
          </div>
        </div>

        {/* Avg Quality — violet accent */}
        <div className="rounded-2xl bg-violet-600 text-white p-5 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            Avg Quality
          </p>
          <div>
            <p className="text-5xl font-black tabular-nums leading-none">
              {stats.avgQualityScore}%
            </p>
            <p className="text-xs opacity-60 mt-1">data completeness</p>
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: Activity + Challenges ── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Recent Activity */}
        <div className="col-span-2 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Recent Activity</p>
              <p className="text-xs text-muted-foreground">Latest calls &amp; leads</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-border/60 px-2.5 py-0.5 text-xs font-semibold">
              {feed.length} events
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {feed.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No recent activity yet.
              </p>
            )}
            {feed.map((item) => {
              const Icon = item.type === "call" ? Phone : FileText;
              return (
                <div key={item.key} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
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
              );
            })}
          </div>
        </div>

        {/* Active Challenges */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Challenges</p>
              <p className="text-xs text-muted-foreground">Running now</p>
            </div>
            <Link
              href="/marketing/manage/tasks"
              className="text-xs font-medium hover:underline"
            >
              Manage
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {widgets.activeTasks.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No active challenges.{" "}
                <Link href="/marketing/manage/tasks" className="underline">
                  Create one
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
                        className="h-full rounded-full bg-foreground transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {completed}/{total}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {task.targetCalls} calls
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {task.pointReward} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Top Agents + Charts + Quick Actions ── */}
      <div className="grid grid-cols-4 gap-3">

        {/* Top Agents */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Top Agents</p>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
            <Link href="/marketing" className="text-xs font-medium hover:underline">
              All
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {top3.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No data yet.
              </p>
            )}
            {top3.map((agent, i) => {
              const RANK = ["#1", "#2", "#3"];
              const maxCalls = top3[0]?.callCount || 1;
              const pct = Math.round((agent.callCount / maxCalls) * 100);
              return (
                <div key={agent.id} className="px-5 py-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black w-5 text-center shrink-0 text-muted-foreground">
                      {RANK[i]}
                    </span>
                    <p className="text-sm font-semibold truncate flex-1">{agent.name}</p>
                    <span className="text-sm font-bold tabular-nums shrink-0">
                      {agent.callCount}
                    </span>
                  </div>
                  <div className="ml-7 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leads by Industry */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="font-semibold text-sm mb-0.5">By Industry</p>
          <p className="text-xs text-muted-foreground mb-3">Top 10 categories</p>
          <IndustryBarChart data={stats.leadsByIndustry} />
        </div>

        {/* Quality Distribution */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="font-semibold text-sm mb-0.5">Quality Spread</p>
          <p className="text-xs text-muted-foreground mb-3">Data completeness</p>
          <QualityDonutChart data={stats.qualityDistribution} />
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div>
            <p className="font-semibold text-sm">Quick Actions</p>
            <p className="text-xs text-muted-foreground">Shortcuts</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/marketing/manage/tasks",       label: "New Challenge", Icon: Flag        },
              { href: "/marketing/manage/badges",      label: "New Badge",     Icon: Award       },
              { href: "/marketing/manage/commissions", label: "Commissions",   Icon: DollarSign  },
              { href: "/admin/users",                  label: "Manage Users",  Icon: Users       },
              { href: "/scraping",                     label: "Scraping",      Icon: ScanSearch  },
              { href: "/leads",                        label: "All Leads",     Icon: Layers      },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-2 rounded-xl bg-muted/40 hover:bg-muted/70 px-3 py-2.5 transition-colors"
              >
                <a.Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-medium">{a.label}</span>
              </Link>
            ))}
          </div>

          <div className="border-t border-border/40 pt-3 grid grid-cols-2 gap-2 text-center">
            {(["boss", "admin", "lead_specialist", "sales_rep"] as Role[]).map((r) => (
              <div key={r} className="rounded-xl bg-muted/30 py-2">
                <p className="text-base font-bold">{roleGroups[r]}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {r.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER STATS ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Leads",       value: stats.totalLeads.toLocaleString(),          Icon: Layers       },
          { label: "Leads This Week",   value: stats.leadsThisWeek.toLocaleString(),        Icon: TrendingUp   },
          { label: "Scraping Jobs Run", value: stats.totalJobsRun.toLocaleString(),         Icon: ScanSearch   },
          { label: "Duplicates Caught", value: stats.duplicatesPrevented.toLocaleString(),  Icon: CheckCircle2 },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-border px-5 py-4 flex items-center gap-4"
          >
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <k.Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums leading-none">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
