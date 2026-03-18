import { Crown, Phone, Clock, TrendingUp, Zap, Award, Users } from "lucide-react";

export interface LeaderboardEntry {
  id: string;
  name: string | null;
  callCount: number;
  points: number;
  totalDuration: number;
  topBadges: { id: string; name: string; icon: string }[];
}

const PERIOD_LABELS: Record<string, string> = {
  yesterday: "Yesterday",
  week:      "This Week",
  month:     "This Month",
};

interface Props {
  leaderboard: LeaderboardEntry[];
  period?: string;
}

function StatRow({
  icon,
  label,
  sub,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground leading-none">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
      <p className={`text-base font-bold shrink-0 ${highlight ? "text-violet-600" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

export function TopPerformerPanel({ leaderboard, period = "week" }: Props) {
  if (leaderboard.length === 0) return null;

  const first  = leaderboard[0];
  const second = leaderboard[1] ?? null;

  const totalTeamCalls = leaderboard.reduce((s, a) => s + a.callCount, 0);
  const teamSize        = leaderboard.length;

  const callsPerDay = (first.callCount / 7).toFixed(1);
  const leadCalls   = second ? first.callCount - second.callCount : first.callCount;
  const leadPoints  = second ? first.points - second.points : first.points;
  const percentile  = teamSize > 1 ? Math.round((1 - 1 / teamSize) * 100) : 100;
  const teamShare   = totalTeamCalls > 0 ? Math.round((first.callCount / totalTeamCalls) * 100) : 0;
  const avgDurSecs  = first.callCount > 0 ? Math.round(first.totalDuration / first.callCount) : 0;
  const avgDurStr   = first.callCount > 0
    ? `${Math.floor(avgDurSecs / 60)}m ${avgDurSecs % 60}s`
    : "—";

  return (
    <div className="rounded-2xl border bg-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/20">
        <Crown className="h-4 w-4 text-amber-500" />
        <p className="font-semibold text-sm">Top Performer</p>
        <span className="ml-auto text-xs text-muted-foreground">{PERIOD_LABELS[period]}</span>
      </div>

      {/* Hero block */}
      <div className="relative px-5 pt-8 pb-6 flex flex-col items-center text-center gap-3 border-b overflow-hidden bg-gradient-to-b from-amber-50/60 to-transparent dark:from-amber-950/20">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />

        <span className="text-3xl z-10">👑</span>

        {/* Avatar */}
        <div className="relative z-10 h-28 w-28 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 dark:from-amber-700 dark:to-orange-600 border-4 border-amber-400/70 shadow-xl flex items-center justify-center">
          <span className="text-5xl font-extrabold text-white drop-shadow">
            {(first.name ?? "?").charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Name + badge */}
        <div className="z-10">
          <p className="text-xl font-extrabold leading-tight tracking-tight">{first.name}</p>
          <span className="inline-block mt-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            #1 {period === "yesterday" ? "yesterday" : PERIOD_LABELS[period].toLowerCase()}
          </span>
        </div>

        {/* Huge call count */}
        <div className="z-10 mt-1">
          <p className="text-6xl font-black text-amber-500 dark:text-amber-400 leading-none tabular-nums">
            {first.callCount}
          </p>
          <p className="text-sm text-muted-foreground mt-1 font-medium">calls {period === "yesterday" ? "yesterday" : PERIOD_LABELS[period].toLowerCase()}</p>
        </div>

        {/* Badges */}
        {first.topBadges.length > 0 && (
          <div className="flex gap-2 mt-1 flex-wrap justify-center z-10">
            {first.topBadges.map((b) => (
              <span key={b.id} title={b.name} className="text-2xl">
                {b.icon}
              </span>
            ))}
          </div>
        )}

        {/* Dominance line */}
        <p className="z-10 text-sm font-bold text-amber-700 dark:text-amber-400 mt-1">
          🏆 {first.name?.split(" ")[0]} dominated {period === "yesterday" ? "yesterday" : period === "month" ? "this month" : "this week"}.
        </p>
      </div>

      {/* Team share bar */}
      <div className="px-5 py-3.5 border-b">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">Share of all team calls</p>
          <p className="text-sm font-extrabold text-violet-600">{teamShare}%</p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all"
            style={{ width: `${Math.min(teamShare, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats list */}
      <div className="px-5 py-1">
        <StatRow
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          label="Top percentile"
          sub={`out of ${teamSize} reps`}
          value={`Top ${percentile}%`}
        />
        <StatRow
          icon={<Zap className="h-4 w-4 text-amber-500" />}
          label="Ahead of #2"
          sub={second ? `vs. ${second.name}` : undefined}
          value={`+${leadCalls} calls`}
        />
        <StatRow
          icon={<Phone className="h-4 w-4 text-blue-500" />}
          label="Avg calls / day"
          sub="last 7 days"
          value={`${callsPerDay}/day`}
        />
        <StatRow
          icon={<Clock className="h-4 w-4 text-slate-500" />}
          label="Avg call duration"
          value={avgDurStr}
        />
        <StatRow
          icon={<Award className="h-4 w-4 text-violet-500" />}
          label="Total points"
          sub={second ? `+${leadPoints.toLocaleString()} over #2` : undefined}
          value={first.points.toLocaleString()}
          highlight
        />
        <StatRow
          icon={<Users className="h-4 w-4 text-rose-500" />}
          label="Badges earned"
          value={`${first.topBadges.length}`}
        />
      </div>

    </div>
  );
}
