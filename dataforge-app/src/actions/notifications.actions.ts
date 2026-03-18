"use server";

import { requireAuth } from "@/lib/rbac/guards";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
} from "@/lib/notifications/service";
import { withDbRetry } from "@/lib/prisma";

export async function getMyNotificationsAction() {
  const session = await requireAuth();
  const notifs = await withDbRetry(() => getUserNotifications(session.user.id!));
  return { notifications: notifs };
}

export async function markReadAction(id: string) {
  const session = await requireAuth();
  await withDbRetry(() => markNotificationRead(id, session.user.id!));
  return { success: true };
}

export async function markAllReadAction() {
  const session = await requireAuth();
  await withDbRetry(() => markAllNotificationsRead(session.user.id!));
  return { success: true };
}

export async function clearAllNotificationsAction() {
  const session = await requireAuth();
  await withDbRetry(() => clearNotifications(session.user.id!));
  return { success: true };
}
