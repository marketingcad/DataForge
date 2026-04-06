/**
 * team.service.ts
 * Boss / Admin only — team-wide marketing analytics queries.
 * Do NOT call these from sales_rep views.
 */
import { prisma } from "@/lib/prisma";

export type LeaderboardPeriod = "yesterday" | "week" | "month";

function periodRange(period: LeaderboardPeriod): { gte: Date; lte?: Date } {
  const now = new Date();
  if (period === "yesterday") {
    const start = new Date(now); start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setDate(now.getDate() - 1);   end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  if (period === "week") {
    return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  }
  return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
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
  const range = periodRange(period);

  const agents = await prisma.user.findMany({
    where: { role: "sales_rep" },
    select: {
      id: true, name: true, email: true, points: true,
      callLogs: {
        where: { calledAt: range },
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

export type TopPerformer = {
  id: string;
  name: string;
  image: string | null;
  count: number;
  badges: { id: string; name: string; icon: string; color: string; imageUrl: string | null }[];
} | null;

/** Top performer per period (today / week / month / all-time) with image + badges */
export async function getTopPerformers() {
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const agents = await prisma.user.findMany({
    where: { role: "sales_rep" },
    select: {
      id: true, name: true, email: true, image: true,
      callLogs: { select: { id: true, calledAt: true } },
      userBadges: {
        orderBy: { earnedAt: "desc" },
        take: 3,
        include: { badge: { select: { id: true, name: true, icon: true, color: true, imageUrl: true } } },
      },
    },
  });

  function topFor(since: Date): TopPerformer {
    const ranked = agents
      .map((a) => ({
        id: a.id,
        name: a.name ?? a.email,
        image: a.image ?? null,
        count: a.callLogs.filter((c) => new Date(c.calledAt) >= since).length,
        badges: a.userBadges.map((ub) => ub.badge),
      }))
      .sort((x, y) => y.count - x.count);
    const top = ranked[0];
    return top && top.count > 0 ? top : null;
  }

  const allTimeRanked = agents
    .map((a) => ({
      id: a.id,
      name: a.name ?? a.email,
      image: a.image ?? null,
      count: a.callLogs.length,
      badges: a.userBadges.map((ub) => ub.badge),
    }))
    .sort((x, y) => y.count - x.count)[0];

  return {
    today:   topFor(startOfDay),
    week:    topFor(startOfWeek),
    month:   topFor(startOfMonth),
    allTime: allTimeRanked && allTimeRanked.count > 0 ? allTimeRanked : null,
  };
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
