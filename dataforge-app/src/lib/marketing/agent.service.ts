/**
 * agent.service.ts
 * Sales Rep (agent) personal queries — individual stats, tasks, profile.
 * These are scoped to a single userId; do NOT expose team-wide data here.
 */
import { prisma } from "@/lib/prisma";

/** Personal call stats + earned badges + active task progress */
export async function getAgentStats(agentId: string) {
  const now          = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOf30    = new Date(now); startOf30.setDate(now.getDate() - 30);

  const [total, today, thisWeek, thisMonth, last30, badges, activeTasks] = await Promise.all([
    prisma.callLog.count({ where: { agentId } }),
    prisma.callLog.count({ where: { agentId, calledAt: { gte: startOfDay } } }),
    prisma.callLog.count({ where: { agentId, calledAt: { gte: startOfWeek } } }),
    prisma.callLog.count({ where: { agentId, calledAt: { gte: startOfMonth } } }),
    prisma.callLog.count({ where: { agentId, calledAt: { gte: startOf30 } } }),
    prisma.userBadge.findMany({
      where: { userId: agentId },
      include: { badge: true },
      orderBy: { earnedAt: "desc" },
    }),
    prisma.taskProgress.findMany({
      where: { userId: agentId },
      include: { task: true },
      orderBy: { task: { endDate: "asc" } },
    }),
  ]);

  return {
    total,
    today,
    thisWeek,
    thisMonth,
    avgPerDay:  last30 / 30,
    avgPerWeek: last30 / (30 / 7),
    badges,
    activeTasks,
  };
}

/** Latest N calls for the agent */
export async function getAgentRecentCalls(agentId: string, limit = 10) {
  return prisma.callLog.findMany({
    where: { agentId },
    orderBy: { calledAt: "desc" },
    take: limit,
    select: {
      id: true, contactName: true, contactPhone: true,
      direction: true, status: true, durationSecs: true, calledAt: true,
    },
  });
}

/** Personal call volume by day for the last N days (for agent's own chart) */
export async function getAgentCallsPerDay(agentId: string, days = 30) {
  const since = new Date(); since.setDate(since.getDate() - days);

  const logs = await prisma.callLog.findMany({
    where: { agentId, calledAt: { gte: since } },
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

/**
 * Full profile data for an agent: stats, all badges (earned + locked),
 * completed tasks, 30-day call history chart data.
 */
export async function getAgentProfile(userId: string) {
  const now          = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
  const thirtyAgo    = new Date(now); thirtyAgo.setDate(now.getDate() - 29); thirtyAgo.setHours(0, 0, 0, 0);

  const [user, totalCalls, callsThisMonth, callsThisWeek, allBadges, completedTasks] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, points: true, createdAt: true,
        userBadges: { include: { badge: true }, orderBy: { earnedAt: "asc" } },
      },
    }),
    prisma.callLog.count({ where: { agentId: userId } }),
    prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: startOfMonth } } }),
    prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: startOfWeek } } }),
    prisma.badge.findMany({ orderBy: { key: "asc" } }),
    prisma.taskProgress.findMany({
      where: { userId, completed: true },
      include: { task: { select: { title: true, pointReward: true } } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
  ]);

  // Best single day
  const bestDayRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "CallLog"
    WHERE "agentId" = ${userId}
    GROUP BY DATE("calledAt")
    ORDER BY count DESC LIMIT 1
  `;
  const bestDay = bestDayRows[0] ? Number(bestDayRows[0].count) : 0;

  // 30-day chart data
  const recentLogs = await prisma.callLog.findMany({
    where: { agentId: userId, calledAt: { gte: thirtyAgo } },
    select: { calledAt: true },
    orderBy: { calledAt: "asc" },
  });
  const buckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const log of recentLogs) {
    const key = log.calledAt.toISOString().slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  const callHistory = Object.entries(buckets).map(([date, calls]) => ({
    label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    calls,
  }));

  const monthsActive = Math.max(1, Math.ceil((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const earnedKeys   = new Set(user.userBadges.map((ub) => ub.badge.key));

  return {
    user,
    stats: {
      totalCalls,
      callsThisMonth,
      callsThisWeek,
      bestDay,
      avgPerDay:   +(totalCalls / Math.max(1, monthsActive * 30)).toFixed(1),
      avgPerMonth: Math.round(totalCalls / monthsActive),
    },
    allBadges: allBadges.map((b) => ({ ...b, earned: earnedKeys.has(b.key) })),
    completedTasks,
    callHistory,
  };
}
