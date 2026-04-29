import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

async function _getDashboardStats() {
  const now = new Date();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Single query replaces 8 separate count/aggregate calls — one DB round-trip
  type StatsRow = {
    total_leads: bigint;
    active_leads: bigint;
    leads_this_week: bigint;
    avg_quality_score: number | null;
    duplicate_count: bigint;
    quality_low: bigint;
    quality_medium: bigint;
    quality_high: bigint;
    quality_premium: bigint;
  };

  const [statsRows, recentLeads, jobStats] = await Promise.all([
    prisma.$queryRaw<StatsRow[]>`
      SELECT
        COUNT(*)                                                              AS total_leads,
        COUNT(*) FILTER (WHERE "recordStatus" = 'active')                    AS active_leads,
        COUNT(*) FILTER (WHERE "dateCollected" >= ${startOfWeek})            AS leads_this_week,
        AVG("dataQualityScore")                                              AS avg_quality_score,
        COUNT(*) FILTER (WHERE "duplicateFlag" = true)                       AS duplicate_count,
        COUNT(*) FILTER (WHERE "dataQualityScore" BETWEEN 0  AND 30)        AS quality_low,
        COUNT(*) FILTER (WHERE "dataQualityScore" BETWEEN 31 AND 60)        AS quality_medium,
        COUNT(*) FILTER (WHERE "dataQualityScore" BETWEEN 61 AND 80)        AS quality_high,
        COUNT(*) FILTER (WHERE "dataQualityScore" >= 81)                     AS quality_premium
      FROM "Lead"
    `,
    prisma.lead.findMany({
      orderBy: { dateCollected: "desc" },
      take: 10,
      select: {
        id: true,
        businessName: true,
        phone: true,
        category: true,
        dataQualityScore: true,
        dateCollected: true,
        recordStatus: true,
      },
    }),
    prisma.scrapingJob.aggregate({
      _count: { id: true },
      _sum: { leadsProcessed: true },
    }),
  ]);

  const s = statsRows[0];
  const totalLeads = Number(s.total_leads);
  const activeLeads = Number(s.active_leads);
  const leadsThisWeek = Number(s.leads_this_week);
  const duplicateCount = Number(s.duplicate_count);
  const total = totalLeads || 1;

  return {
    totalLeads,
    activeLeads,
    leadsThisWeek,
    avgQualityScore: Math.round(s.avg_quality_score ?? 0),
    duplicatesPrevented: duplicateCount,
    duplicateRate: Math.round((duplicateCount / total) * 100),
    qualityDistribution: [
      { name: "Low (0–30)",    value: Number(s.quality_low),     color: "#ef4444" },
      { name: "Medium (31–60)", value: Number(s.quality_medium), color: "#f59e0b" },
      { name: "High (61–80)",  value: Number(s.quality_high),    color: "#22c55e" },
      { name: "Premium (81+)", value: Number(s.quality_premium), color: "#a855f7" },
    ],
    recentLeads,
    leadsByIndustry: [] as { industry: string; count: number }[],
    totalJobsRun: jobStats._count.id,
    totalLeadsFromJobs: jobStats._sum.leadsProcessed ?? 0,
  };
}

// Cache dashboard stats for 5 minutes — avoids a DB hit on every page load
export const getDashboardStats = unstable_cache(
  _getDashboardStats,
  ["dashboard-stats"],
  { revalidate: 300 }
);
