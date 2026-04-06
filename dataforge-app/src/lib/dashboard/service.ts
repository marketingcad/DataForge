import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export async function getDashboardStats() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);

  const [
    totalLeads,
    activeLeads,
    leadsThisWeek,
    avgScoreResult,
    duplicateCount,
    qualityBuckets,
    recentLeads,
    leadsByIndustry,
    jobStats,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { recordStatus: "active" } }),
    prisma.lead.count({ where: { dateCollected: { gte: startOfWeek } } }),
    prisma.lead.aggregate({ _avg: { dataQualityScore: true } }),
    prisma.lead.count({ where: { duplicateFlag: true } }),
    Promise.all([
      prisma.lead.count({ where: { dataQualityScore: { gte: 0, lte: 30 } } }),
      prisma.lead.count({ where: { dataQualityScore: { gte: 31, lte: 60 } } }),
      prisma.lead.count({ where: { dataQualityScore: { gte: 61, lte: 80 } } }),
      prisma.lead.count({ where: { dataQualityScore: { gte: 81 } } }),
    ]),
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
    prisma.$queryRaw<{ industry: string; count: bigint }[]>(
      Prisma.sql`SELECT unnest("industriesFoundIn") as industry, COUNT(*) as count FROM "Lead" GROUP BY industry ORDER BY count DESC LIMIT 10`
    ),
    prisma.scrapingJob.aggregate({
      _count: { id: true },
      _sum: { leadsProcessed: true },
    }),
  ]);

  const total = totalLeads || 1;
  return {
    totalLeads,
    activeLeads,
    leadsThisWeek,
    avgQualityScore: Math.round(avgScoreResult._avg.dataQualityScore ?? 0),
    duplicatesPrevented: duplicateCount,
    duplicateRate: Math.round((duplicateCount / total) * 100),
    qualityDistribution: [
      { name: "Low (0–30)", value: qualityBuckets[0], color: "#ef4444" },
      { name: "Medium (31–60)", value: qualityBuckets[1], color: "#f59e0b" },
      { name: "High (61–80)", value: qualityBuckets[2], color: "#22c55e" },
      { name: "Premium (81+)", value: qualityBuckets[3], color: "#a855f7" },
    ],
    recentLeads,
    leadsByIndustry: leadsByIndustry
      .filter((r: { industry: string; count: bigint }) => r.industry && r.industry.trim() !== "")
      .map((r: { industry: string; count: bigint }) => ({
        industry: r.industry,
        count: Number(r.count),
      })),
    totalJobsRun: jobStats._count.id,
    totalLeadsFromJobs: jobStats._sum.leadsProcessed ?? 0,
  };
}
