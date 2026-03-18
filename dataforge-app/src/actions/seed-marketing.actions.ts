"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac/guards";
import { revalidatePath } from "next/cache";

const BADGES = [
  {
    key: "first_call",
    name: "First Call",
    description: "Made your first call",
    icon: "📞",
    color: "#3b82f6",
  },
  {
    key: "century_club",
    name: "Century Club",
    description: "Completed 100 calls total",
    icon: "💯",
    color: "#8b5cf6",
  },
  {
    key: "speed_dialer",
    name: "Speed Dialer",
    description: "Made 20+ calls in a single day",
    icon: "⚡",
    color: "#f59e0b",
  },
  {
    key: "top_performer",
    name: "Top Performer",
    description: "Ranked #1 for a week",
    icon: "🏆",
    color: "#f59e0b",
  },
  {
    key: "hot_streak",
    name: "Hot Streak",
    description: "Active 7 consecutive days",
    icon: "🔥",
    color: "#ef4444",
  },
  {
    key: "marathon",
    name: "Marathon",
    description: "Completed 500 calls total",
    icon: "🏅",
    color: "#6366f1",
  },
  {
    key: "gold_standard",
    name: "Gold Standard",
    description: "Top performer for a full month",
    icon: "⭐",
    color: "#eab308",
  },
  {
    key: "consistent",
    name: "Consistent",
    description: "30 days of activity",
    icon: "📈",
    color: "#22c55e",
  },
];

const CONTACT_NAMES = [
  "Alice Johnson",
  "Bob Martinez",
  "Carol White",
  "David Lee",
  "Emma Brown",
  "Frank Wilson",
  "Grace Kim",
  "Henry Davis",
  "Isabella Moore",
  "Jack Taylor",
  "Karen Anderson",
  "Liam Thomas",
  "Mia Jackson",
  "Noah Harris",
  "Olivia Martin",
];

const CONTACT_PHONES = [
  "5551234567",
  "5559876543",
  "5554567890",
  "5552345678",
  "5556789012",
  "5553456789",
  "5557890123",
  "5558901234",
  "5550123456",
  "5551357924",
];

export async function seedMarketingDataAction() {
  await requireRole("boss");

  // Upsert badges
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { key: b.key },
      update: {},
      create: b,
    });
  }

  const salesReps = await prisma.user.findMany({
    where: { role: "sales_rep" },
  });
  if (salesReps.length === 0) {
    return { message: "No sales_rep users found. Create some first." };
  }

  // Delete old dummy data
  await prisma.callLog.deleteMany({
    where: { agentId: { in: salesReps.map((u) => u.id) } },
  });
  await prisma.taskProgress.deleteMany({
    where: { userId: { in: salesReps.map((u) => u.id) } },
  });
  await prisma.userBadge.deleteMany({
    where: { userId: { in: salesReps.map((u) => u.id) } },
  });
  await prisma.marketingTask.deleteMany({});

  // Generate call logs for past 30 days
  const now = new Date();
  const callLogsData: {
    agentId: string;
    contactName: string;
    contactPhone: string;
    direction: "outbound";
    durationSecs: number;
    status: "completed" | "missed" | "voicemail" | "no_answer";
    calledAt: Date;
  }[] = [];

  for (const rep of salesReps) {
    const baseDaily = 5 + Math.floor(Math.random() * 15); // 5-20 calls/day
    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
      const dailyCalls = Math.max(
        0,
        baseDaily + Math.floor((Math.random() - 0.5) * 8)
      );
      for (let i = 0; i < dailyCalls; i++) {
        const calledAt = new Date(date);
        calledAt.setHours(
          8 + Math.floor(Math.random() * 9),
          Math.floor(Math.random() * 60)
        );
        const statuses = [
          "completed",
          "completed",
          "completed",
          "missed",
          "voicemail",
          "no_answer",
        ] as const;
        callLogsData.push({
          agentId: rep.id,
          contactName:
            CONTACT_NAMES[Math.floor(Math.random() * CONTACT_NAMES.length)],
          contactPhone:
            CONTACT_PHONES[Math.floor(Math.random() * CONTACT_PHONES.length)],
          direction: "outbound",
          durationSecs: Math.floor(Math.random() * 600) + 30,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          calledAt,
        });
      }
    }
  }
  await prisma.callLog.createMany({ data: callLogsData });

  // Create tasks
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const tasks = await prisma.marketingTask.createManyAndReturn({
    data: [
      {
        title: "Weekly Call Blitz",
        description: "Complete 50 calls this week",
        targetCalls: 50,
        pointReward: 200,
        startDate: weekStart,
        endDate: weekEnd,
      },
      {
        title: "Daily Grind",
        description: "Make at least 10 calls today",
        targetCalls: 10,
        pointReward: 50,
        startDate: todayStart,
        endDate: todayEnd,
      },
      {
        title: "Monthly Marathon",
        description: "Complete 200 calls this month",
        targetCalls: 200,
        pointReward: 500,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: monthEnd,
      },
    ],
  });

  // Create task progress for each rep
  for (const rep of salesReps) {
    const weekCalls = await prisma.callLog.count({
      where: { agentId: rep.id, calledAt: { gte: weekStart } },
    });
    const todayCalls = await prisma.callLog.count({
      where: { agentId: rep.id, calledAt: { gte: todayStart } },
    });
    const monthCalls = await prisma.callLog.count({
      where: {
        agentId: rep.id,
        calledAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    });

    await prisma.taskProgress.createMany({
      data: [
        {
          userId: rep.id,
          taskId: tasks[0].id,
          callCount: Math.min(weekCalls, 50),
          completed: weekCalls >= 50,
        },
        {
          userId: rep.id,
          taskId: tasks[1].id,
          callCount: Math.min(todayCalls, 10),
          completed: todayCalls >= 10,
        },
        {
          userId: rep.id,
          taskId: tasks[2].id,
          callCount: Math.min(monthCalls, 200),
          completed: monthCalls >= 200,
        },
      ],
    });
  }

  // Award badges based on performance
  const badges = await prisma.badge.findMany();
  const badgeMap = Object.fromEntries(badges.map((b) => [b.key, b.id]));

  for (const rep of salesReps) {
    const totalCalls = await prisma.callLog.count({
      where: { agentId: rep.id },
    });
    const badgesToAward: string[] = [];

    if (totalCalls >= 1) badgesToAward.push("first_call");
    if (totalCalls >= 100) badgesToAward.push("century_club");
    if (totalCalls >= 500) badgesToAward.push("marathon");

    // Check speed dialer (20+ calls in one day)
    const maxDayResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "CallLog"
      WHERE "agentId" = ${rep.id}
      GROUP BY DATE("calledAt")
      ORDER BY count DESC
      LIMIT 1
    `;
    if (maxDayResult[0] && Number(maxDayResult[0].count) >= 20) {
      badgesToAward.push("speed_dialer");
    }

    // Randomly award some for variety in dummy data
    if (Math.random() > 0.4) badgesToAward.push("hot_streak");
    if (Math.random() > 0.6) badgesToAward.push("top_performer");
    if (Math.random() > 0.7) badgesToAward.push("consistent");

    const points = totalCalls * 2 + badgesToAward.length * 50;
    await prisma.user.update({
      where: { id: rep.id },
      data: { points },
    });

    for (const key of [...new Set(badgesToAward)]) {
      const badgeId = badgeMap[key];
      if (badgeId) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: rep.id, badgeId } },
          update: {},
          create: { userId: rep.id, badgeId },
        });
      }
    }
  }

  revalidatePath("/marketing");
  return { message: `Seeded data for ${salesReps.length} sales rep(s).` };
}
