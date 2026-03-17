"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { toast } from "sonner";

export type NotifType = "success" | "error" | "info" | "warning";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  message?: string;
  read: boolean;
  createdAt: Date;
}

interface NotifCtx {
  notifications: AppNotification[];
  unreadCount: number;
  add: (n: Omit<AppNotification, "id" | "read" | "createdAt">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const NotifContext = createContext<NotifCtx | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const add = useCallback((n: Omit<AppNotification, "id" | "read" | "createdAt">) => {
    const notif: AppNotification = {
      ...n,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date(),
    };
    setNotifications((prev) => [notif, ...prev]);

    // Fire the bottom-right sonner popup
    const fn =
      n.type === "error"   ? toast.error   :
      n.type === "warning" ? toast.warning :
      n.type === "info"    ? toast.info    :
      toast.success;
    fn(n.title, n.message ? { description: n.message } : undefined);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, add, markRead, markAllRead, clear }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
