/**
 * LeaderboardSection — shared between BossDashboard and AgentDashboard.
 * Renders the Champions leaderboard full-width.
 */
import { SalesLeaderboard, type LeaderboardEntry } from "./SalesLeaderboard";
import type { Metric } from "./MetricToggle";

interface Props {
  leaderboard: LeaderboardEntry[];
  period: string;
  metric?: Metric;
}

export function LeaderboardSection({ leaderboard, period, metric }: Props) {
  return <SalesLeaderboard leaderboard={leaderboard} period={period} metric={metric} />;
}
