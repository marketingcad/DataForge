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

  const [total, today, thisWeek, thisMonth, last30, badges, activeTasks, appointmentsSet, dealsWon] = await Promise.all([
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
    prisma.bookedAppointment.count({ where: { agentId } }),
    prisma.ghlOpportunity.count({ where: { agentId, status: "won" } }),
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
    appointmentsSet,
    dealsWon,
  };
}

/**
 * 6-month call + lead breakdown for the agent radar chart.
 * Returns one entry per month with calls made and leads saved.
 */
export async function getAgentMonthlyBreakdown(agentId: string) {
  const now = new Date();
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    months.push({
      label: start.toLocaleDateString("en-US", { month: "short" }),
      start,
      end,
    });
  }

  const results = await Promise.all(
    months.map(({ start, end }) =>
      Promise.all([
        prisma.callLog.count({ where: { agentId, calledAt: { gte: start, lte: end } } }),
        prisma.lead.count({ where: { savedById: agentId, dateCollected: { gte: start, lte: end } } }),
      ])
    )
  );

  return months.map(({ label }, i) => ({
    month: label,
    calls: results[i][0],
    leads: results[i][1],
  }));
}

/** Leads saved/assigned to this agent with recent activity */
export async function getAgentLeads(agentId: string) {
  const [savedLeads, assignedLeads] = await Promise.all([
    prisma.lead.findMany({
      where: { savedById: agentId },
      select: {
        id: true, businessName: true, city: true, category: true,
        recordStatus: true, dataQualityScore: true, dateCollected: true,
      },
      orderBy: { dateCollected: "desc" },
      take: 8,
    }),
    prisma.lead.findMany({
      where: { assignedToId: agentId },
      select: {
        id: true, businessName: true, city: true, category: true,
        recordStatus: true, dataQualityScore: true, dateCollected: true,
      },
      orderBy: { dateCollected: "desc" },
      take: 8,
    }),
  ]);

  const [totalSaved, totalAssigned] = await Promise.all([
    prisma.lead.count({ where: { savedById: agentId } }),
    prisma.lead.count({ where: { assignedToId: agentId } }),
  ]);

  return { savedLeads, assignedLeads, totalSaved, totalAssigned };
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

  return Object.entries(map).map(([date, count]) => ({ label: date, calls: count }));
}

/**
 * Full profile data for an agent: stats, all badges (earned + locked),
 * completed tasks, 30-day call history chart data.
 */
export async function getAgentProfile(userId: string) {
  const now           = new Date();
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const dayOfWeek     = now.getDay();
  const daysFromMon   = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek   = new Date(now); startOfWeek.setDate(now.getDate() - daysFromMon); startOfWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7);
  const thirtyAgo     = new Date(now); thirtyAgo.setDate(now.getDate() - 29); thirtyAgo.setHours(0, 0, 0, 0);

  const [user, totalCalls, callsThisMonth, callsLastMonth, callsThisWeek, callsLastWeek, allBadges, completedTasks, repCommissions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, points: true, role: true, createdAt: true,
        userBadges: { include: { badge: true }, orderBy: { earnedAt: "asc" } },
      },
    }),
    prisma.callLog.count({ where: { agentId: userId } }),
    prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: startOfMonth } } }),
    prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: startOfWeek } } }),
    prisma.callLog.count({ where: { agentId: userId, calledAt: { gte: startOfLastWeek, lte: new Date(startOfWeek.getTime() - 1) } } }),
    prisma.badge.findMany({ orderBy: { key: "asc" } }),
    prisma.taskProgress.findMany({
      where: { userId, completed: true },
      include: { task: { select: { title: true, pointReward: true } } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    prisma.repCommission.findMany({
      where: { repId: userId },
      include: { rule: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
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
      callsLastMonth,
      callsThisWeek,
      callsLastWeek,
      bestDay,
      avgPerDay:   +(totalCalls / Math.max(1, monthsActive * 30)).toFixed(1),
      avgPerMonth: Math.round(totalCalls / monthsActive),
    },
    allBadges: allBadges.map((b) => ({ ...b, earned: earnedKeys.has(b.key) })),
    completedTasks,
    callHistory,
    repCommissions,
  };
}
