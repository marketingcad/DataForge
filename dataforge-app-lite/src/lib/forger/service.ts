import { prisma } from "@/lib/prisma";

// Persistence for Forger chats. DataForge owns the history (not the model), so a
// user can leave and come back and we only re-send a trimmed window to the API.

export async function listConversations(userId: string) {
  return prisma.forgerConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
    take: 50,
  });
}

export async function createConversation(userId: string, title = "New chat") {
  return prisma.forgerConversation.create({
    data: { userId, title },
    select: { id: true, title: true, updatedAt: true },
  });
}

/** Fetch a conversation's messages, verifying it belongs to the user. */
export async function getConversationMessages(conversationId: string, userId: string) {
  const convo = await prisma.forgerConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
  if (!convo) return null;
  return prisma.forgerMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  });
}

export async function addMessage(conversationId: string, role: "user" | "assistant", content: string) {
  const [msg] = await Promise.all([
    prisma.forgerMessage.create({ data: { conversationId, role, content } }),
    prisma.forgerConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  return msg;
}

export async function renameConversation(conversationId: string, userId: string, title: string) {
  return prisma.forgerConversation.updateMany({
    where: { id: conversationId, userId },
    data: { title: title.slice(0, 80) },
  });
}

export async function deleteConversation(conversationId: string, userId: string) {
  return prisma.forgerConversation.deleteMany({ where: { id: conversationId, userId } });
}

export async function deleteAllConversations(userId: string) {
  // Messages cascade-delete with their conversation.
  return prisma.forgerConversation.deleteMany({ where: { userId } });
}

/** Verify ownership and return the conversation (or null). */
export async function getOwnedConversation(conversationId: string, userId: string) {
  return prisma.forgerConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true },
  });
}
