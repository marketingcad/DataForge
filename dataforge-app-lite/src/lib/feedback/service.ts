import { prisma } from "@/lib/prisma";
import type { FeedbackType, FeedbackStatus } from "@/generated/prisma/enums";

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, email: true, role: true } },
};

const REPORT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, role: true } },
  comments: { include: COMMENT_INCLUDE, orderBy: { createdAt: "asc" as const } },
};

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
    include: REPORT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getFeedbackReport(id: string) {
  return prisma.feedbackReport.findUniqueOrThrow({ where: { id }, include: REPORT_INCLUDE });
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  return prisma.feedbackReport.update({ where: { id }, data: { status } });
}

export async function addFeedbackComment(reportId: string, authorId: string, content: string) {
  return prisma.feedbackComment.create({
    data: { reportId, authorId, content },
    include: COMMENT_INCLUDE,
  });
}
