import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings/service";
import { startOfDayInTz, startOfMonthInTz, dayRangeInTz } from "@/lib/utils/timezone";

export type AgentReportRow = {
  id: string;
  name: string;
  leadsCount: number;
  apptsToday: number;  // appointments set today (PHT)
  apptsMonth: number;  // appointments set this month
  apptsTotal: number;  // appointments set all-time
  callsToday: number;  // calls made today (PHT)
  callsWeek: number;
  callsMonth: number;
  avgDuration: number; // seconds
  connectRate: number; // 0-100
  points: number;
  badges: number;
  totalCalls: number;
};

export async function getAgentReportMatrix(selectedDate?: string): Promise<AgentReportRow[]> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  // Day/month boundaries are computed in the boss-configured timezone so counts
  // line up with GHL reporting (DST handled). Falls back to America/New_York.
  const tz = (await getSettings().catch(() => null))?.timezone || "America/New_York";
  const monthStart = startOfMonthInTz(tz, now);
  const dayStart = startOfDayInTz(tz, now);

  // The "Today" call column can be re-pointed at any calendar date via the date
  // picker. No date → today (from dayStart to now); a date → that whole day.
  let callDayStart = dayStart;
  let callDayEnd: Date | null = null;
  const range = selectedDate ? dayRangeInTz(tz, selectedDate) : null;
  if (range) { callDayStart = range.start; callDayEnd = range.end; }

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
      // GHL appointments set by this rep (source = "webhook"); createdAt = when booked
      bookedAppointments: {
        where: { source: "webhook" },
        select: { createdAt: true },
      },
      userBadges: { select: { id: true } },
      // "Leads" here = GHL (special) leads only — scraped leads are excluded.
      _count: { select: { savedLeads: { where: { source: "GHL" } } } },
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
      leadsCount:  a._count.savedLeads,
      apptsToday:  a.bookedAppointments.filter((p) => p.createdAt >= dayStart).length,
      apptsMonth:  a.bookedAppointments.filter((p) => p.createdAt >= monthStart).length,
      apptsTotal:  a.bookedAppointments.length,
      callsToday:  a.callLogs.filter((c) => c.calledAt >= callDayStart && (!callDayEnd || c.calledAt < callDayEnd)).length,
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
