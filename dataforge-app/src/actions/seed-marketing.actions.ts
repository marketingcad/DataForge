"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac/guards";
import { revalidatePath } from "next/cache";

const BADGES = [
  { key: "first_call",    name: "First Call",      description: "Made your first call",                  icon: "📞", color: "#3b82f6" },
  { key: "century_club",  name: "Century Club",     description: "Completed 100 calls total",             icon: "💯", color: "#8b5cf6" },
  { key: "speed_dialer",  name: "Speed Dialer",     description: "Made 20+ calls in a single day",        icon: "⚡", color: "#f59e0b" },
  { key: "top_performer", name: "Top Performer",    description: "Ranked #1 for a week",                  icon: "🏆", color: "#f59e0b" },
  { key: "hot_streak",    name: "Hot Streak",       description: "Active 7 consecutive days",             icon: "🔥", color: "#ef4444" },
  { key: "marathon",      name: "Marathon",         description: "Completed 500 calls total",             icon: "🏅", color: "#6366f1" },
  { key: "gold_standard", name: "Gold Standard",    description: "Top lead-securing rep for the month",   icon: "⭐", color: "#eab308" },
  { key: "consistent",    name: "Consistent",       description: "30 days of activity",                   icon: "📈", color: "#22c55e" },
  { key: "first_lead",    name: "First Lead",       description: "Secured your first lead",               icon: "🎯", color: "#10b981" },
  { key: "lead_hunter",   name: "Lead Hunter",      description: "Secured 25 leads total",                icon: "🦅", color: "#0ea5e9" },
  { key: "lead_machine",  name: "Lead Machine",     description: "Secured 100 leads total",               icon: "🤖", color: "#8b5cf6" },
  { key: "daily_closer",  name: "Daily Closer",     description: "Secured 5+ leads in a single day",      icon: "💼", color: "#f43f5e" },
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
  // Nullify commissions on seeded leads before deleting so FK doesn't block
  await prisma.leadCommission.deleteMany({
    where: { lead: { source: "seed", savedById: { in: salesReps.map((u) => u.id) } } },
  });
  await prisma.lead.deleteMany({
    where: { savedById: { in: salesReps.map((u) => u.id) }, source: "seed" },
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

  // Generate leads secured by each rep over the past 30 days
  const BUSINESS_NAMES = [
    "Sunrise Bakery", "Metro Plumbing", "Green Leaf Landscaping", "Peak Fitness",
    "City Dental Clinic", "Blue Ocean Consulting", "Maple Auto Repair", "Golden Gate Realty",
    "Swift Logistics", "Nova Tech Solutions", "Harbor Coffee Roasters", "Pinewood Construction",
    "Clearview Optometry", "Red Rock Catering", "Silverline Marketing", "Canyon Yoga Studio",
    "Bright Kids Academy", "Iron Shield Security", "Coastal Cleaning Co.", "Horizon Law Group",
    "Ember Restaurant", "Apex Accounting", "Vivid Print Studio", "Keystone Insurance",
    "Summit Sports Gear", "Pacific Wellness Spa", "Diamond Events", "Orion Photography",
    "Blueprint Architecture", "Riverside Pharmacy",
  ];
  const CATEGORIES = [
    "Food & Beverage", "Home Services", "Healthcare", "Fitness", "Legal",
    "Technology", "Real Estate", "Retail", "Education", "Consulting",
    "Construction", "Automotive", "Marketing", "Finance", "Events",
  ];
  const CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia"];
  const leadsData: {
    businessName: string; phone: string; source: string;
    savedById: string; dateCollected: Date;
    category: string; city: string; dataQualityScore: number;
  }[] = [];

  // Give each rep a distinct performance tier so top performers are obvious
  const repTiers = salesReps.map((_, i) => {
    const tier = i % 4; // 0=star, 1=solid, 2=average, 3=low
    return tier === 0 ? 4 : tier === 1 ? 2 : tier === 2 ? 1 : 0;
  });

  let nameIdx = 0;
  for (let ri = 0; ri < salesReps.length; ri++) {
    const rep = salesReps[ri];
    const baseDaily = repTiers[ri]; // 0–4 leads/day base
    for (let d = 0; d < 30; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const dailyLeads = Math.max(0, baseDaily + Math.floor((Math.random() - 0.3) * 2));
      for (let i = 0; i < dailyLeads; i++) {
        const collected = new Date(date);
        collected.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
        leadsData.push({
          businessName: BUSINESS_NAMES[nameIdx % BUSINESS_NAMES.length] + ` #${nameIdx + 1}`,
          phone: `555${String(nameIdx).padStart(7, "0")}`,
          source: "seed",
          savedById: rep.id,
          dateCollected: collected,
          category: CATEGORIES[nameIdx % CATEGORIES.length],
          city: CITIES[nameIdx % CITIES.length],
          dataQualityScore: 60 + Math.floor(Math.random() * 40),
        });
        nameIdx++;
      }
    }
  }
  await prisma.lead.createMany({ data: leadsData });

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

  // Find the top lead-securing rep this month for gold_standard
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const leadCountsThisMonth = await prisma.lead.groupBy({
    by: ["savedById"],
    where: { savedById: { in: salesReps.map((u) => u.id) }, dateCollected: { gte: monthStart }, source: "seed" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });
  const topLeadRepId = leadCountsThisMonth[0]?.savedById ?? null;

  for (const rep of salesReps) {
    const [totalCalls, totalLeads] = await Promise.all([
      prisma.callLog.count({ where: { agentId: rep.id } }),
      prisma.lead.count({ where: { savedById: rep.id, source: "seed" } }),
    ]);
    const badgesToAward: string[] = [];

    // Call-based badges
    if (totalCalls >= 1)   badgesToAward.push("first_call");
    if (totalCalls >= 100) badgesToAward.push("century_club");
    if (totalCalls >= 500) badgesToAward.push("marathon");

    const maxDayResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "CallLog"
      WHERE "agentId" = ${rep.id}
      GROUP BY DATE("calledAt")
      ORDER BY count DESC
      LIMIT 1
    `;
    if (maxDayResult[0] && Number(maxDayResult[0].count) >= 20) badgesToAward.push("speed_dialer");

    // Lead-based badges
    if (totalLeads >= 1)   badgesToAward.push("first_lead");
    if (totalLeads >= 25)  badgesToAward.push("lead_hunter");
    if (totalLeads >= 100) badgesToAward.push("lead_machine");

    const maxLeadDayResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Lead"
      WHERE "savedById" = ${rep.id} AND source = 'seed'
      GROUP BY DATE("dateCollected")
      ORDER BY count DESC
      LIMIT 1
    `;
    if (maxLeadDayResult[0] && Number(maxLeadDayResult[0].count) >= 5) badgesToAward.push("daily_closer");

    if (rep.id === topLeadRepId) badgesToAward.push("gold_standard");

    // Random activity badges for variety
    if (Math.random() > 0.4) badgesToAward.push("hot_streak");
    if (Math.random() > 0.6) badgesToAward.push("top_performer");
    if (Math.random() > 0.7) badgesToAward.push("consistent");

    const points = totalCalls * 2 + totalLeads * 5 + badgesToAward.length * 50;
    await prisma.user.update({ where: { id: rep.id }, data: { points } });

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
  revalidatePath("/dashboard");
  return { message: `Seeded data for ${salesReps.length} sales rep(s) — ${leadsData.length} leads created.` };
}
