"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotificationsForRole } from "@/lib/notifications/service";

async function requireBossAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string; email?: string } | undefined;
  if (!user?.id || !["boss", "admin"].includes(user.role ?? "")) {
    throw new Error("Unauthorized");
  }
  return user as { id: string; role: string; name?: string; email?: string };
}

async function requireSalesOrLead() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !["sales_rep", "team_lead", "boss", "admin"].includes(user.role ?? "")) {
    throw new Error("Unauthorized");
  }
  return user as { id: string; role: string };
}

async function writeAuditLog(actorId: string, detail: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).balloonAuditLog.create({ data: { actorId, detail } });
  } catch {
    // Silently skip if table not yet created
  }
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

  // Graceful fallback while new columns are pending migration
  let rules = { enabled: true, pointsPerAppointment: 1 };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = await (prisma as any).appSettings.findUnique({
      where: { id: "singleton" },
      select: { balloonEnabled: true, balloonPointsPerAppointment: true },
    });
    if (settings) {
      rules = { enabled: settings.balloonEnabled ?? true, pointsPerAppointment: settings.balloonPointsPerAppointment ?? 1 };
    }
  } catch {
    // Columns not yet migrated — use defaults
  }

  let auditLogs: { id: string; detail: string; createdAt: Date; actor: { name: string | null; email: string } }[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditLogs = await (prisma as any).balloonAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { name: true, email: true } } },
    });
  } catch {
    // Table not yet created — return empty log
  }

  return { balloons, reps, rules, auditLogs };
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

  let balloonEnabled = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = await (prisma as any).appSettings.findUnique({ where: { id: "singleton" }, select: { balloonEnabled: true } });
    if (settings?.balloonEnabled === false) balloonEnabled = false;
  } catch { /* columns not yet migrated */ }
  if (!balloonEnabled) return { error: "Balloon Pop is currently disabled." };

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

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { balloonPoints: { decrement: 1 } } }),
    prisma.balloon.update({
      where: { id: balloonId },
      data: { isPopped: true, poppedById: user.id, poppedAt: new Date() },
    }),
  ]);

  const displayName = dbUser.nickname ?? dbUser.name ?? "Someone";

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

// ── ADMIN: RULES ──────────────────────────────────────────────────────────────

export async function updateBalloonRuleAction(field: "enabled" | "pointsPerAppointment", value: boolean | number) {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  if (field === "enabled") {
    await db.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", balloonEnabled: value as boolean },
      update: { balloonEnabled: value as boolean },
    });
    await writeAuditLog(actor.id, `${actorLabel} ${value ? "enabled" : "disabled"} balloon pop`);
  } else {
    const pts = Math.max(1, Math.round(value as number));
    await db.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", balloonPointsPerAppointment: pts },
      update: { balloonPointsPerAppointment: pts },
    });
    await writeAuditLog(actor.id, `${actorLabel} set points per appointment to ${pts}`);
  }

  revalidatePath("/admin/balloons");
}

// ── ADMIN: SET PRIZE ──────────────────────────────────────────────────────────

export async function setBalloonPrizeAction(position: number, prize: string) {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  const existing = await prisma.balloon.findUnique({ where: { position }, select: { prize: true } });

  await prisma.balloon.upsert({
    where: { position },
    create: { position, prize },
    update: { prize },
  });

  const oldPrize = existing?.prize?.trim();
  const newPrize = prize.trim();
  const detail = oldPrize
    ? `${actorLabel} changed prize on #${position} from "${oldPrize}" to "${newPrize}"`
    : `${actorLabel} set prize on #${position} to "${newPrize}"`;

  await writeAuditLog(actor.id, detail);
  revalidatePath("/admin/balloons");
  revalidatePath("/balloons");
  return { success: true };
}

// ── ADMIN: RESET BALLOONS ─────────────────────────────────────────────────────

export async function resetBalloonAction(balloonId: string) {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  const balloon = await prisma.balloon.findUnique({
    where: { id: balloonId },
    include: { poppedBy: { select: { name: true, nickname: true } } },
  });

  await prisma.balloon.update({
    where: { id: balloonId },
    data: { isPopped: false, poppedById: null, poppedAt: null },
  });

  const winner = balloon?.poppedBy?.nickname ?? balloon?.poppedBy?.name;
  const detail = winner
    ? `${actorLabel} reset balloon #${balloon?.position ?? "?"} (was won by ${winner})`
    : `${actorLabel} reset balloon #${balloon?.position ?? "?"}`;

  await writeAuditLog(actor.id, detail);
  revalidatePath("/admin/balloons");
  revalidatePath("/balloons");
  return { success: true };
}

export async function resetAllBalloonsAction() {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  await prisma.balloon.updateMany({
    data: { isPopped: false, poppedById: null, poppedAt: null },
  });

  await writeAuditLog(actor.id, `${actorLabel} reset all 16 balloons`);
  revalidatePath("/admin/balloons");
  revalidatePath("/balloons");
  return { success: true };
}

// ── ADMIN: MANAGE REP POINTS ──────────────────────────────────────────────────

export async function adjustBalloonPointsAction(userId: string, delta: number) {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { balloonPoints: true, name: true, nickname: true, email: true } });
  const beforePts = before?.balloonPoints ?? 0;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { balloonPoints: { increment: delta } },
    select: { balloonPoints: true },
  });

  const targetLabel = before?.nickname ?? before?.name ?? before?.email ?? userId;
  const sign = delta >= 0 ? `+${delta}` : `${delta}`;
  await writeAuditLog(actor.id, `${actorLabel} adjusted points for ${targetLabel}: ${sign} (${beforePts} → ${updated.balloonPoints})`);

  revalidatePath("/admin/balloons");
  return { success: true, newPoints: updated.balloonPoints };
}

// ── ADMIN: SUSPEND REP FROM POPPING ───────────────────────────────────────────

export async function setBalloonSuspensionAction(userId: string, until: Date | null) {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, nickname: true, email: true } });
  const targetLabel = target?.nickname ?? target?.name ?? target?.email ?? userId;

  await prisma.user.update({
    where: { id: userId },
    data: { balloonSuspendedUntil: until },
  });

  const detail = until
    ? `${actorLabel} suspended ${targetLabel} from popping until ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : `${actorLabel} lifted suspension for ${targetLabel}`;

  await writeAuditLog(actor.id, detail);
  revalidatePath("/admin/balloons");
  return { success: true };
}

// ── AWARD POINT (called internally when appointment booked) ───────────────────

export async function awardBalloonPointAction(agentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let settings: { balloonEnabled?: boolean; balloonPointsPerAppointment?: number } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settings = await (prisma as any).appSettings.findUnique({
      where: { id: "singleton" },
      select: { balloonPointsPerAppointment: true, balloonEnabled: true },
    });
  } catch { /* columns not yet migrated */ }
  if (settings?.balloonEnabled === false) return;
  const pts = settings?.balloonPointsPerAppointment ?? 1;
  await prisma.user.update({
    where: { id: agentId },
    data: { balloonPoints: { increment: pts } },
  });
}
