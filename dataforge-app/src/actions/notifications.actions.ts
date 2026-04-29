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
  try {
    const session = await requireAuth();
    const notifs = await withDbRetry(() => getUserNotifications(session.user.id!));
    return { notifications: notifs };
  } catch {
    return { notifications: [] };
  }
}

export async function markReadAction(id: string) {
  try {
    const session = await requireAuth();
    await withDbRetry(() => markNotificationRead(id, session.user.id!));
  } catch { /* ignore */ }
  return { success: true };
}

export async function markAllReadAction() {
  try {
    const session = await requireAuth();
    await withDbRetry(() => markAllNotificationsRead(session.user.id!));
  } catch { /* ignore */ }
  return { success: true };
}

export async function clearAllNotificationsAction() {
  try {
    const session = await requireAuth();
    await withDbRetry(() => clearNotifications(session.user.id!));
  } catch { /* ignore */ }
  return { success: true };
}
