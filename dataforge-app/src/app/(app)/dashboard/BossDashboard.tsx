import { getDashboardStats } from "@/lib/dashboard/service";
import { getBossWidgets } from "@/lib/dashboard/boss.service";
import { getUsers } from "@/lib/users/service";
import { getTeamSummary, getLeaderboard, getTopPerformers } from "@/lib/marketing/team.service";
import { withDbRetry } from "@/lib/prisma";
import { IndustryBarChart } from "@/components/dashboard/IndustryBarChart";
import { QualityDonutChart } from "@/components/dashboard/QualityDonutChart";
import Link from "next/link";
import Image from "next/image";
import {
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
// TopPerformer type used via the Badge local type below

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({
  image, name, size,
}: { image: string | null; name: string; size: number }) {
  const sz = `h-${size} w-${size}`;
  const fs = size >= 16 ? "text-lg" : size >= 10 ? "text-sm" : "text-[10px]";
  return image ? (
    <Image
      src={image} alt={name}
      width={size * 4} height={size * 4}
      className={`${sz} rounded-full object-cover ring-2 ring-background/30 shrink-0`}
    />
  ) : (
    <div className={`${sz} rounded-full bg-background/10 flex items-center justify-center ${fs} font-black shrink-0`}>
      {initials(name)}
    </div>
  );
}

type Badge = { id: string; name: string; icon: string; color: string; imageUrl: string | null };

function BadgeChips({ badges, chipSize }: { badges: Badge[]; chipSize: "sm" | "md" }) {
  if (!badges || badges.length === 0) return null;
  const dim = chipSize === "md" ? "h-6 w-6 text-sm" : "h-4 w-4 text-[9px]";
  const imgDim = chipSize === "md" ? 14 : 10;
  return (
    <div className="flex flex-wrap gap-1 justify-center mt-1.5">
      {badges.map((b) => (
        <span
          key={b.id} title={b.name}
          className={`inline-flex items-center justify-center rounded-full ${dim}`}
          style={{ background: `${b.color}33`, border: `1px solid ${b.color}66` }}
        >
          {b.imageUrl ? (
            <Image src={b.imageUrl} alt={b.name} width={imgDim} height={imgDim} className="rounded-full object-cover" />
          ) : b.icon}
        </span>
      ))}
    </div>
  );
}

export async function BossDashboard() {
  const [stats, users, team, leaderboard, widgets, topPerformers] = await withDbRetry(() =>
    Promise.all([
      getDashboardStats(),
      getUsers(),
      getTeamSummary(),
      getLeaderboard("week"),
      getBossWidgets(),
      getTopPerformers(),
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Organisation-wide snapshot</p>
      </div>

      {/* ── TOP STATS STRIP ── */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: "Total Leads",       value: stats.totalLeads.toLocaleString(),          Icon: Layers       },
          { label: "Leads This Week",   value: stats.leadsThisWeek.toLocaleString(),        Icon: TrendingUp   },
          { label: "Scraping Jobs Run", value: stats.totalJobsRun.toLocaleString(),         Icon: ScanSearch   },
          { label: "Duplicates Caught", value: stats.duplicatesPrevented.toLocaleString(),  Icon: CheckCircle2 },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <k.Icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xl font-black tabular-nums leading-none">{k.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── BENTO HERO ── */}
      <div
        className="grid grid-cols-5 gap-2.5"
        style={{ gridTemplateRows: "minmax(120px,auto) minmax(120px,auto)" }}
      >
        {/* TOP PERFORMERS — col-span-2, row-span-2, dark anchor */}
        <div className="col-span-2 row-span-2 rounded-xl bg-foreground text-background flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-background/10">
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Top Performers</p>
            <p className="text-xs font-semibold opacity-20">Sales reps · by calls</p>
          </div>

          {/* All-Time — hero section */}
          <div className="flex flex-col items-center justify-center px-5 py-4 border-b border-background/10 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-3">All-Time</p>
            {topPerformers.allTime ? (
              <>
                <Avatar image={topPerformers.allTime.image} name={topPerformers.allTime.name} size={16} />
                <p className="text-sm font-bold mt-2 text-center">{topPerformers.allTime.name}</p>
                <span className="text-xs font-black bg-background/20 rounded-full px-2.5 py-0.5 mt-1.5">
                  {topPerformers.allTime.count} calls
                </span>
                <BadgeChips badges={topPerformers.allTime.badges} chipSize="md" />
              </>
            ) : (
              <p className="text-xs opacity-30 italic">No data yet</p>
            )}
          </div>

          {/* Today / Week / Month — 3 columns */}
          <div className="grid grid-cols-3 divide-x divide-background/10">
            {([
              { label: "Today", data: topPerformers.today  },
              { label: "Week",  data: topPerformers.week   },
              { label: "Month", data: topPerformers.month  },
            ] as const).map(({ label, data }) => (
              <div key={label} className="flex flex-col items-center px-2 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">{label}</p>
                {data ? (
                  <>
                    <Avatar image={data.image} name={data.name} size={8} />
                    <p className="text-[10px] font-semibold mt-1.5 text-center leading-tight line-clamp-2 w-full px-1">
                      {data.name}
                    </p>
                    <span className="text-[9px] font-bold opacity-50 mt-0.5">{data.count}</span>
                    <BadgeChips badges={data.badges} chipSize="sm" />
                  </>
                ) : (
                  <p className="text-[10px] opacity-30 mt-1">—</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Calls Today */}
        <div className="rounded-xl bg-card border border-border p-4 flex flex-col justify-between">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Calls Today</p>
          <div>
            <p className="text-3xl font-black tabular-nums leading-none">{team.callsToday}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">logged so far</p>
          </div>
        </div>

        {/* Active Leads */}
        <div className="rounded-xl bg-card border border-border p-4 flex flex-col justify-between">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Active Leads</p>
          <div>
            <p className="text-3xl font-black tabular-nums leading-none">{stats.activeLeads.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">in the pipeline</p>
          </div>
        </div>

        {/* TEAM PULSE — col 5, row-span-2 */}
        <div className="row-span-2 rounded-xl bg-card border border-border p-4 flex flex-col justify-between">
          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Team Pulse</p>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-black tabular-nums leading-none">{pulseScore}</span>
              <span className="text-base font-semibold text-muted-foreground mb-0.5">/10</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">quality + call activity</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {metricTiles.map((tile) => (
              <div key={tile.label} className="rounded-lg bg-muted/40 px-2 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">{tile.label}</p>
                <p className="text-sm font-black tabular-nums leading-tight mt-1">
                  {typeof tile.value === "number" ? tile.value.toLocaleString() : tile.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Size */}
        <div className="rounded-xl bg-card border border-border p-4 flex flex-col justify-between">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Team Size</p>
          <div>
            <p className="text-3xl font-black tabular-nums leading-none">{users.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">total users</p>
          </div>
        </div>

        {/* Avg Quality */}
        <div className="rounded-xl bg-violet-600 text-white p-4 flex flex-col justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">Avg Quality</p>
          <div>
            <p className="text-3xl font-black tabular-nums leading-none">{stats.avgQualityScore}%</p>
            <p className="text-[11px] opacity-60 mt-0.5">data completeness</p>
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: Challenges + Top Agents ── */}
      <div className="grid grid-cols-2 gap-2.5">

        {/* Active Challenges */}
        <div className="rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Challenges</p>
              <p className="text-[11px] text-muted-foreground">Running now</p>
            </div>
            <Link href="/marketing/manage/tasks" className="text-xs font-medium hover:underline">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {widgets.activeTasks.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                No active challenges.{" "}
                <Link href="/marketing/manage/tasks" className="underline">Create one</Link>
              </p>
            )}
            {widgets.activeTasks.map((task) => {
              const total     = task._count.progress;
              const completed = task.progress.length;
              const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
              const daysLeft  = Math.ceil((new Date(task.endDate).getTime() - Date.now()) / 86_400_000);
              return (
                <div key={task.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-tight">{task.title}</p>
                    <span className="text-[10px] shrink-0 text-muted-foreground">{daysLeft}d left</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{completed}/{total}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Target className="h-2.5 w-2.5" />{task.targetCalls} calls</span>
                    <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" />{task.pointReward} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Agents */}
        <div className="rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div>
              <p className="font-semibold text-sm">Top Agents</p>
              <p className="text-[11px] text-muted-foreground">This week</p>
            </div>
            <Link href="/marketing" className="text-xs font-medium hover:underline">All</Link>
          </div>
          <div className="divide-y divide-border/40">
            {top3.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">No data yet.</p>
            )}
            {top3.map((agent, i) => {
              const RANK = ["#1", "#2", "#3"];
              const maxCalls = top3[0]?.callCount || 1;
              const pct = Math.round((agent.callCount / maxCalls) * 100);
              return (
                <div key={agent.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black w-4 text-center shrink-0 text-muted-foreground">{RANK[i]}</span>
                    <p className="text-xs font-semibold truncate flex-1">{agent.name}</p>
                    <span className="text-xs font-bold tabular-nums shrink-0">{agent.callCount}</span>
                  </div>
                  <div className="ml-6 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Charts + Quick Actions ── */}
      <div className="grid grid-cols-3 gap-2.5">

        {/* Leads by Industry */}
        <div className="rounded-xl bg-card border border-border p-4 overflow-auto">
          <p className="font-semibold text-sm mb-0.5">By Industry</p>
          <p className="text-[11px] text-muted-foreground mb-2">Top 10 categories</p>
          <IndustryBarChart data={stats.leadsByIndustry} />
        </div>

        {/* Quality Distribution */}
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="font-semibold text-sm mb-0.5">Quality Spread</p>
          <p className="text-[11px] text-muted-foreground mb-2">Data completeness</p>
          <QualityDonutChart data={stats.qualityDistribution} />
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div>
            <p className="font-semibold text-sm">Quick Actions</p>
            <p className="text-[11px] text-muted-foreground">Shortcuts</p>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
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
                className="flex items-center gap-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 px-2.5 py-2 transition-colors"
              >
                <a.Icon className="h-3 w-3 shrink-0" />
                <span className="text-[11px] font-medium">{a.label}</span>
              </Link>
            ))}
          </div>

          <div className="border-t border-border/40 pt-2.5 grid grid-cols-2 gap-1.5 text-center">
            {(["boss", "admin", "lead_specialist", "sales_rep"] as Role[]).map((r) => (
              <div key={r} className="rounded-lg bg-muted/30 py-1.5">
                <p className="text-sm font-bold">{roleGroups[r]}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{r.replace("_", " ")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
