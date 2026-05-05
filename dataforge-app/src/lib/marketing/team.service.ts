/**
 * team.service.ts
 * Boss / Admin only — team-wide marketing analytics queries.
 * Do NOT call these from sales_rep views.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";

export type LeaderboardPeriod = "yesterday" | "week" | "month" | "all_time";
export type LeaderboardMetric = "calls" | "leads" | "appts_set" | "deals_won" | "commissions" | "avg_call_time" | "badges";

/** Roles that participate in the marketing leaderboard / KPIs */
const MARKETING_ROLES = { in: [UserRole.sales_rep, UserRole.team_lead] };

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
export const getTeamSummary = unstable_cache(async function getTeamSummary() {
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7); startOfWeek.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(now); yesterdayStart.setDate(now.getDate() - 1); yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd   = new Date(now); yesterdayEnd.setDate(now.getDate() - 1);   yesterdayEnd.setHours(23, 59, 59, 999);

  const [agentCount, callsToday, callsYesterday, callsThisWeek, callsThisMonth, callsAllTime, teamApptsSet, teamWon] = await Promise.all([
    prisma.user.count({ where: { role: MARKETING_ROLES } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfDay },                          agent: { role: MARKETING_ROLES } } }),
    prisma.callLog.count({ where: { calledAt: { gte: yesterdayStart, lte: yesterdayEnd },   agent: { role: MARKETING_ROLES } } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfWeek },                         agent: { role: MARKETING_ROLES } } }),
    prisma.callLog.count({ where: { calledAt: { gte: startOfMonth },                        agent: { role: MARKETING_ROLES } } }),
    prisma.callLog.count({ where: {                                                          agent: { role: MARKETING_ROLES } } }),
    prisma.bookedAppointment.count({ where: { agent: { role: MARKETING_ROLES } } }),
    prisma.ghlOpportunity.count({ where: { agent: { role: MARKETING_ROLES }, status: "won" } }),
  ]);

  return { agentCount, callsToday, callsYesterday, callsThisWeek, callsThisMonth, callsAllTime, teamApptsSet, teamWon };
}, ["team-summary"], { revalidate: 120, tags: ["marketing"] });

/** Sorted leaderboard of all marketing agents for the given period + metric */
export const getLeaderboard = unstable_cache(async function getLeaderboard(
  period: LeaderboardPeriod = "week",
  metric: LeaderboardMetric = "appts_set",
) {
  const range = periodRange(period);
  const dateFilter = Object.keys(range).length > 0 ? range : undefined;

  const agents = await prisma.user.findMany({
    where: { role: MARKETING_ROLES },
    select: {
      id: true, name: true, email: true, points: true,
      callLogs: {
        where: dateFilter ? { calledAt: dateFilter } : undefined,
        select: { id: true, durationSecs: true },
      },
      userBadges: {
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
        take: 3,
      },
      bookedAppointments: {
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: { id: true },
      },
      ghlOpportunities: {
        where: dateFilter ? { updatedAt: dateFilter, status: "won" } : { status: "won" },
        select: { id: true },
      },
      savedLeads: {
        where: dateFilter ? { dateCollected: dateFilter } : undefined,
        select: { id: true },
      },
      repCommissions: {
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: { amount: true },
      },
    },
  });

  const mapped = agents.map((a) => {
    const callCount      = a.callLogs.length;
    const totalDuration  = a.callLogs.reduce((s, c) => s + c.durationSecs, 0);
    const avgCallTime    = callCount > 0 ? Math.round(totalDuration / callCount) : 0;
    return {
      id:                a.id,
      name:              a.name ?? a.email,
      email:             a.email,
      points:            a.points,
      callCount,
      totalDuration,
      avgCallTime,
      topBadges:         a.userBadges.map((ub) => ub.badge),
      badgesEarned:      a.userBadges.length,
      appointmentsSet:   a.bookedAppointments.length,
      dealsWon:          a.ghlOpportunities.length,
      leadsBooked:       a.savedLeads.length,
      commissionsEarned: a.repCommissions.reduce((s, c) => s + c.amount, 0),
    };
  });

  return mapped.sort((a, b) => {
    switch (metric) {
      case "calls":         return b.callCount - a.callCount;
      case "leads":         return b.leadsBooked - a.leadsBooked;
      case "deals_won":     return b.dealsWon - a.dealsWon;
      case "commissions":   return b.commissionsEarned - a.commissionsEarned;
      case "avg_call_time": return b.avgCallTime - a.avgCallTime;
      case "badges":        return b.badgesEarned - a.badgesEarned;
      case "appts_set":
      default:              return b.appointmentsSet - a.appointmentsSet;
    }
  });
}, ["leaderboard"], { revalidate: 120, tags: ["marketing"] });

/** Team-wide call volume bucketed by day (pass days=1 for today hourly is handled in UI) */
export async function getTeamCallsPerDay(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await prisma.callLog.findMany({
    where: { calledAt: { gte: since }, agent: { role: MARKETING_ROLES } },
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
 * Per-rep daily booked appointments for the last N days — used for the "Appts Set" performance chart.
 */
export async function getRepDailyApptsForChart(
  repIds: string[],
  days = 30
): Promise<{ label: string; [repId: string]: number | string }[]> {
  if (repIds.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const appts = await prisma.bookedAppointment.findMany({
    where: { agentId: { in: repIds }, createdAt: { gte: since } },
    select: { agentId: true, createdAt: true },
  });

  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const counts: Record<string, Record<string, number>> = {};
  for (const date of dates) counts[date] = Object.fromEntries(repIds.map((id) => [id, 0]));
  for (const appt of appts) {
    const key = new Date(appt.createdAt).toISOString().slice(0, 10);
    if (counts[key]) counts[key][appt.agentId] = (counts[key][appt.agentId] ?? 0) + 1;
  }

  return dates.map((date) => ({
    label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ...counts[date],
  }));
}

/**
 * All-time call volume grouped by month — no date cap.
 * Used for the chart when period === "all_time".
 */
export async function getTeamCallsAllTime() {
  const logs = await prisma.callLog.findMany({
    where: { agent: { role: MARKETING_ROLES } },
    select: { calledAt: true },
    orderBy: { calledAt: "asc" },
  });

  if (logs.length === 0) return [];

  const map: Record<string, number> = {};
  for (const log of logs) {
    const key = log.calledAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    map[key] = (map[key] ?? 0) + 1;
  }

  return Object.entries(map).map(([label, count]) => ({ label, calls: count }));
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
        prisma.callLog.count({ where: { calledAt: { gte: start, lte: end }, agent: { role: MARKETING_ROLES } } }),
        prisma.lead.count({ where: { dateCollected: { gte: start, lte: end }, savedBy: { role: MARKETING_ROLES } } }),
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
    where: { role: MARKETING_ROLES },
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
    where: { role: MARKETING_ROLES },
    select: {
      id: true, name: true, email: true,
      callLogs: { where: { calledAt: { gte: start, lte: end } }, select: { id: true } },
    },
  });

  const top = agents.sort((a, b) => b.callLogs.length - a.callLogs.length)[0];
  if (!top || top.callLogs.length === 0) return null;
  return { id: top.id, name: top.name ?? top.email, callCount: top.callLogs.length };
}
