import type { Server as SocketIOServer } from "socket.io";

function getIO(): SocketIOServer | null {
  return (global as Record<string, unknown>).__socketIO as SocketIOServer | null ?? null;
}

export type NotifPayload = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

export function emitNotification(userId: string, notif: NotifPayload) {
  const io = getIO();
  if (!io) return;
  io.to(`user:${userId}`).emit("notification", notif);
}

export function emitNotificationToMany(userIds: string[], notif: NotifPayload) {
  const io = getIO();
  if (!io) return;
  for (const uid of userIds) {
    io.to(`user:${uid}`).emit("notification", notif);
  }
}
