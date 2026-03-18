"use server";

import { requireAuth } from "@/lib/rbac/guards";
import { sendChatMessage, getChatMessagesSince } from "@/lib/chat/service";
import { withDbRetry } from "@/lib/prisma";

export async function sendMessageAction(content: string) {
  const session = await requireAuth();

  if (!content?.trim()) return { error: "Message cannot be empty." };

  const msg = await withDbRetry(() => sendChatMessage(content.trim(), session.user.id!));
  return { success: true, message: msg };
}

export async function pollMessagesAction(since: string) {
  await requireAuth();
  const messages = await withDbRetry(() => getChatMessagesSince(new Date(since)));
  return { messages };
}
