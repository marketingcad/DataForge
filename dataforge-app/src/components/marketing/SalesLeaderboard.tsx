"use client";

import { Trophy } from "lucide-react";
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

function Avatar({
  name,
  size = "md",
  gold = false,
}: {
  name: string | null;
  size?: "sm" | "md" | "lg";
  gold?: boolean;
}) {
  const letter = (name ?? "?").charAt(0).toUpperCase();
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-xl" };
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-black shrink-0 select-none transition-shadow ${
        gold
          ? "bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-[0_0_18px_rgba(251,191,36,0.55)] ring-2 ring-amber-400"
          : "bg-muted text-foreground ring-2 ring-border/60"
      }`}
    >
      {letter}
    </div>
  );
}

const PERIOD_LABELS: Record<string, string> = {
  yesterday: "Yesterday",
  week: "This Week",
  month: "This Month",
};

const medals = ["🥇", "🥈", "🥉"];
const rankTextColors = ["text-amber-500", "text-slate-400", "text-orange-400"];
const barColors = [
  "bg-gradient-to-r from-amber-400 to-orange-400",
  "bg-slate-400",
  "bg-orange-400",
  "bg-violet-400",
];

const podiumConfig = [
  {
    idx: 1, // silver — left
    barH: "h-20",
    cardBg: "bg-muted/40 border-border/60",
  },
  {
    idx: 0, // gold — center
    barH: "h-32",
    cardBg:
      "bg-gradient-to-b from-amber-50/80 to-amber-50/20 dark:from-amber-950/30 dark:to-transparent border-amber-300/50 dark:border-amber-700/40",
  },
  {
    idx: 2, // bronze — right
    barH: "h-16",
    cardBg: "bg-orange-50/40 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30",
  },
];

export function SalesLeaderboard({ leaderboard, period = "week" }: Props) {
  if (leaderboard.length === 0) return null;

  const maxCalls = leaderboard[0]?.callCount || 1;

  const first  = leaderboard[0];
  const second = leaderboard[1] ?? null;
  const third  = leaderboard[2] ?? null;

  // Podium display order: 2nd (left), 1st (center), 3rd (right)
  const podiumEntries = [second, first, third];

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gradient-to-r from-amber-500/10 via-card to-card">
        <Trophy className="h-4 w-4 text-amber-500" />
        <p className="font-bold text-sm tracking-tight">Sales Leaderboard</p>
        <span className="ml-auto text-xs text-muted-foreground font-medium">
          {PERIOD_LABELS[period]} · by calls
        </span>
      </div>

      {/* Podium */}
      <div className="px-6 pt-6 pb-3 bg-gradient-to-b from-muted/20 to-transparent">
        <div className="flex items-end justify-center gap-3 w-full max-w-sm mx-auto">
          {podiumEntries.map((entry, podiumPos) => {
            const { idx, barH, cardBg } = podiumConfig[podiumPos];
            const isWinner = idx === 0;
            const rank = idx + 1;

            return (
              <div key={rank} className="flex-1 flex flex-col items-center gap-1">
                {/* Crown spacer / crown */}
                {isWinner ? (
                  <span className="text-2xl leading-none">👑</span>
                ) : (
                  <div className="h-8" />
                )}

                {/* Avatar */}
                {entry ? (
                  <>
                    <Avatar name={entry.name} size={isWinner ? "lg" : "md"} gold={isWinner} />
                    <p className="text-[11px] font-bold truncate max-w-[72px] text-center leading-tight mt-0.5">
                      {entry.name?.split(" ")[0] ?? "—"}
                    </p>
                  </>
                ) : (
                  <div className={`${isWinner ? "h-16 w-16" : "h-11 w-11"}`} />
                )}

                {/* Podium block */}
                <div
                  className={`w-full ${barH} ${cardBg} rounded-t-xl border flex flex-col items-center justify-end pb-2 mt-1`}
                >
                  <span className="text-lg leading-none">{medals[idx]}</span>
                  {entry && (
                    <p className="text-[10px] text-muted-foreground font-semibold tabular-nums mt-0.5">
                      {entry.callCount} calls
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Winner callout strip */}
        {first && (
          <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-400/20 px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                🏆 {first.name?.split(" ")[0]} is leading {PERIOD_LABELS[period].toLowerCase()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {first.callCount} calls · {first.points.toLocaleString()} pts
              </p>
            </div>
            <div className="flex gap-1">
              {first.topBadges.slice(0, 3).map((b) => (
                <span key={b.id} title={b.name} className="text-lg">{b.icon}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full ranked list */}
      <div className="border-t divide-y">
        {leaderboard.map((entry, i) => {
          const pct = maxCalls > 0 ? Math.round((entry.callCount / maxCalls) * 100) : 0;
          const behind = first.callCount - entry.callCount;
          const isTop3 = i < 3;
          const barColor = barColors[Math.min(i, barColors.length - 1)];

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors ${
                i === 0 ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
              }`}
            >
              {/* Rank */}
              <div
                className={`w-7 text-center shrink-0 font-black text-sm ${
                  isTop3 ? rankTextColors[i] : "text-muted-foreground font-medium"
                }`}
              >
                {isTop3 ? medals[i] : `#${i + 1}`}
              </div>

              {/* Avatar */}
              <Avatar name={entry.name} size="sm" gold={i === 0} />

              {/* Name + progress bar */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{entry.name ?? "—"}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold tabular-nums">{entry.callCount}</span>
                    <span className="text-[10px] text-muted-foreground">calls</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Status label + badges */}
                <div className="flex items-center gap-1.5">
                  {behind === 0 ? (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">🔥 Leading</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">−{behind} from lead</span>
                  )}
                  {entry.topBadges.slice(0, 3).map((b) => (
                    <span key={b.id} title={b.name} className="text-xs">{b.icon}</span>
                  ))}
                </div>
              </div>

              {/* Points */}
              <div className="shrink-0 text-right hidden sm:block">
                <p className="text-xs font-bold text-violet-600">{entry.points.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>

              <Link
                href={`/marketing/profile/${entry.id}`}
                className="text-xs text-muted-foreground hover:text-primary ml-1 shrink-0"
              >
                →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
