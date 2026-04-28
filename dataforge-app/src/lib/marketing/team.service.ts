/**
 * team.service.ts
 * Boss / Admin only — team-wide marketing analytics queries.
 * Do NOT call these from sales_rep views.
 */
import { prisma } from "@/lib/prisma";

export type LeaderboardPeriod = "yesterday" | "week" | "month" | "all_time";

function periodRange(period: LeaderboardPeriod): { gte?: Date; lte?: Date } {
  const now = new Date();
  if (period === "yesterday") {
    const start = new Date(now); start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setDate(now.getDate() - 1);   end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  if (period === "week") {
    return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  }
  if (period === "month") {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  return {}; // all_time — no date filter
}

/** Team KPI summary: agent count + call totals for today / yesterday / week / month */
export async function getTeamSummary() {
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7); startOfWeek.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(now); yesterdayStart.setDate(now.getDate() - 1); yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd   = new Date(now); yesterdayEnd.setDate(now.getDate() - 1);   yesterdayEnd.setHours(23, 59, 59, 999);

  const [agentCount, callsToday, callsYesterday, callsThisWeek, callsThisMonth, callsAllTime, teamApptsSet, teamWon] = await Promise.all([
    prisma.user.count({ where: { role: "sales_rep" } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfDay },                          agent: { role: "sales_rep" } } }),
    prisma.callLog.count({ where: { calledAt: { gte: yesterdayStart, lte: yesterdayEnd },   agent: { role: "sales_rep" } } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfWeek },                         agent: { role: "sales_rep" } } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfMonth },                        agent: { role: "sales_rep" } } }),
    prisma.callLog.count({ where: {                                                          agent: { role: "sales_rep" } } }),
    prisma.ghlOpportunity.count({ where: { agent: { role: "sales_rep" } } }),
    prisma.ghlOpportunity.count({ where: { agent: { role: "sales_rep" }, status: "won" } }),
  ]);

  return { agentCount, callsToday, callsYesterday, callsThisWeek, callsThisMonth, callsAllTime, teamApptsSet, teamWon };
}

/** Sorted leaderboard of all sales_rep agents for the given period */
export async function getLeaderboard(period: LeaderboardPeriod = "week") {
  const range = periodRange(period);

  const agents = await prisma.user.findMany({
    where: { role: "sales_rep" },
    select: {
      id: true, name: true, email: true, points: true,
      callLogs: {
        where: Object.keys(range).length > 0 ? { calledAt: range } : undefined,
        select: { id: true, durationSecs: true },
      },
      userBadges: {
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
        take: 3,
      },
      ghlOpportunities: {
        select: { id: true, status: true },
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
      appointmentsSet: a.ghlOpportunities.length,
      dealsWon: a.ghlOpportunities.filter((o) => o.status === "won").length,
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

/**
 * Per-rep daily call counts for the last N days — used for the multi-line performance chart.
 * Returns an array of date-keyed rows, each with a count per repId.
 */
export async function getRepDailyCallsForChart(
  repIds: string[],
  days = 30
): Promise<{ label: string; [repId: string]: number | string }[]> {
  if (repIds.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.callLog.findMany({
    where: { agentId: { in: repIds }, calledAt: { gte: since } },
    select: { agentId: true, calledAt: true },
  });

  // Build date buckets
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Count per (date, repId)
  const counts: Record<string, Record<string, number>> = {};
  for (const date of dates) counts[date] = Object.fromEntries(repIds.map((id) => [id, 0]));
  for (const log of logs) {
    const key = new Date(log.calledAt).toISOString().slice(0, 10);
    if (counts[key]) counts[key][log.agentId] = (counts[key][log.agentId] ?? 0) + 1;
  }

  return dates.map((date) => ({
    label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ...counts[date],
  }));
}

/**
 * Per-rep daily leads saved for the last N days — used for the leads performance line chart.
 */
export async function getRepDailyLeadsForChart(
  repIds: string[],
  days = 30
): Promise<{ label: string; [repId: string]: number | string }[]> {
  if (repIds.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const leads = await prisma.lead.findMany({
    where: { savedById: { in: repIds }, dateCollected: { gte: since } },
    select: { savedById: true, dateCollected: true },
  });

  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const counts: Record<string, Record<string, number>> = {};
  for (const date of dates) counts[date] = Object.fromEntries(repIds.map((id) => [id, 0]));
  for (const lead of leads) {
    if (!lead.savedById) continue;
    const key = new Date(lead.dateCollected).toISOString().slice(0, 10);
    if (counts[key]) counts[key][lead.savedById] = (counts[key][lead.savedById] ?? 0) + 1;
  }

  return dates.map((date) => ({
    label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ...counts[date],
  }));
}

/**
 * 6-month team call + saved-lead breakdown for the radar chart.
 */
export async function getTeamMonthlyBreakdown() {
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
        prisma.callLog.count({ where: { calledAt: { gte: start, lte: end }, agent: { role: "sales_rep" } } }),
        prisma.lead.count({ where: { dateCollected: { gte: start, lte: end }, savedBy: { role: "sales_rep" } } }),
      ])
    )
  );

  return months.map(({ label }, i) => ({
    month: label,
    calls: results[i][0],
    leads: results[i][1],
  }));
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

/** Top performer per period (today / week / month / all-time) ranked by leads secured */
export async function getTopPerformers() {
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch agents + badges — no leads loaded here (we count below)
  const agents = await prisma.user.findMany({
    where: { role: "sales_rep" },
    select: {
      id: true, name: true, email: true, image: true,
      userBadges: {
        orderBy: { earnedAt: "desc" },
        take: 3,
        include: { badge: { select: { id: true, name: true, icon: true, color: true, imageUrl: true } } },
      },
    },
  });

  if (agents.length === 0) return { today: null, week: null, month: null, allTime: null };

  const agentIds = agents.map((a) => a.id);
  const badgeMap: Record<string, typeof agents[0]["userBadges"][0]["badge"][]> =
    Object.fromEntries(agents.map((a) => [a.id, a.userBadges.map((ub) => ub.badge)]));

  // One aggregation query per period — much cheaper than loading all leads
  const [todayRows, weekRows, monthRows, allTimeRows] = await Promise.all([
    prisma.lead.groupBy({ by: ["savedById"], where: { savedById: { in: agentIds }, dateCollected: { gte: startOfDay   } }, _count: { id: true } }),
    prisma.lead.groupBy({ by: ["savedById"], where: { savedById: { in: agentIds }, dateCollected: { gte: startOfWeek  } }, _count: { id: true } }),
    prisma.lead.groupBy({ by: ["savedById"], where: { savedById: { in: agentIds }, dateCollected: { gte: startOfMonth } }, _count: { id: true } }),
    prisma.lead.groupBy({ by: ["savedById"], where: { savedById: { in: agentIds }                                      }, _count: { id: true } }),
  ]);

  function toMap(rows: { savedById: string | null; _count: { id: number } }[]) {
    const m: Record<string, number> = {};
    for (const r of rows) if (r.savedById) m[r.savedById] = r._count.id;
    return m;
  }

  function topFor(countMap: Record<string, number>): TopPerformer {
    const ranked = agents
      .map((a) => ({
        id: a.id,
        name: a.name ?? a.email,
        image: a.image ?? null,
        count: countMap[a.id] ?? 0,
        badges: badgeMap[a.id] ?? [],
      }))
      .sort((x, y) => y.count - x.count);
    const top = ranked[0];
    return top && top.count > 0 ? top : null;
  }

  return {
    today:   topFor(toMap(todayRows)),
    week:    topFor(toMap(weekRows)),
    month:   topFor(toMap(monthRows)),
    allTime: topFor(toMap(allTimeRows)),
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
