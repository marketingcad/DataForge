"use server";

import { requireAuth } from "@/lib/rbac/guards";
import { sendChatMessage, getChatMessagesSince, createChatRoom, getChatRooms } from "@/lib/chat/service";
import { withDbRetry } from "@/lib/prisma";

export async function sendMessageAction(content: string, roomId: string) {
  const session = await requireAuth();
  if (!content?.trim()) return { error: "Message cannot be empty." };
  const msg = await withDbRetry(() => sendChatMessage(content.trim(), session.user.id!, roomId));
  return { success: true, message: msg };
}

export async function pollMessagesAction(roomId: string, since: string) {
  await requireAuth();
  const messages = await withDbRetry(() => getChatMessagesSince(roomId, new Date(since)));
  return { messages };
}

export async function createRoomAction(name: string, memberIds: string[]) {
  const session = await requireAuth();
  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "boss" && role !== "admin") return { error: "Only boss/admin can create group chats." };
  if (!name?.trim()) return { error: "Room name is required." };
  const room = await withDbRetry(() => createChatRoom(name.trim(), session.user.id!, memberIds));
  return { success: true, room };
}

export async function getRoomsAction() {
  const session = await requireAuth();
  const rooms = await withDbRetry(() => getChatRooms(session.user.id!));
  return { rooms };
}
