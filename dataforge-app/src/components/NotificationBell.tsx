"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { Bell, Trash2, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
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

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  success: { bg: "bg-emerald-100 dark:bg-emerald-950/50", text: "text-emerald-700 dark:text-emerald-400", label: "Success" },
  error:   { bg: "bg-rose-100 dark:bg-rose-950/50",     text: "text-rose-700 dark:text-rose-400",     label: "Error"   },
  warning: { bg: "bg-amber-100 dark:bg-amber-950/50",   text: "text-amber-700 dark:text-amber-400",   label: "Warning" },
  info:    { bg: "bg-blue-100 dark:bg-blue-950/50",     text: "text-blue-700 dark:text-blue-400",     label: "Info"    },
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<DbNotif[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DbNotif | null>(null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Track IDs already seen so we can toast only truly new ones.
  // null = not yet initialised (first load — never toast on first load).
  const seenIds = useRef<Set<string> | null>(null);

  const fetchNotifications = useCallback(async () => {
    const res = await getMyNotificationsAction();
    const incoming = res.notifications as DbNotif[];

    if (seenIds.current === null) {
      // First load — just record what exists, no toasts.
      seenIds.current = new Set(incoming.map((n) => n.id));
    } else {
      // Subsequent polls — toast anything we haven't seen before.
      for (const n of incoming) {
        if (!seenIds.current.has(n.id)) {
          seenIds.current.add(n.id);
          const fn =
            n.type === "error"   ? toast.error   :
            n.type === "warning" ? toast.warning  :
            n.type === "success" ? toast.success  :
            toast.info;
          fn(n.title, {
            description: n.message ?? undefined,
            duration: 8000,
            action: n.link
              ? { label: "View", onClick: () => { window.location.href = n.link!; } }
              : undefined,
          });
        }
      }
    }

    setNotifications(incoming);
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

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card shadow-xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full shrink-0", TYPE_DOT[selected.type] ?? "bg-blue-500")} />
                <span className="text-sm font-semibold">Notification</span>
                {(() => {
                  const badge = TYPE_BADGE[selected.type] ?? TYPE_BADGE.info;
                  return (
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", badge.bg, badge.text)}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold leading-snug">{selected.title}</h3>
              {selected.message && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              )}
              <p className="text-xs text-muted-foreground/50">
                {format(new Date(selected.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
              {selected.link && (
                <Link
                  href={selected.link}
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  View details <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

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
                  onClick={() => { setSelected(n); setOpen(false); handleMarkRead(n.id); }}
                  className={cn("px-4 py-3 cursor-pointer transition-colors hover:bg-accent", !n.read && "bg-primary/5")}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", TYPE_DOT[n.type] ?? "bg-blue-500")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-tight">{n.title}</p>
                        {!n.read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      {n.message && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
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
