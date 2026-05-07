import { prisma } from "@/lib/prisma";
import type { NotifType } from "@/generated/prisma/enums";
import { emitNotification, emitNotificationToMany } from "@/lib/socket/emit";

export async function createNotification(data: {
  userId: string;
  type?: NotifType;
  title: string;
  message?: string;
  link?: string;
}) {
  const notif = await prisma.dbNotification.create({ data: { type: "info", ...data } });
  emitNotification(data.userId, notif);
  return notif;
}

export async function createNotificationsForRole(
  roles: string[],
  data: { type?: NotifType; title: string; message?: string; link?: string },
  excludeUserId?: string
) {
  const users = await prisma.user.findMany({
    where: {
      role: { in: roles as ("boss" | "admin" | "sales_rep" | "lead_specialist")[] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (users.length === 0) return;
  const createdAt = new Date();
  await prisma.dbNotification.createMany({
    data: users.map((u) => ({ userId: u.id, type: "info" as NotifType, ...data, createdAt })),
  });
  // Fetch back the created records so each socket emit carries the real DB id
  const created = await prisma.dbNotification.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      title: data.title,
      createdAt,
    },
    select: { id: true, userId: true },
  });
  const payload = {
    type: data.type ?? "info",
    title: data.title,
    message: data.message ?? null,
    link: data.link ?? null,
    read: false,
    createdAt,
  };
  for (const row of created) {
    emitNotification(row.userId, { ...payload, id: row.id });
  }
}

export async function getUserNotifications(userId: string) {
  return prisma.dbNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.dbNotification.updateMany({ where: { id, userId }, data: { read: true } });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.dbNotification.updateMany({ where: { userId, read: false }, data: { read: true } });
}

export async function clearNotifications(userId: string) {
  return prisma.dbNotification.deleteMany({ where: { userId } });
}
