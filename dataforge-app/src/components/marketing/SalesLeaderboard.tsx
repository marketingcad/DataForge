"use client";

import Link from "next/link";

export interface LeaderboardEntry {
  id: string;
  name: string | null;
  callCount: number;
  points: number;
  totalDuration: number;
  topBadges: { id: string; name: string; icon: string }[];
}

interface Props {
  leaderboard: LeaderboardEntry[];
  period?: string;
}

const PERIOD_LABELS: Record<string, string> = {
  yesterday: "Yesterday",
  week:      "This Week",
  month:     "This Month",
};

// Top-3 card visual themes
const TOP3_THEMES = [
  {
    // 1st — holographic gold/lime/purple
    cardBg:   "bg-gradient-to-br from-yellow-100 via-lime-100 to-purple-200 dark:from-yellow-900/30 dark:via-lime-900/20 dark:to-purple-900/30",
    border:   "border-yellow-300/60 dark:border-yellow-700/40",
    shadow:   "shadow-[0_8px_32px_rgba(251,191,36,0.22)]",
    rankText: "text-yellow-900/[0.09] dark:text-yellow-300/[0.09]",
    badgeText:"text-amber-700 dark:text-amber-400",
    avatar:   "from-amber-400 to-orange-500",
    btn:      "bg-white/70 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20 border-black/10 dark:border-white/10",
  },
  {
    // 2nd — teal/cyan
    cardBg:   "bg-gradient-to-br from-cyan-100 to-teal-200 dark:from-cyan-900/30 dark:to-teal-900/20",
    border:   "border-cyan-300/60 dark:border-cyan-700/40",
    shadow:   "shadow-[0_8px_24px_rgba(20,184,166,0.18)]",
    rankText: "text-cyan-900/[0.09] dark:text-cyan-300/[0.09]",
    badgeText:"text-teal-700 dark:text-teal-400",
    avatar:   "from-cyan-400 to-teal-500",
    btn:      "bg-white/70 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20 border-black/10 dark:border-white/10",
  },
  {
    // 3rd — warm peach/amber
    cardBg:   "bg-gradient-to-br from-orange-100 to-amber-200 dark:from-orange-900/30 dark:to-amber-900/20",
    border:   "border-orange-300/60 dark:border-orange-700/40",
    shadow:   "shadow-[0_8px_24px_rgba(249,115,22,0.18)]",
    rankText: "text-orange-900/[0.09] dark:text-orange-300/[0.09]",
    badgeText:"text-orange-700 dark:text-orange-400",
    avatar:   "from-orange-400 to-rose-500",
    btn:      "bg-white/70 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20 border-black/10 dark:border-white/10",
  },
];

const RANK_SUFFIX = ["st", "nd", "rd"];
const MEDALS      = ["🥇", "🥈", "🥉"];
const ROW_ACCENTS = [
  "border-l-2 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10",
  "border-l-2 border-l-slate-400",
  "border-l-2 border-l-orange-400",
  "",
];
const ROW_AVATAR_BG = [
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-teal-500",
  "from-orange-400 to-rose-500",
];
const BAR_COLORS = [
  "bg-gradient-to-r from-amber-400 to-orange-400",
  "bg-cyan-400",
  "bg-orange-400",
  "bg-violet-400",
];

function fmtDur(totalSecs: number, callCount: number): string {
  if (callCount <= 0) return "—";
  const avg = Math.round(totalSecs / callCount);
  const m   = Math.floor(avg / 60);
  const s   = avg % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function SalesLeaderboard({ leaderboard, period = "week" }: Props) {
  if (leaderboard.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No leaderboard data for this period.</p>
      </div>
    );
  }

  const maxCalls = leaderboard[0]?.callCount || 1;
  const top3     = leaderboard.slice(0, 3);

  // Achievement strip — computed from full list
  const byPoints   = [...leaderboard].sort((a, b) => b.points      - a.points)[0];
  const byDuration = [...leaderboard].sort((a, b) => {
    const aA = a.callCount > 0 ? a.totalDuration / a.callCount : 0;
    const bA = b.callCount > 0 ? b.totalDuration / b.callCount : 0;
    return bA - aA;
  })[0];
  const byBadges   = [...leaderboard].sort((a, b) => b.topBadges.length - a.topBadges.length)[0];

  const achievements = [
    { icon: "🔥", label: "Most Calls",    entry: leaderboard[0], value: leaderboard[0].callCount.toString() },
    { icon: "⭐", label: "Top Points",    entry: byPoints,        value: byPoints.points.toLocaleString() },
    { icon: "⏱️", label: "Avg Duration", entry: byDuration,      value: fmtDur(byDuration.totalDuration, byDuration.callCount) },
    { icon: "🏅", label: "Most Badges",  entry: byBadges,        value: `${byBadges.topBadges.length}` },
  ];

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">

      {/* ── Champions header + top-3 cards ── */}
      <div className="relative px-5 pt-8 pb-6 border-b bg-gradient-to-b from-muted/30 to-transparent overflow-hidden">

        {/* Watermark */}
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[72px] lg:text-[96px] font-black text-foreground/[0.035] select-none pointer-events-none leading-none tracking-tight">
          Champions
        </p>

        {/* Period label */}
        <p className="relative text-center text-xs font-semibold text-muted-foreground mb-5 uppercase tracking-widest">
          {PERIOD_LABELS[period]}
        </p>

        {/* 3 cards */}
        <div className="relative grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          {top3.map((entry, i) => {
            const t = TOP3_THEMES[i];
            return (
              <div
                key={entry.id}
                className={`relative rounded-xl border p-4 flex flex-col items-center text-center gap-2.5 overflow-hidden ${t.cardBg} ${t.border} ${t.shadow}`}
              >
                {/* Rank watermark */}
                <span className={`absolute top-1.5 right-2.5 text-[52px] font-black leading-none select-none pointer-events-none ${t.rankText}`}>
                  {i + 1}<sup className="text-[26px]">{RANK_SUFFIX[i]}</sup>
                </span>

                {/* Avatar */}
                {i === 0 ? (
                  <div
                    className={`h-14 w-14 bg-gradient-to-br ${t.avatar} flex items-center justify-center font-black text-white text-xl shrink-0 shadow-lg z-10`}
                    style={{ clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }}
                  >
                    {(entry.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${t.avatar} flex items-center justify-center font-black text-white text-lg shrink-0 shadow-md z-10`}>
                    {(entry.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name + role */}
                <div className="z-10 space-y-0.5 w-full">
                  <p className="font-extrabold text-sm leading-tight truncate">{entry.name ?? "—"}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${t.badgeText}`}>Sales Rep</p>
                </div>

                {/* 3 stats */}
                <div className="z-10 w-full grid grid-cols-3 text-center gap-1">
                  <div>
                    <p className="text-base lg:text-lg font-black tabular-nums leading-tight">{entry.callCount}</p>
                    <p className="text-[9px] text-muted-foreground font-medium">Calls</p>
                  </div>
                  <div>
                    <p className="text-base lg:text-lg font-black tabular-nums leading-tight">{entry.points.toLocaleString()}</p>
                    <p className="text-[9px] text-muted-foreground font-medium">Points</p>
                  </div>
                  <div>
                    <p className="text-base lg:text-lg font-black tabular-nums leading-tight">{fmtDur(entry.totalDuration, entry.callCount)}</p>
                    <p className="text-[9px] text-muted-foreground font-medium">Avg</p>
                  </div>
                </div>

                {/* Profile button */}
                <Link
                  href={`/marketing/profile/${entry.id}`}
                  className={`z-10 w-full text-center text-xs font-semibold py-1.5 rounded-lg border transition-all ${t.btn}`}
                >
                  Profile
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Achievement strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 border-b">
        {achievements.map((a) => (
          <div key={a.label} className="px-4 py-3 flex items-center gap-3 bg-card hover:bg-muted/20 transition-colors">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
              {a.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">{a.label}</p>
              <p className="text-xs font-bold truncate leading-tight">{a.entry.name?.split(" ")[0] ?? "—"}</p>
            </div>
            <p className="text-base font-black tabular-nums shrink-0">{a.value}</p>
          </div>
        ))}
      </div>

      {/* ── Full ranked table ── */}
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/20 border-b">
        <div className="w-8 text-center shrink-0">#</div>
        <div className="flex-1">Agent</div>
        <div className="hidden sm:block w-16 text-center">Badges</div>
        <div className="w-12 text-right">Calls</div>
        <div className="hidden md:block w-16 text-right">Avg Call</div>
        <div className="hidden sm:block w-14 text-right">Points</div>
        <div className="w-6 shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y">
        {leaderboard.map((entry, i) => {
          const pct     = Math.round((entry.callCount / maxCalls) * 100);
          const isTop3  = i < 3;
          const accent  = ROW_ACCENTS[Math.min(i, ROW_ACCENTS.length - 1)];
          const avatarBg = i < ROW_AVATAR_BG.length ? ROW_AVATAR_BG[i] : null;
          const barColor = BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)];

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors ${accent}`}
            >
              {/* Rank */}
              <div className={`w-8 text-center shrink-0 font-black text-sm leading-none ${
                i === 0 ? "text-amber-500" :
                i === 1 ? "text-slate-400" :
                i === 2 ? "text-orange-400" :
                "text-muted-foreground font-semibold text-xs"
              }`}>
                {isTop3 ? MEDALS[i] : i + 1}
              </div>

              {/* Agent */}
              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${
                  avatarBg ? `bg-gradient-to-br ${avatarBg}` : "bg-muted text-foreground"
                }`}>
                  {(entry.name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{entry.name ?? "—"}</p>
                  <div className="h-1 w-full max-w-[72px] rounded-full bg-muted overflow-hidden mt-0.5">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="hidden sm:flex w-16 items-center justify-center gap-0.5">
                {entry.topBadges.length > 0
                  ? entry.topBadges.slice(0, 3).map((b) => (
                      <span key={b.id} title={b.name} className="text-base">{b.icon}</span>
                    ))
                  : <span className="text-[10px] text-muted-foreground">—</span>
                }
              </div>

              {/* Calls */}
              <div className="w-12 text-right">
                <p className="text-sm font-bold tabular-nums">{entry.callCount}</p>
              </div>

              {/* Avg call */}
              <div className="hidden md:block w-16 text-right">
                <p className="text-xs font-medium text-muted-foreground tabular-nums">
                  {fmtDur(entry.totalDuration, entry.callCount)}
                </p>
              </div>

              {/* Points */}
              <div className="hidden sm:block w-14 text-right">
                <p className="text-xs font-bold text-violet-600 tabular-nums">{entry.points.toLocaleString()}</p>
              </div>

              {/* Link */}
              <div className="w-6 text-center shrink-0">
                <Link href={`/marketing/profile/${entry.id}`} className="text-xs text-muted-foreground hover:text-primary">→</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
