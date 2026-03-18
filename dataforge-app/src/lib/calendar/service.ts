import { prisma } from "@/lib/prisma";

export async function getCalendarEvents(month?: { year: number; month: number }) {
  const where = month
    ? {
        startDate: {
          gte: new Date(month.year, month.month - 1, 1),
          lt:  new Date(month.year, month.month, 1),
        },
      }
    : undefined;

  return prisma.calendarEvent.findMany({
    where,
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { startDate: "asc" },
  });
}

export async function createCalendarEvent(data: {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  color?: string;
  createdById: string;
}) {
  return prisma.calendarEvent.create({ data });
}

export async function deleteCalendarEvent(id: string) {
  return prisma.calendarEvent.delete({ where: { id } });
}
