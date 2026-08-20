"use server";

import { auth } from "@/lib/auth";
import {
  listConversations, createConversation, getConversationMessages,
  deleteConversation, deleteAllConversations, renameConversation,
} from "@/lib/forger/service";

// Forger is available to boss + admin only.
async function requireForgerUser(): Promise<string> {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user?.id || !role || !["boss", "admin"].includes(role)) {
    throw new Error("Not authorized");
  }
  return session.user.id as string;
}

export async function getForgerConversationsAction() {
  const userId = await requireForgerUser();
  return listConversations(userId);
}

export async function createForgerConversationAction() {
  const userId = await requireForgerUser();
  return createConversation(userId);
}

export async function getForgerMessagesAction(conversationId: string) {
  const userId = await requireForgerUser();
  return (await getConversationMessages(conversationId, userId)) ?? [];
}

export async function deleteForgerConversationAction(conversationId: string) {
  const userId = await requireForgerUser();
  await deleteConversation(conversationId, userId);
  return { success: true };
}

export async function deleteAllForgerConversationsAction() {
  const userId = await requireForgerUser();
  await deleteAllConversations(userId);
  return { success: true };
}

export async function renameForgerConversationAction(conversationId: string, title: string) {
  const userId = await requireForgerUser();
  await renameConversation(conversationId, userId, title);
  return { success: true };
}
