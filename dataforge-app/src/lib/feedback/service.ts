import { prisma } from "@/lib/prisma";
import type { FeedbackType, FeedbackStatus } from "@/generated/prisma/enums";

export async function createFeedback(data: {
  type: FeedbackType;
  title: string;
  description: string;
  priority?: string;
  submittedBy: string;
}) {
  return prisma.feedbackReport.create({ data });
}

export async function getFeedback(opts?: { submittedBy?: string }) {
  return prisma.feedbackReport.findMany({
    where: opts?.submittedBy ? { submittedBy: opts.submittedBy } : undefined,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  return prisma.feedbackReport.update({ where: { id }, data: { status } });
}
