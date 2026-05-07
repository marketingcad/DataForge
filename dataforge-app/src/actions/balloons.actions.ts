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
  let rules = { enabled: true, apptsPerPoint: 1 };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = await (prisma as any).appSettings.findUnique({
      where: { id: "singleton" },
      select: { balloonEnabled: true, balloonApptsPerPoint: true },
    });
    if (settings) {
      rules = { enabled: settings.balloonEnabled ?? true, apptsPerPoint: settings.balloonApptsPerPoint ?? 1 };
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
      data: { isPopped: true, poppedById: user.id, poppedAt: new Date(), isPaid: false, paidAt: null, paidById: null, paymentNote: null },
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

export async function updateBalloonRuleAction(field: "enabled" | "apptsPerPoint", value: boolean | number) {
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
    const n = Math.max(1, Math.round(value as number));
    await db.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", balloonApptsPerPoint: n },
      update: { balloonApptsPerPoint: n },
    });
    await writeAuditLog(actor.id, `${actorLabel} set appointments per balloon point to ${n}`);
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

export async function adjustBalloonPointsAction(userId: string, delta: number, reason?: string) {
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
  const reasonSuffix = reason?.trim() ? ` — Reason: ${reason.trim()}` : "";
  await writeAuditLog(actor.id, `${actorLabel} adjusted points for ${targetLabel}: ${sign} (${beforePts} → ${updated.balloonPoints})${reasonSuffix}`);

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

// ── ADMIN: PAYMENT TRACKING ───────────────────────────────────────────────────

export async function markBalloonPaymentAction(balloonId: string, isPaid: boolean, note?: string) {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  const balloon = await prisma.balloon.findUnique({
    where: { id: balloonId },
    include: { poppedBy: { select: { name: true, nickname: true } } },
  });
  if (!balloon || !balloon.isPopped) throw new Error("Balloon not found or not popped");

  await prisma.balloon.update({
    where: { id: balloonId },
    data: {
      isPaid,
      paidAt:      isPaid ? new Date() : null,
      paidById:    isPaid ? actor.id   : null,
      paymentNote: note?.trim() ?? balloon.paymentNote,
    },
  });

  const repName = balloon.poppedBy?.nickname ?? balloon.poppedBy?.name ?? "unknown";
  const detail = isPaid
    ? `${actorLabel} marked prize for ${repName} (balloon #${balloon.position} — ${balloon.prize}) as PAID${note?.trim() ? ` — Note: ${note.trim()}` : ""}`
    : `${actorLabel} marked prize for ${repName} (balloon #${balloon.position} — ${balloon.prize}) as UNPAID`;

  await writeAuditLog(actor.id, detail);
  revalidatePath("/admin/balloons");
  return { success: true };
}

export async function setBalloonPaymentNoteAction(balloonId: string, note: string) {
  const actor = await requireBossAdmin();
  const actorLabel = actor.name ?? actor.email ?? actor.id;

  const balloon = await prisma.balloon.findUnique({ where: { id: balloonId }, select: { position: true, prize: true } });
  await prisma.balloon.update({ where: { id: balloonId }, data: { paymentNote: note.trim() || null } });

  await writeAuditLog(actor.id, `${actorLabel} updated note on balloon #${balloon?.position} — "${note.trim()}"`);
  revalidatePath("/admin/balloons");
  return { success: true };
}

export async function getPayoutsAction() {
  await requireBossAdmin();
  return prisma.balloon.findMany({
    where: { isPopped: true },
    orderBy: { poppedAt: "desc" },
    include: {
      poppedBy: { select: { id: true, name: true, nickname: true, email: true } },
      paidBy:   { select: { id: true, name: true, nickname: true } },
    },
  });
}

export async function getMyPopsAction() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !["sales_rep", "team_lead"].includes(user.role ?? "")) return [];
  return prisma.balloon.findMany({
    where: { poppedById: user.id, isPopped: true },
    orderBy: { poppedAt: "desc" },
    select: {
      id: true, position: true, prize: true,
      poppedAt: true, isPaid: true, paidAt: true, paymentNote: true,
      paidBy: { select: { name: true, nickname: true } },
    },
  });
}

// ── AWARD POINT (called internally when appointment booked) ───────────────────

export async function awardBalloonPointAction(agentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  let settings: { balloonEnabled?: boolean; balloonApptsPerPoint?: number } | null = null;
  try {
    settings = await db.appSettings.findUnique({
      where: { id: "singleton" },
      select: { balloonApptsPerPoint: true, balloonEnabled: true },
    });
  } catch { /* columns not yet migrated */ }
  if (settings?.balloonEnabled === false) return;
  const apptsPerPoint = settings?.balloonApptsPerPoint ?? 1;

  // Read daily tracking fields
  let prevCount = 0;
  let windowStart: Date | null = null;
  try {
    const u = await db.user.findUnique({
      where: { id: agentId },
      select: { balloonDailyApptCount: true, balloonDailyWindowStart: true },
    });
    if (u) {
      prevCount = u.balloonDailyApptCount ?? 0;
      windowStart = u.balloonDailyWindowStart ?? null;
    }
  } catch { /* columns not yet migrated */ }

  const now = new Date();
  const windowAlive = windowStart !== null && (now.getTime() - new Date(windowStart).getTime()) < 24 * 60 * 60 * 1000;
  const baseCount = windowAlive ? prevCount : 0;
  const newCount  = baseCount + 1;

  // Every Nth appointment in the window earns 1 point (floor division trick)
  const pointsToAward = Math.floor(newCount / apptsPerPoint) - Math.floor(baseCount / apptsPerPoint);

  const updateData: Record<string, unknown> = { balloonDailyApptCount: newCount };
  if (!windowAlive) updateData.balloonDailyWindowStart = now;
  if (pointsToAward > 0) updateData.balloonPoints = { increment: pointsToAward };

  try {
    await db.user.update({ where: { id: agentId }, data: updateData });
  } catch {
    // Fallback: new tracking columns not yet in DB — award 1 point per appointment
    await prisma.user.update({ where: { id: agentId }, data: { balloonPoints: { increment: 1 } } });
  }
}
