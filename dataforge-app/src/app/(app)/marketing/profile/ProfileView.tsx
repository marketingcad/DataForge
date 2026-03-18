"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowLeft, Phone, Trophy, TrendingUp, Star, Calendar, Target, Zap } from "lucide-react";
import Link from "next/link";
import type { getAgentProfile } from "@/lib/marketing/agent.service";

type ProfileData = Awaited<ReturnType<typeof getAgentProfile>>;

export function ProfileView({ data, isOwn }: { data: ProfileData; isOwn: boolean }) {
  const { user, stats, allBadges, completedTasks, callHistory } = data;
  const earned = allBadges.filter((b) => b.earned);
  const locked = allBadges.filter((b) => !b.earned);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Marketing
      </Link>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 p-6">
        <div className="absolute top-0 right-0 h-40 w-40 opacity-5">
          <Trophy className="h-full w-full text-primary" />
        </div>
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border-2 border-primary/20">
              {(user.name ?? user.email)[0].toUpperCase()}
            </div>
            {earned.length > 0 && (
              <div className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center text-xs">
                {earned[0].icon}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{user.name ?? user.email}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <Star className="h-3 w-3" />
                {user.points.toLocaleString()} points
              </span>
              <span className="text-xs text-muted-foreground">
                Member since {user.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Points large display */}
          <div className="hidden sm:block text-right shrink-0">
            <p className="text-3xl font-bold text-primary">{stats.totalCalls.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">total calls</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Calls",     value: stats.totalCalls,    icon: Phone,      color: "text-blue-600 bg-blue-500/10" },
          { label: "This Month",      value: stats.callsThisMonth, icon: Calendar,   color: "text-violet-600 bg-violet-500/10" },
          { label: "This Week",       value: stats.callsThisWeek,  icon: TrendingUp, color: "text-emerald-600 bg-emerald-500/10" },
          { label: "Best Day",        value: stats.bestDay,        icon: Zap,        color: "text-amber-600 bg-amber-500/10" },
          { label: "Avg / Day",       value: stats.avgPerDay,      icon: Target,     color: "text-rose-600 bg-rose-500/10" },
          { label: "Avg / Month",     value: stats.avgPerMonth,    icon: Star,       color: "text-indigo-600 bg-indigo-500/10" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-3 text-center space-y-1.5">
            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-lg font-bold leading-none">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Call history chart */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Call Activity — Last 30 Days</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={callHistory} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              interval={4}
            />
            <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: "hsl(var(--muted))" }}
            />
            <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Badges */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Badges &amp; Achievements</h2>

        {earned.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Earned ({earned.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {earned.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                  style={{ borderColor: `${b.color}30` }}
                >
                  <span className="text-2xl shrink-0">{b.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {locked.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Locked ({locked.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {locked.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3 opacity-50 grayscale">
                  <span className="text-2xl shrink-0">{b.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Completed Challenges</h2>
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {completedTasks.map((tp) => (
              <div key={tp.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg shrink-0">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tp.task.title}</p>
                  {tp.completedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      {tp.completedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
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
