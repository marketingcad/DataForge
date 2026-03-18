import { prisma } from "@/lib/prisma";
import type { NotifType } from "@/generated/prisma/enums";

export async function createNotification(data: {
  userId: string;
  type?: NotifType;
  title: string;
  message?: string;
  link?: string;
}) {
  return prisma.dbNotification.create({ data: { type: "info", ...data } });
}

export async function createNotificationsForRole(
  roles: string[],
  data: { type?: NotifType; title: string; message?: string; link?: string }
) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles as ("boss" | "admin" | "sales_rep" | "lead_specialist")[] } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.dbNotification.createMany({
    data: users.map((u) => ({ userId: u.id, type: "info" as NotifType, ...data })),
  });
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
