"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { Bell, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getMyNotificationsAction,
  markReadAction,
  markAllReadAction,
  clearAllNotificationsAction,
} from "@/actions/notifications.actions";
import Link from "next/link";

type DbNotif = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

const TYPE_DOT: Record<string, string> = {
  success: "bg-emerald-500",
  error:   "bg-rose-500",
  warning: "bg-amber-500",
  info:    "bg-blue-500",
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<DbNotif[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    const res = await getMyNotificationsAction();
    setNotifications(res.notifications as DbNotif[]);
  }, []);

  // Initial load
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Poll every 8 seconds
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    startTransition(async () => { await markReadAction(id); });
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(async () => { await markAllReadAction(); });
  }

  function handleClear() {
    setNotifications([]);
    startTransition(async () => { await clearAllNotificationsAction(); });
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-lg border bg-popover shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-1 leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground" onClick={handleMarkAllRead}>
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleClear} title="Clear all">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/60">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 text-muted-foreground/15" />
                <p className="text-xs">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={cn("px-4 py-3 cursor-pointer transition-colors hover:bg-accent", !n.read && "bg-primary/5")}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", TYPE_DOT[n.type] ?? "bg-blue-500")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-tight">{n.title}</p>
                        {!n.read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      {n.message && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.message}</p>}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-muted-foreground/50">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                        {n.link && (
                          <Link href={n.link} onClick={(e) => e.stopPropagation()} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                            View <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
