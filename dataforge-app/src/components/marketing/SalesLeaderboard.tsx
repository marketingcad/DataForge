"use client";

import Link from "next/link";
import { Flame, Trophy, CalendarCheck, Star } from "lucide-react";
import { METRIC_LABELS, type Metric } from "./MetricToggle";

export interface LeaderboardEntry {
  id: string;
  name: string | null;
  callCount: number;
  points: number;
  totalDuration: number;
  avgCallTime: number;
  topBadges: { id: string; name: string; icon: string }[];
  appointmentsSet: number;
  dealsWon: number;
  leadsBooked: number;
  commissionsEarned: number;
  badgesEarned: number;
}

interface Props {
  leaderboard: LeaderboardEntry[];
  period?: string;
  metric?: Metric;
}

function formatMetricValue(entry: LeaderboardEntry, metric: Metric): string {
  switch (metric) {
    case "calls":       return entry.callCount.toLocaleString();
    case "appts_set":   return entry.appointmentsSet.toLocaleString();
    case "commissions": return `₱${entry.commissionsEarned.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case "badges":      return entry.badgesEarned.toLocaleString();
    default:            return "—";
  }
}


const LIST_ACCENT = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function SalesLeaderboard({ leaderboard, metric = "appts_set" }: Props) {
  if (leaderboard.length === 0) {
    return (
      <div className="rounded-3xl border bg-card overflow-hidden">
        <div className="p-12 text-center space-y-2">
          <p className="text-3xl">🎮</p>
          <p className="text-sm font-semibold">No data for this period.</p>
          <p className="text-xs text-muted-foreground">Sync GHL or log calls to populate the leaderboard.</p>
        </div>
      </div>
    );
  }

  // Reorder: index 0=1st, 1=2nd, 2=3rd → display as [2nd, 1st, 3rd]
  const first  = leaderboard[0];
  const second = leaderboard[1];
  const third  = leaderboard[2];
  const rest   = leaderboard.slice(3);
  const metricLabel = METRIC_LABELS[metric] ?? "—";

  // Podium slot config: [left=2nd, center=1st, right=3rd]
  type PodiumSlot = {
    entry: LeaderboardEntry | undefined;
    rank: number;
    cardH: string;
    cardBg: string;
    avatarSize: string;
    rankSize: string;
    elevated: boolean;
  };
  const podiumSlots: PodiumSlot[] = [
    {
      entry:      second,
      rank:       2,
      cardH:      "h-38",
      cardBg:     "bg-blue-700 dark:bg-blue-800",
      avatarSize: "h-30 w-30",
      rankSize:   "text-5xl",
      elevated:   false,
    },
    {
      entry:      first,
      rank:       1,
      cardH:      "h-60",
      cardBg:     "bg-rose-500 dark:bg-rose-600",
      avatarSize: "h-30 w-30",
      rankSize:   "text-6xl",
      elevated:   true,
    },
    {
      entry:      third,
      rank:       3,
      cardH:      "h-38",
      cardBg:     "bg-blue-700 dark:bg-blue-800",
      avatarSize: "h-30 w-30",
      rankSize:   "text-4xl",
      elevated:   false,
    },
  ];

  return (
    <div className="rounded-3xl border bg-card overflow-hidden">

      {/* ── Podium ── */}
      <div className="px-6 pt-8 pb-2">
        <div className="flex items-end justify-center gap-3 max-w-xl mx-auto">
          {podiumSlots.map((slot) => {
            if (!slot.entry) return <div key={slot.rank} className="flex-1" />;
            return (
              <Link key={slot.rank} href={`/marketing/profile/${slot.entry.id}`} className="flex-1 flex flex-col items-center group">
                {/* Score pill above avatar */}
                <div className="flex flex-col items-center gap-1 mb-2">
                  <span className="text-[30px] font-black tabular-nums">{formatMetricValue(slot.entry, metric)}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{metricLabel}</span>
                </div>

                {/* Avatar circle — floats above the card */}
                <div className={`${slot.avatarSize} rounded-full border-4 border-card bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center font-black text-white shrink-0 shadow-lg z-10 -mb-8`}
                  style={{ fontSize: slot.rank === 1 ? "1.25rem" : "1rem" }}
                >
                  {initials(slot.entry.name)}
                </div>

                {/* Podium card */}
                <div className={`w-full ${slot.cardH} ${slot.cardBg} rounded-2xl flex flex-col items-center justify-end pb-3 relative overflow-hidden shadow-lg`}>
                  {/* Large rank watermark */}
                  <span className={`absolute inset-0 flex items-center justify-center ${slot.rankSize} font-black text-white select-none pointer-events-none leading-none`}>
                    {slot.rank}
                  </span>
                  {/* Name */}
                  <p className="relative z-10 text-white font-bold text-[25px] text-center px-2 leading-tight truncate w-full text-center">
                    {slot.entry.name?.split(" ")[0] ?? "—"}
                  </p>
                </div>
            </Link>
          );
          })}
        </div>
      </div>

      {/* ── Rest of leaderboard list ── */}
      <div className="mt-4 divide-y divide-border/40">

        {/* Show ranks 4+ */}
        {rest.map((entry, i) => {
          const rank   = i + 4;
          const accent = LIST_ACCENT[i % LIST_ACCENT.length];
          return (
            <Link
              key={entry.id}
              href={`/marketing/profile/${entry.id}`}
              className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/30 transition-colors"
            >
              {/* Rank */}
              <span className="text-sm font-black text-muted-foreground w-6 shrink-0 tabular-nums">
                {String(rank).padStart(2, "0")}
              </span>

              {/* Avatar */}
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center font-black text-white text-sm shrink-0 shadow-sm">
                {initials(entry.name)}
              </div>

              {/* Name + score */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{entry.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatMetricValue(entry, metric)} {metricLabel.toLowerCase()}</p>
              </div>

              {/* Badges */}
              {entry.topBadges.length > 0 && (
                <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                  {entry.topBadges.slice(0, 2).map((b) => (
                    <span key={b.id} title={b.name} className="text-base">{b.icon}</span>
                  ))}
                </div>
              )}

              {/* Accent dot */}
              <div className={`h-6 w-6 rounded-full ${accent} flex items-center justify-center shrink-0 shadow-sm`}>
                <span className="text-white text-[10px] font-black">↑</span>
              </div>
            </Link>
          );
        })}

        {/* Also show ranks 1-3 in list form below the podium */}
        {leaderboard.length > 0 && rest.length === 0 && leaderboard.length <= 3 && (
          <div className="px-6 py-4 text-center">
            <p className="text-xs text-muted-foreground">Only {leaderboard.length} agent{leaderboard.length !== 1 ? "s" : ""} on the board this period.</p>
          </div>
        )}

      </div>

      {/* ── Stats footer strip ── */}
      {leaderboard.length >= 2 && (() => {
        const byWon   = [...leaderboard].sort((a, b) => (b.dealsWon ?? 0) - (a.dealsWon ?? 0))[0];
        const byAppts = [...leaderboard].sort((a, b) => (b.appointmentsSet ?? 0) - (a.appointmentsSet ?? 0))[0];
        const byPts   = [...leaderboard].sort((a, b) => b.points - a.points)[0];
        const stats   = [
          { icon: <Flame        className="h-4 w-4 text-orange-500" />, label: "Most Calls", name: leaderboard[0].name?.split(" ")[0] ?? "—", value: leaderboard[0].callCount },
          { icon: <Trophy       className="h-4 w-4 text-rose-500"   />, label: "Most Won",   name: byWon.name?.split(" ")[0] ?? "—",           value: byWon.dealsWon ?? 0     },
          { icon: <CalendarCheck className="h-4 w-4 text-sky-500"   />, label: "Appts",      name: byAppts.name?.split(" ")[0] ?? "—",          value: byAppts.appointmentsSet ?? 0 },
          { icon: <Star         className="h-4 w-4 text-amber-500"  />, label: "Top XP",     name: byPts.name?.split(" ")[0] ?? "—",            value: byPts.points            },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t divide-x divide-y lg:divide-y-0 bg-muted/10">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                <span className="shrink-0">{s.icon}</span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className="text-xs font-bold truncate">{s.name}</p>
                </div>
                <p className="text-base font-black tabular-nums ml-auto shrink-0">{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
