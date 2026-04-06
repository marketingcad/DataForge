import { prisma } from "@/lib/prisma";

export type AgentReportRow = {
  id: string;
  name: string;
  callsWeek: number;
  callsMonth: number;
  avgDuration: number; // seconds
  connectRate: number; // 0-100
  points: number;
  badges: number;
  totalCalls: number;
};

export async function getAgentReportMatrix(): Promise<AgentReportRow[]> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const agents = await prisma.user.findMany({
    where: { role: "sales_rep" },
    select: {
      id: true,
      name: true,
      email: true,
      points: true,
      callLogs: {
        select: { id: true, durationSecs: true, status: true, calledAt: true },
      },
      userBadges: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  return agents.map((a) => {
    const weekCalls  = a.callLogs.filter((c) => c.calledAt >= weekAgo);
    const monthCalls = a.callLogs.filter((c) => c.calledAt >= monthStart);
    const completed  = a.callLogs.filter((c) => c.status === "completed");
    const avgDur     = completed.length
      ? Math.round(completed.reduce((s, c) => s + c.durationSecs, 0) / completed.length)
      : 0;
    const connectRate = a.callLogs.length
      ? Math.round((completed.length / a.callLogs.length) * 100)
      : 0;

    return {
      id:          a.id,
      name:        a.name ?? a.email,
      callsWeek:   weekCalls.length,
      callsMonth:  monthCalls.length,
      avgDuration: avgDur,
      connectRate,
      points:      a.points,
      badges:      a.userBadges.length,
      totalCalls:  a.callLogs.length,
    };
  });
}
