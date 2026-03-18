/**
 * LeaderboardSection — shared between BossDashboard and AgentDashboard.
 * Renders the SalesLeaderboard podium + TopPerformerPanel side by side.
 * Edit this file and both dashboards update automatically.
 */
import { SalesLeaderboard, type LeaderboardEntry } from "./SalesLeaderboard";
import { TopPerformerPanel } from "./TopPerformerPanel";

interface Props {
  leaderboard: LeaderboardEntry[];
  period: string;
}

export function LeaderboardSection({ leaderboard, period }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div className="lg:col-span-2">
        <SalesLeaderboard leaderboard={leaderboard} period={period} />
      </div>
      <div className="lg:col-span-1">
        <TopPerformerPanel leaderboard={leaderboard} period={period} />
      </div>
    </div>
  );
}
