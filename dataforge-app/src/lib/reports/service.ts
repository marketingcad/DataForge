import { prisma } from "@/lib/prisma";

export type AgentReportRow = {
  id: string;
  name: string;
  leadsCount: number;
  apptsMonth: number;  // GHL appointments set this month
  apptsTotal: number;  // GHL appointments set all-time
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
  // Start of the current calendar month in Philippine time (UTC+8) — matches the
  // marketing overview, so "this month" resets at PHT midnight on the 1st.
  const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const inPHT = new Date(now.getTime() + PHT_OFFSET_MS);
  const monthStart = new Date(Date.UTC(inPHT.getUTCFullYear(), inPHT.getUTCMonth(), 1) - PHT_OFFSET_MS);

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
      apptsMonth:  a.bookedAppointments.filter((p) => p.createdAt >= monthStart).length,
      apptsTotal:  a.bookedAppointments.length,
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
