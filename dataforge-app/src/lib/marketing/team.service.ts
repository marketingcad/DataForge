/**
 * team.service.ts
 * Boss / Admin only — team-wide marketing analytics queries.
 * Do NOT call these from sales_rep views.
 */
import { prisma } from "@/lib/prisma";

export type LeaderboardPeriod = "today" | "week" | "month";

function periodSince(period: LeaderboardPeriod): Date {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
  }
  if (period === "week") {
    const d = new Date(now); d.setDate(now.getDate() - 7); return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Team KPI summary: agent count + call totals for today / week / month */
export async function getTeamSummary() {
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [agentCount, callsToday, callsThisWeek, callsThisMonth] = await Promise.all([
    prisma.user.count({ where: { role: "sales_rep" } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfDay },  agent: { role: "sales_rep" } } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfWeek }, agent: { role: "sales_rep" } } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfMonth }, agent: { role: "sales_rep" } } }),
  ]);

  return { agentCount, callsToday, callsThisWeek, callsThisMonth };
}

/** Sorted leaderboard of all sales_rep agents for the given period */
export async function getLeaderboard(period: LeaderboardPeriod = "week") {
  const since = periodSince(period);

  const agents = await prisma.user.findMany({
    where: { role: "sales_rep" },
    select: {
      id: true, name: true, email: true, points: true,
      callLogs: {
        where: { calledAt: { gte: since } },
        select: { id: true, durationSecs: true },
      },
      userBadges: {
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
        take: 3,
      },
    },
  });

  return agents
    .map((a) => ({
      id: a.id,
      name: a.name ?? a.email,
      email: a.email,
      points: a.points,
      callCount: a.callLogs.length,
      totalDuration: a.callLogs.reduce((s, c) => s + c.durationSecs, 0),
      topBadges: a.userBadges.map((ub) => ub.badge),
    }))
    .sort((a, b) => b.callCount - a.callCount);
}

/** Team-wide call volume bucketed by day (pass days=1 for today hourly is handled in UI) */
export async function getTeamCallsPerDay(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await prisma.callLog.findMany({
    where: { calledAt: { gte: since }, agent: { role: "sales_rep" } },
    select: { calledAt: true },
  });

  const map: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    map[d.toISOString().slice(0, 10)] = 0;
  }
  for (const log of logs) {
    const key = log.calledAt.toISOString().slice(0, 10);
    if (key in map) map[key]++;
  }

  return Object.entries(map).map(([date, count]) => ({ date, count }));
}

/** All currently active marketing tasks with each agent's progress */
export async function getActiveTasks() {
  const now = new Date();
  return prisma.marketingTask.findMany({
    where: { endDate: { gte: now }, startDate: { lte: now } },
    include: {
      progress: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { endDate: "asc" },
  });
}

/** Agent who made the most calls yesterday */
export async function getYesterdaysTopPerformer() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday); start.setHours(0, 0, 0, 0);
  const end   = new Date(yesterday); end.setHours(23, 59, 59, 999);

  const agents = await prisma.user.findMany({
    where: { role: "sales_rep" },
    select: {
      id: true, name: true, email: true,
      callLogs: { where: { calledAt: { gte: start, lte: end } }, select: { id: true } },
    },
  });

  const top = agents.sort((a, b) => b.callLogs.length - a.callLogs.length)[0];
  if (!top || top.callLogs.length === 0) return null;
  return { id: top.id, name: top.name ?? top.email, callCount: top.callLogs.length };
}
