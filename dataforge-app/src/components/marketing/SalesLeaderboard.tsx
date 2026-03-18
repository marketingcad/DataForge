"use client";

import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

function Avatar({ name, size = "md" }: { name: string | null; size?: "sm" | "md" | "lg" }) {
  const letter = (name ?? "?").charAt(0).toUpperCase();
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-14 w-14 text-base" };
  return (
    <div className={`${sizes[size]} rounded-full bg-muted flex items-center justify-center font-bold shrink-0 border-2 border-background shadow-sm`}>
      {letter}
    </div>
  );
}

const TREND_ICONS = [
  <TrendingUp   key="up"   className="h-3 w-3 text-emerald-500" />,
  <TrendingDown key="down" className="h-3 w-3 text-rose-500"    />,
  <Minus        key="flat" className="h-3 w-3 text-muted-foreground" />,
];

// deterministic mock trend per rank
function trendIcon(rank: number) {
  if (rank === 0) return TREND_ICONS[0];
  if (rank === 1) return TREND_ICONS[1];
  return TREND_ICONS[2];
}

const PERIOD_LABELS: Record<string, string> = {
  yesterday: "Yesterday",
  week:      "This Week",
  month:     "This Month",
};

export function SalesLeaderboard({ leaderboard, period = "week" }: Props) {
  if (leaderboard.length === 0) return null;

  const first  = leaderboard[0];
  const second = leaderboard[1] ?? null;
  const third  = leaderboard[2] ?? null;
  const rest   = leaderboard.slice(3);

  // Podium config: order is [2nd, 1st, 3rd] left-to-right
  const podium = [
    { entry: second, rank: 2, label: "2nd", barH: "h-24", bg: "bg-muted/60",        ring: "ring-muted-foreground/30",  avatarSize: "md" as const },
    { entry: first,  rank: 1, label: "1st", barH: "h-36", bg: "bg-amber-100/80 dark:bg-amber-950/40", ring: "ring-amber-400/60", avatarSize: "lg" as const },
    { entry: third,  rank: 3, label: "3rd", barH: "h-16", bg: "bg-orange-100/60 dark:bg-orange-950/30", ring: "ring-orange-400/40", avatarSize: "md" as const },
  ];

  const medalColors = ["text-amber-500", "text-slate-400", "text-orange-500"];
  const medals      = ["🥇", "🥈", "🥉"];

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/20">
        <Trophy className="h-4 w-4 text-amber-500" />
        <p className="font-semibold text-sm">Sales Leaderboard</p>
        <span className="ml-auto text-xs text-muted-foreground">{PERIOD_LABELS[period]} · by calls</span>
      </div>

      {/* Podium */}
      <div className="px-6 pt-8 pb-6 flex flex-col items-center gap-6">
        {/* Avatar row — floats above the bars */}
        <div className="flex items-end justify-center gap-4 w-full max-w-lg">
          {podium.map(({ entry, rank, avatarSize, ring }) => (
            <div key={rank} className="flex-1 flex flex-col items-center gap-1.5">
              {entry ? (
                <>
                  <div className={`rounded-full ring-2 ${ring}`}>
                    <Avatar name={entry.name} size={avatarSize} />
                  </div>
                  <p className="text-xs font-semibold truncate max-w-[80px] text-center leading-tight">
                    {entry.name ?? "—"}
                  </p>
                </>
              ) : (
                <div className="h-14 w-14" />
              )}
            </div>
          ))}
        </div>

        {/* Bar row */}
        <div className="flex items-end justify-center gap-4 w-full max-w-lg">
          {podium.map(({ entry, rank, label, barH, bg }) => (
            <div key={rank} className="flex-1 flex flex-col items-center">
              <div className={`w-full ${barH} ${bg} rounded-t-xl flex flex-col items-center justify-end pb-3 border border-b-0`}>
                <p className="text-xs font-bold text-foreground/80">{label}</p>
                {entry && (
                  <p className="text-[11px] text-muted-foreground">
                    {entry.callCount} calls · {entry.points.toLocaleString()} pts
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Winner callout */}
        {first && (
          <div className="text-center">
            <p className="text-sm font-semibold">🏆 We have a winner!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {first.name} leads this week with {first.callCount} calls and {first.points.toLocaleString()} pts
            </p>
          </div>
        )}
      </div>

      {/* Full ranked list */}
      <div className="border-t">
        {/* Top 3 in list */}
        {[first, second, third].map((entry, i) => {
          if (!entry) return null;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-5 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors ${i === 0 ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
            >
              {/* Trend */}
              <div className="w-5 flex justify-center">{trendIcon(i)}</div>

              {/* Rank */}
              <div className={`w-8 text-sm font-bold ${medalColors[i]}`}>{medals[i]}</div>

              {/* Avatar */}
              <Avatar name={entry.name} size="sm" />

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.name}</p>
                <div className="flex gap-0.5 mt-0.5">
                  {entry.topBadges.slice(0, 3).map((b) => (
                    <span key={b.id} title={b.name} className="text-xs">{b.icon}</span>
                  ))}
                </div>
              </div>

              {/* Calls */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{entry.callCount}</p>
                <p className="text-[10px] text-muted-foreground">calls</p>
              </div>

              {/* Points */}
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-semibold text-violet-600">{entry.points.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>

              <Link href={`/marketing/profile/${entry.id}`} className="text-xs text-muted-foreground hover:text-primary ml-1">→</Link>
            </div>
          );
        })}

        {/* Remaining entries */}
        {rest.map((entry, i) => {
          const rank = i + 4;
          return (
            <div key={entry.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
              <div className="w-5 flex justify-center">
                <Minus className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="w-8 text-sm font-medium text-muted-foreground">#{rank}</div>
              <Avatar name={entry.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.name}</p>
                <div className="flex gap-0.5 mt-0.5">
                  {entry.topBadges.slice(0, 3).map((b) => (
                    <span key={b.id} title={b.name} className="text-xs">{b.icon}</span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{entry.callCount}</p>
                <p className="text-[10px] text-muted-foreground">calls</p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-semibold text-violet-600">{entry.points.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>
              <Link href={`/marketing/profile/${entry.id}`} className="text-xs text-muted-foreground hover:text-primary ml-1">→</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
