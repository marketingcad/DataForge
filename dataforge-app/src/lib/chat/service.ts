import { prisma } from "@/lib/prisma";

export async function getChatMessages(limit = 50) {
  return prisma.chatMessage.findMany({
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function getChatMessagesSince(since: Date) {
  return prisma.chatMessage.findMany({
    where: { createdAt: { gt: since } },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function sendChatMessage(content: string, senderId: string) {
  return prisma.chatMessage.create({
    data: { content, senderId },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
}
