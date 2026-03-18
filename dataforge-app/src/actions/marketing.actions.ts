"use server";
import { requireDepartment } from "@/lib/rbac/guards";
import { withDbRetry } from "@/lib/prisma";
import { getLeaderboard, getActiveTasks, getYesterdaysTopPerformer, getTeamCallsPerDay } from "@/lib/marketing/team.service";
import { getAgentStats, getAgentCallsPerDay } from "@/lib/marketing/agent.service";

export async function getMarketingDashboardAction() {
  await requireDepartment("marketing");
  return withDbRetry(async () => {
    const [leaderboard, activeTasks, yesterdaysTop] = await Promise.all([
      getLeaderboard("week"),
      getActiveTasks(),
      getYesterdaysTopPerformer(),
    ]);
    return { leaderboard, activeTasks, yesterdaysTop };
  });
}

export async function getAgentProfileAction(agentId: string) {
  await requireDepartment("marketing");
  return withDbRetry(() => getAgentStats(agentId));
}

export async function getCallsChartAction(agentId: string | null, days = 30) {
  await requireDepartment("marketing");
  return withDbRetry(() =>
    agentId ? getAgentCallsPerDay(agentId, days) : getTeamCallsPerDay(days)
  );
}
