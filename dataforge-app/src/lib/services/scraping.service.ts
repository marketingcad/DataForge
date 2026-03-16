import { prisma } from "@/lib/prisma";
import { ScrapingJobInput } from "@/types/scraping";

export async function createJob(input: ScrapingJobInput) {
  return prisma.scrapingJob.create({ data: input });
}

export async function getJobs({ page = 1, pageSize = 20, status }: { page?: number; pageSize?: number; status?: string }) {
  const where = status ? { status: status as never } : {};
  const [jobs, total] = await Promise.all([
    prisma.scrapingJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scrapingJob.count({ where }),
  ]);
  return { jobs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getJobById(id: string) {
  return prisma.scrapingJob.findUniqueOrThrow({ where: { id } });
}

export async function updateJobStatus(
  id: string,
  status: "pending" | "running" | "completed" | "failed" | "paused",
  extras?: { errorMessage?: string; startTime?: Date; completedTime?: Date }
) {
  return prisma.scrapingJob.update({ where: { id }, data: { status, ...extras } });
}

export async function incrementJobMetric(
  id: string,
  field: "leadsDiscovered" | "leadsProcessed" | "duplicatesFound" | "failedRecords"
) {
  return prisma.scrapingJob.update({ where: { id }, data: { [field]: { increment: 1 } } });
}
