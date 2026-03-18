/**
 * Seed file: creates dummy marketing team + call logs + badges + tasks
 * Run with: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import * as bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaNeon({
  connectionString: process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

/* ── helpers ── */
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(8, 18), randInt(0, 59), 0, 0);
  return d;
}
function endOfDay(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(23, 59, 59, 999);
  return d;
}
function startOfDay(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

const CONTACT_NAMES = [
  "Maria Santos","James Reyes","Ana Cruz","Carlos Delos Santos","Rosa Mendoza",
  "Juan Garcia","Elena Ramos","Pedro Aquino","Sofia Torres","Miguel Villanueva",
  "Luisa Bautista","Roberto Castillo","Carmen Rivera","Antonio Navarro","Isabel Dela Cruz",
  "Ricardo Ocampo","Patricia Soriano","Eduardo Pascual","Teresa Flores","Manuel Aguilar",
  "Lourdes Morales","Francisco Gomez","Maricel Hernandez","Renato Perez","Glenda Lopez",
];
const CONTACT_PHONES = [
  "09171234567","09281234567","09391234567","09451234567","09561234567",
  "09671234567","09781234567","09891234567","09901234567","09011234567",
];

const CALL_STATUSES = ["completed","completed","completed","missed","voicemail","no_answer"] as const;

/* ── BADGES ── */
const BADGES = [
  { key: "first_call",        name: "First Call",          description: "Made your very first call",              icon: "📞", color: "#6366f1" },
  { key: "daily_10",          name: "Daily Grinder",        description: "Completed 10 calls in a single day",     icon: "🔥", color: "#f97316" },
  { key: "daily_20",          name: "Power Dialer",         description: "Completed 20 calls in a single day",     icon: "⚡", color: "#eab308" },
  { key: "weekly_50",         name: "Weekly Warrior",       description: "Completed 50 calls in a single week",    icon: "🛡️", color: "#3b82f6" },
  { key: "weekly_100",        name: "Century Club",         description: "Completed 100 calls in a single week",   icon: "💯", color: "#8b5cf6" },
  { key: "monthly_200",       name: "Monthly MVP",          description: "Completed 200 calls in a month",         icon: "🏆", color: "#f59e0b" },
  { key: "streak_3",          name: "3-Day Streak",         description: "Made calls 3 days in a row",             icon: "🔗", color: "#10b981" },
  { key: "streak_7",          name: "Week Streak",          description: "Made calls 7 days in a row",             icon: "🌟", color: "#06b6d4" },
  { key: "streak_30",         name: "Iron Streak",          description: "Made calls 30 days in a row",            icon: "💎", color: "#ec4899" },
  { key: "top_day",           name: "Top of the Day",       description: "Ranked #1 in calls for the day",         icon: "👑", color: "#f59e0b" },
  { key: "top_week",          name: "Top of the Week",      description: "Ranked #1 in calls for the week",        icon: "🥇", color: "#f59e0b" },
  { key: "top_month",         name: "Top of the Month",     description: "Ranked #1 in calls for the month",       icon: "🏅", color: "#f59e0b" },
  { key: "task_complete",     name: "Mission Accomplished", description: "Completed your first task challenge",     icon: "✅", color: "#22c55e" },
  { key: "points_100",        name: "Point Collector",      description: "Earned 100 total points",                icon: "💰", color: "#84cc16" },
  { key: "points_500",        name: "High Earner",          description: "Earned 500 total points",                icon: "💎", color: "#a855f7" },
];

/* ── MARKETING TASKS ── */
const TASKS = [
  {
    title: "Daily Hustle",
    description: "Complete 15 outbound calls today and keep the momentum going!",
    targetCalls: 15,
    pointReward: 20,
    startDate: startOfDay(0),
    endDate: endOfDay(0),
  },
  {
    title: "Weekly Sprint",
    description: "Hit 80 calls this week. Quality conversations lead to quality results.",
    targetCalls: 80,
    pointReward: 75,
    startDate: startOfDay(-3),
    endDate: endOfDay(4),
  },
  {
    title: "Century Challenge",
    description: "Reach 100 calls this week. Top performers earn the Century Club badge!",
    targetCalls: 100,
    pointReward: 120,
    startDate: startOfDay(-3),
    endDate: endOfDay(4),
  },
  {
    title: "Power Hour Blitz",
    description: "Make 8 calls before noon today. Early bird gets the worm!",
    targetCalls: 8,
    pointReward: 15,
    startDate: startOfDay(0),
    endDate: endOfDay(0),
  },
  {
    title: "Monthly Marathon",
    description: "Complete 250 calls this month to earn top-tier recognition.",
    targetCalls: 250,
    pointReward: 300,
    startDate: startOfDay(-10),
    endDate: endOfDay(20),
  },
];

/* ── AGENTS ── */
const AGENTS = [
  { name: "Marco Reyes",    email: "marco@dataforge.com",    callsProfile: { dailyMin: 8,  dailyMax: 22 } },
  { name: "Lisa Santos",    email: "lisa@dataforge.com",     callsProfile: { dailyMin: 5,  dailyMax: 18 } },
  { name: "Jake Villanueva",email: "jake@dataforge.com",     callsProfile: { dailyMin: 12, dailyMax: 25 } },
  { name: "Carla Mendoza",  email: "carla@dataforge.com",    callsProfile: { dailyMin: 3,  dailyMax: 14 } },
  { name: "Ryan Torres",    email: "ryan@dataforge.com",     callsProfile: { dailyMin: 10, dailyMax: 20 } },
];

async function main() {
  console.log("🌱 Seeding marketing system...");

  /* 1. Upsert badges */
  console.log("  Creating badges...");
  const badgeMap: Record<string, string> = {};
  for (const b of BADGES) {
    const badge = await prisma.badge.upsert({
      where: { key: b.key },
      update: {},
      create: b,
    });
    badgeMap[b.key] = badge.id;
  }

  /* 2. Upsert tasks */
  console.log("  Creating marketing tasks...");
  const createdTasks: { id: string; targetCalls: number }[] = [];
  for (const t of TASKS) {
    // Use title as a de-dup key — delete old + recreate (simpler than upsert without unique)
    await prisma.marketingTask.deleteMany({ where: { title: t.title } });
    const task = await prisma.marketingTask.create({ data: t });
    createdTasks.push({ id: task.id, targetCalls: task.targetCalls });
  }

  /* 3. Upsert sales_rep agents */
  console.log("  Creating sales_rep agents...");
  const password = await bcrypt.hash("password123", 10);
  const agentIds: { id: string; profile: { dailyMin: number; dailyMax: number } }[] = [];

  for (const agent of AGENTS) {
    const existing = await prisma.user.findUnique({ where: { email: agent.email } });
    let userId: string;
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "sales_rep" } });
      userId = existing.id;
    } else {
      const created = await prisma.user.create({
        data: { name: agent.name, email: agent.email, password, role: "sales_rep" },
      });
      userId = created.id;
    }
    agentIds.push({ id: userId, profile: agent.callsProfile });
  }

  /* 4. Generate 90 days of call logs per agent */
  console.log("  Generating call logs (90 days)...");
  // Delete existing dummy call logs for these agents
  await prisma.callLog.deleteMany({ where: { agentId: { in: agentIds.map((a) => a.id) } } });

  const allCallLogs: {
    agentId: string; contactName: string; contactPhone: string;
    direction: "inbound" | "outbound"; durationSecs: number;
    status: "completed" | "missed" | "voicemail" | "no_answer"; calledAt: Date;
  }[] = [];

  for (const agent of agentIds) {
    for (let day = 89; day >= 0; day--) {
      // Agents don't call on weekends as much
      const date = new Date();
      date.setDate(date.getDate() - day);
      const dow = date.getDay(); // 0=Sun, 6=Sat
      const isWeekend = dow === 0 || dow === 6;
      const callsToday = isWeekend
        ? randInt(0, Math.floor(agent.profile.dailyMax * 0.3))
        : randInt(agent.profile.dailyMin, agent.profile.dailyMax);

      for (let c = 0; c < callsToday; c++) {
        const calledAt = new Date(date);
        calledAt.setHours(randInt(8, 18), randInt(0, 59), randInt(0, 59), 0);
        const status = CALL_STATUSES[randInt(0, CALL_STATUSES.length - 1)];
        allCallLogs.push({
          agentId: agent.id,
          contactName: CONTACT_NAMES[randInt(0, CONTACT_NAMES.length - 1)],
          contactPhone: CONTACT_PHONES[randInt(0, CONTACT_PHONES.length - 1)],
          direction: Math.random() > 0.85 ? "inbound" : "outbound",
          durationSecs: status === "completed" ? randInt(30, 480) : randInt(0, 30),
          status,
          calledAt,
        });
      }
    }
  }

  // Batch insert
  await prisma.callLog.createMany({ data: allCallLogs });
  console.log(`  Created ${allCallLogs.length} call logs`);

  /* 5. Assign TaskProgress for each agent × each task */
  console.log("  Assigning task progress...");
  await prisma.taskProgress.deleteMany({ where: { userId: { in: agentIds.map((a) => a.id) } } });

  for (const agent of agentIds) {
    // Count calls today for daily tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const callsToday = await prisma.callLog.count({
      where: { agentId: agent.id, calledAt: { gte: today } },
    });

    // Count calls this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const callsThisWeek = await prisma.callLog.count({
      where: { agentId: agent.id, calledAt: { gte: weekStart } },
    });

    // Count calls this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const callsThisMonth = await prisma.callLog.count({
      where: { agentId: agent.id, calledAt: { gte: monthStart } },
    });

    for (const task of createdTasks) {
      // Pick appropriate progress based on task
      let progress = 0;
      if (task.targetCalls <= 20) progress = Math.min(callsToday, task.targetCalls);
      else if (task.targetCalls <= 150) progress = Math.min(callsThisWeek, task.targetCalls);
      else progress = Math.min(callsThisMonth, task.targetCalls);

      const completed = progress >= task.targetCalls;
      await prisma.taskProgress.create({
        data: {
          userId: agent.id,
          taskId: task.id,
          callCount: progress,
          completed,
          completedAt: completed ? new Date() : null,
        },
      });
    }
  }

  /* 6. Assign badges based on actual performance */
  console.log("  Assigning badges...");
  await prisma.userBadge.deleteMany({ where: { userId: { in: agentIds.map((a) => a.id) } } });

  for (const agent of agentIds) {
    const totalCalls = await prisma.callLog.count({ where: { agentId: agent.id } });
    const today2 = new Date(); today2.setHours(0,0,0,0);
    const callsToday2 = await prisma.callLog.count({ where: { agentId: agent.id, calledAt: { gte: today2 } } });
    const weekStart2 = new Date(); weekStart2.setDate(weekStart2.getDate() - 7); weekStart2.setHours(0,0,0,0);
    const callsWeek = await prisma.callLog.count({ where: { agentId: agent.id, calledAt: { gte: weekStart2 } } });
    const monthStart2 = new Date(); monthStart2.setDate(1); monthStart2.setHours(0,0,0,0);
    const callsMonth = await prisma.callLog.count({ where: { agentId: agent.id, calledAt: { gte: monthStart2 } } });

    const earned: string[] = [];
    if (totalCalls >= 1)    earned.push("first_call");
    if (callsToday2 >= 10)  earned.push("daily_10");
    if (callsToday2 >= 20)  earned.push("daily_20");
    if (callsWeek >= 50)    earned.push("weekly_50");
    if (callsWeek >= 100)   earned.push("weekly_100");
    if (callsMonth >= 200)  earned.push("monthly_200");

    for (const key of earned) {
      if (badgeMap[key]) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: agent.id, badgeId: badgeMap[key] } },
          update: {},
          create: { userId: agent.id, badgeId: badgeMap[key] },
        });
      }
    }

    // Update user points
    const points = earned.length * 25 + Math.floor(totalCalls * 0.5);
    await prisma.user.update({ where: { id: agent.id }, data: { points } });
  }

  console.log("✅ Seed complete!");
  console.log("\nMarketing team accounts (password: password123):");
  for (const a of AGENTS) console.log(`  ${a.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
