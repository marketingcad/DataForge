import { prisma } from "@/lib/prisma";

/** Extra widgets for boss bento dashboard — recent calls + active tasks */
export async function getBossWidgets() {
  const now = new Date();

  const [recentCalls, activeTasks] = await Promise.all([
    prisma.callLog.findMany({
      orderBy: { calledAt: "desc" },
      take: 6,
      select: {
        id: true,
        calledAt: true,
        durationSecs: true,
        status: true,
        contactName: true,
        agent: { select: { name: true, email: true } },
      },
    }),
    prisma.marketingTask.findMany({
      where: { endDate: { gte: now }, startDate: { lte: now } },
      orderBy: { endDate: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        targetCalls: true,
        pointReward: true,
        endDate: true,
        _count: { select: { progress: true } },
        progress: { where: { completed: true }, select: { id: true } },
      },
    }),
  ]);

  return { recentCalls, activeTasks };
}
