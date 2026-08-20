"use server";

import { requireAuth, requireRole } from "@/lib/rbac/guards";
import { createFeedback, updateFeedbackStatus, addFeedbackComment } from "@/lib/feedback/service";
import { withDbRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { FeedbackType, FeedbackStatus } from "@/generated/prisma/enums";

export async function submitFeedbackAction(formData: FormData) {
  const session = await requireAuth();

  const type        = formData.get("type")        as FeedbackType;
  const title       = formData.get("title")       as string;
  const description = formData.get("description") as string;
  const priority    = (formData.get("priority") as string) ?? "medium";

  if (!type || !title?.trim() || !description?.trim()) {
    return { error: "All fields are required." };
  }

  await withDbRetry(() =>
    createFeedback({ type, title: title.trim(), description: description.trim(), priority, submittedBy: session.user.id! })
  );

  revalidatePath("/feedback");
  return { success: true };
}

export async function updateFeedbackStatusAction(id: string, status: FeedbackStatus) {
  await requireRole("boss", "admin");
  await withDbRetry(() => updateFeedbackStatus(id, status));
  revalidatePath("/feedback");
  return { success: true };
}

export async function addFeedbackCommentAction(reportId: string, content: string) {
  const session = await requireAuth();
  if (!content?.trim()) return { error: "Comment cannot be empty." };

  const comment = await withDbRetry(() =>
    addFeedbackComment(reportId, session.user.id!, content.trim())
  );

  revalidatePath("/feedback");
  return { success: true, comment };
}
