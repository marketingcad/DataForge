/**
 * LeaderboardSection — shared between BossDashboard and AgentDashboard.
 * Renders the Champions leaderboard full-width.
 */
import { SalesLeaderboard, type LeaderboardEntry } from "./SalesLeaderboard";

interface Props {
  leaderboard: LeaderboardEntry[];
  period: string;
}

export function LeaderboardSection({ leaderboard, period }: Props) {
  return <SalesLeaderboard leaderboard={leaderboard} period={period} />;
}
