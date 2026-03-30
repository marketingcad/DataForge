import { prisma } from "@/lib/prisma";

export async function getKeywords(createdById?: string) {
  return prisma.scrapingKeyword.findMany({
    where: createdById ? { createdById } : undefined,
    include: {
      _count: { select: { jobs: true, leads: true } },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, leadsProcessed: true, leadsDiscovered: true, pendingLeads: true, errorMessage: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getKeywordById(id: string) {
  return prisma.scrapingKeyword.findUniqueOrThrow({
    where: { id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          leadsDiscovered: true,
          leadsProcessed: true,
          duplicatesFound: true,
          createdAt: true,
          completedTime: true,
        },
      },
    },
  });
}

export async function createKeyword(data: {
  keyword: string;
  location: string;
  maxLeads?: number;
  intervalMinutes?: number;
  extraKeywords?: string[];
  createdById?: string;
}) {
  const nextRunAt = new Date();
  return prisma.scrapingKeyword.create({
    data: {
      keyword: data.keyword.trim(),
      location: data.location.trim(),
      maxLeads: data.maxLeads ?? 50,
      intervalMinutes: data.intervalMinutes ?? 1440,
      extraKeywords: data.extraKeywords ?? [],
      nextRunAt,
      createdById: data.createdById ?? null,
    },
  });
}

export async function updateKeyword(
  id: string,
  data: Partial<{
    keyword: string;
    location: string;
    maxLeads: number;
    intervalMinutes: number;
    enabled: boolean;
    nextRunAt: Date;
    extraKeywords: string[];
  }>
) {
  return prisma.scrapingKeyword.update({ where: { id }, data });
}

/** Pick a search term: random from [mainKeyword, ...extraKeywords]. */
export function pickSearchTerm(kw: { keyword: string; extraKeywords: string[] }): string {
  const pool = [kw.keyword, ...kw.extraKeywords].filter(Boolean);
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function deleteKeyword(id: string) {
  return prisma.scrapingKeyword.delete({ where: { id } });
}

/** Returns keywords whose nextRunAt is due (or never set) and are enabled. */
export async function getDueKeywords() {
  return prisma.scrapingKeyword.findMany({
    where: {
      enabled: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
    },
    orderBy: { nextRunAt: "asc" },
  });
}

/** Called after a keyword-linked job completes successfully. */
export async function onKeywordJobSuccess(id: string, intervalMinutes: number) {
  const next = new Date(Date.now() + intervalMinutes * 60 * 1000);
  return prisma.scrapingKeyword.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: next,
      failedAttempts: 0,
      lastError: null,
    },
  });
}

/** Called after a keyword-linked job fails. Returns updated failedAttempts. */
export async function onKeywordJobFailure(id: string, error: string, intervalMinutes: number) {
  const kw = await prisma.scrapingKeyword.findUniqueOrThrow({ where: { id } });
  const attempts = kw.failedAttempts + 1;
  const MAX_FAILURES = 5;

  // Back-off: retry in intervalMinutes, but disable after max failures
  const next = attempts >= MAX_FAILURES
    ? null
    : new Date(Date.now() + intervalMinutes * 60 * 1000);

  await prisma.scrapingKeyword.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: next,
      failedAttempts: attempts,
      lastError: error,
      enabled: attempts < MAX_FAILURES,
    },
  });

  return { attempts, disabled: attempts >= MAX_FAILURES };
}
