import { prisma } from "@/lib/prisma";

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, role: true } },
};

const ROOM_INCLUDE = {
  members: { include: { user: { select: { id: true, name: true, role: true } } } },
  _count:  { select: { messages: true } },
};

// ── Rooms ────────────────────────────────────────────────────────────────────

export async function getChatRooms(userId: string) {
  // General room is visible to all; group rooms show ones the user is a member of
  return prisma.chatRoom.findMany({
    where: {
      OR: [
        { type: "general" },
        { members: { some: { userId } } },
      ],
    },
    include: ROOM_INCLUDE,
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
}

export async function createChatRoom(name: string, createdById: string, memberIds: string[]) {
  const room = await prisma.chatRoom.create({
    data: {
      name,
      type: "group",
      createdById,
      members: {
        create: [
          { userId: createdById },
          ...memberIds.filter((id) => id !== createdById).map((userId) => ({ userId })),
        ],
      },
    },
    include: ROOM_INCLUDE,
  });
  return room;
}

export async function getOrCreateGeneralRoom(fallbackUserId: string) {
  const existing = await prisma.chatRoom.findFirst({ where: { type: "general" } });
  if (existing) return existing;
  return prisma.chatRoom.create({
    data: { name: "General", type: "general", createdById: fallbackUserId },
  });
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getChatMessages(roomId: string, limit = 100) {
  return prisma.chatMessage.findMany({
    where: { roomId },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function getChatMessagesSince(roomId: string, since: Date) {
  return prisma.chatMessage.findMany({
    where: { roomId, createdAt: { gt: since } },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

export async function sendChatMessage(content: string, senderId: string, roomId: string) {
  return prisma.chatMessage.create({
    data: { content, senderId, roomId },
    include: MESSAGE_INCLUDE,
  });
}

export async function getAllUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}
