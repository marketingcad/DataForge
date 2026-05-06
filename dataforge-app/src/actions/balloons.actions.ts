"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotificationsForRole } from "@/lib/notifications/service";

async function requireBossAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !["boss", "admin"].includes(user.role ?? "")) {
    throw new Error("Unauthorized");
  }
  return user as { id: string; role: string };
}

async function requireSalesOrLead() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !["sales_rep", "team_lead", "boss", "admin"].includes(user.role ?? "")) {
    throw new Error("Unauthorized");
  }
  return user as { id: string; role: string };
}

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getBalloonsAction() {
  await requireSalesOrLead();
  return prisma.balloon.findMany({ orderBy: { position: "asc" }, include: { poppedBy: { select: { id: true, name: true, nickname: true } } } });
}

export async function getMyBalloonPointsAction() {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) return 0;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { balloonPoints: true } });
  return dbUser?.balloonPoints ?? 0;
}

export async function getBalloonAdminDataAction() {
  await requireBossAdmin();
  const [balloons, reps] = await Promise.all([
    prisma.balloon.findMany({ orderBy: { position: "asc" }, include: { poppedBy: { select: { id: true, name: true, nickname: true } } } }),
    prisma.user.findMany({
      where: { role: { in: ["sales_rep", "team_lead"] } },
      select: { id: true, name: true, nickname: true, email: true, role: true, balloonPoints: true, balloonSuspendedUntil: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { balloons, reps };
}

export async function getRecentPopsAction(limit = 10) {
  await requireSalesOrLead();
  return prisma.balloon.findMany({
    where: { isPopped: true },
    orderBy: { poppedAt: "desc" },
    take: limit,
    include: { poppedBy: { select: { id: true, name: true, nickname: true } } },
  });
}

// ── POP BALLOON ───────────────────────────────────────────────────────────────

export async function popBalloonAction(balloonId: string) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  if (!user?.id || !["sales_rep", "team_lead"].includes(user.role ?? "")) {
    return { error: "Only sales reps and team leads can pop balloons." };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { balloonPoints: true, balloonSuspendedUntil: true, name: true, nickname: true },
  });
  if (!dbUser) return { error: "User not found." };

  if (dbUser.balloonSuspendedUntil && dbUser.balloonSuspendedUntil > new Date()) {
    return { error: `You are suspended from popping balloons until ${dbUser.balloonSuspendedUntil.toLocaleDateString()}.` };
  }
  if (dbUser.balloonPoints < 1) {
    return { error: "You need at least 1 balloon point to pop a balloon." };
  }

  const balloon = await prisma.balloon.findUnique({ where: { id: balloonId } });
  if (!balloon) return { error: "Balloon not found." };
  if (balloon.isPopped) return { error: "This balloon has already been popped." };
  if (!balloon.prize) return { error: "This balloon has no prize set yet." };

  // Atomic: deduct point + mark popped
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { balloonPoints: { decrement: 1 } } }),
    prisma.balloon.update({
      where: { id: balloonId },
      data: { isPopped: true, poppedById: user.id, poppedAt: new Date() },
    }),
  ]);

  const displayName = dbUser.nickname ?? dbUser.name ?? "Someone";

  // Notify everyone
  await createNotificationsForRole(
    ["boss", "admin", "sales_rep", "team_lead"],
    {
      type: "info",
      title: `🎈 ${displayName} popped a balloon!`,
      message: `Prize: ${balloon.prize}`,
      link: "/balloons",
    },
    undefined,
  );

  revalidatePath("/balloons");
  revalidatePath("/marketing");
  revalidatePath("/admin/balloons");

  return { success: true, prize: balloon.prize };
}

// ── ADMIN: SET PRIZE ──────────────────────────────────────────────────────────

export async function setBalloonPrizeAction(position: number, prize: string) {
  await requireBossAdmin();

  await prisma.balloon.upsert({
    where: { position },
    create: { position, prize },
    update: { prize },
  });

  revalidatePath("/admin/balloons");
  revalidatePath("/balloons");
  return { success: true };
}

// ── ADMIN: RESET BALLOONS ─────────────────────────────────────────────────────

export async function resetBalloonAction(balloonId: string) {
  await requireBossAdmin();
  await prisma.balloon.update({
    where: { id: balloonId },
    data: { isPopped: false, poppedById: null, poppedAt: null },
  });
  revalidatePath("/admin/balloons");
  revalidatePath("/balloons");
  return { success: true };
}

export async function resetAllBalloonsAction() {
  await requireBossAdmin();
  await prisma.balloon.updateMany({
    data: { isPopped: false, poppedById: null, poppedAt: null },
  });
  revalidatePath("/admin/balloons");
  revalidatePath("/balloons");
  return { success: true };
}

// ── ADMIN: MANAGE REP POINTS ──────────────────────────────────────────────────

export async function adjustBalloonPointsAction(userId: string, delta: number) {
  await requireBossAdmin();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { balloonPoints: { increment: delta } },
    select: { balloonPoints: true },
  });
  revalidatePath("/admin/balloons");
  return { success: true, newPoints: updated.balloonPoints };
}

// ── ADMIN: SUSPEND REP FROM POPPING ───────────────────────────────────────────

export async function setBalloonSuspensionAction(userId: string, until: Date | null) {
  await requireBossAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { balloonSuspendedUntil: until },
  });
  revalidatePath("/admin/balloons");
  return { success: true };
}

// ── AWARD POINT (called internally when appointment booked) ───────────────────

export async function awardBalloonPointAction(agentId: string) {
  await prisma.user.update({
    where: { id: agentId },
    data: { balloonPoints: { increment: 1 } },
  });
}
