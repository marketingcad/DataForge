"use server";

import { requireRole, requireAuth } from "@/lib/rbac/guards";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar/service";
import { withDbRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createEventAction(data: {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  allDay?: boolean;
  color?: string;
}) {
  const user = await requireRole("boss", "admin");

  if (!data.title?.trim() || !data.startDate) return { error: "Title and date are required." };

  await withDbRetry(() =>
    createCalendarEvent({
      ...data,
      title: data.title.trim(),
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      createdById: user.id,
    })
  );

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteEventAction(id: string) {
  await requireRole("boss", "admin");
  await withDbRetry(() => deleteCalendarEvent(id));
  revalidatePath("/calendar");
  return { success: true };
}
