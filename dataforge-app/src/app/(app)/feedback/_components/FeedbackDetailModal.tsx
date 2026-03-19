"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { X, Bug, Lightbulb, Send, ChevronDown, ChevronRight, CheckCircle2, Clock, Circle, XCircle, Loader2, MessageSquare } from "lucide-react";
import { addFeedbackCommentAction, updateFeedbackStatusAction } from "@/actions/feedback.actions";
import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/enums";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string | null; email: string; role: string };
};

type Report = {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string; role: string };
  comments: Comment[];
};

const TYPE_CFG: Record<FeedbackType, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  bug:     { label: "Bug",     bg: "bg-rose-100 dark:bg-rose-950/50",     text: "text-rose-600 dark:text-rose-400",     icon: Bug },
  feature: { label: "Feature", bg: "bg-violet-100 dark:bg-violet-950/50", text: "text-violet-600 dark:text-violet-400", icon: Lightbulb },
};

const PRIORITY_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  high:   { bg: "bg-rose-100 dark:bg-rose-950/50",   text: "text-rose-600 dark:text-rose-400",   dot: "bg-rose-500" },
  medium: { bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  low:    { bg: "bg-sky-100 dark:bg-sky-950/50",     text: "text-sky-600 dark:text-sky-400",     dot: "bg-sky-500" },
};

const STATUS_CFG: Record<FeedbackStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open:      { label: "Open",        icon: Circle,       color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/40" },
  in_review: { label: "In Progress", icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/40" },
  resolved:  { label: "Completed",   icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  closed:    { label: "Rejected",    icon: XCircle,      color: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-950/40" },
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
];

function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string | null, email: string) {
  const n = name ?? email;
  const parts = n.split(/[\s@]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase();
}

function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function Avatar({ name, email, size = "md" }: { name: string | null; email: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  return (
    <div className={`${s} rounded-full ${avatarColor(email)} flex items-center justify-center font-bold text-white shrink-0`}>
      {getInitials(name, email)}
    </div>
  );
}

function Section({ title, badge, defaultOpen = true, children }: {
  title: string; badge?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/40 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge !== undefined && (
            <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
          )}
        </div>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        }
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export function FeedbackDetailModal({
  report: initial,
  index,
  isAdmin,
  onClose,
  onStatusChange,
}: {
  report: Report;
  index: number;
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange?: (id: string, status: FeedbackStatus) => void;
}) {
  const [report, setReport] = useState(initial);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const typeCfg = TYPE_CFG[report.type];
  const TypeIcon = typeCfg.icon;
  const statusCfg = STATUS_CFG[report.status];
  const StatusIcon = statusCfg.icon;
  const priCfg = PRIORITY_CFG[report.priority] ?? PRIORITY_CFG.medium;

  useEffect(() => { setReport(initial); }, [initial]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [report.comments.length]);

  function submitComment() {
    const text = comment.trim();
    if (!text) return;
    setComment("");
    startTransition(async () => {
      const res = await addFeedbackCommentAction(report.id, text);
      if (res.success && res.comment) {
        setReport((prev) => ({ ...prev, comments: [...prev.comments, res.comment as Comment] }));
      }
    });
  }

  function handleStatusChange(status: FeedbackStatus) {
    setReport((prev) => ({ ...prev, status }));
    onStatusChange?.(report.id, status);
    startTransition(async () => { await updateFeedbackStatusAction(report.id, status); });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-[420px] flex flex-col bg-background border-l shadow-2xl animate-in slide-in-from-right duration-200">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            {/* Type badge */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${typeCfg.bg} ${typeCfg.text}`}>
              <TypeIcon className="h-3 w-3" />
              {typeCfg.label}
            </span>
            {/* Priority badge */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${priCfg.bg} ${priCfg.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${priCfg.dot}`} />
              {report.priority.charAt(0).toUpperCase() + report.priority.slice(1)}
            </span>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Title block */}
          <div className="px-5 pt-5 pb-4">
            <p className="text-[11px] font-mono text-muted-foreground/50 mb-1.5">#{String(index).padStart(3, "0")}</p>
            <h2 className="text-lg font-bold leading-tight tracking-tight">{report.title}</h2>
            <p className="text-xs text-muted-foreground mt-1.5">Submitted {timeAgo(report.createdAt)}</p>
          </div>

          <Separator />

          {/* Status + admin control */}
          <div className="px-5 py-4 flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${statusCfg.bg}`}>
              <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</p>
              <p className="text-[11px] text-muted-foreground truncate">{formatFullDate(report.createdAt)}</p>
            </div>
            {isAdmin && (
              <Select value={report.status} onValueChange={(v) => { if (v) handleStatusChange(v as FeedbackStatus); }}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Progress</SelectItem>
                  <SelectItem value="resolved">Completed</SelectItem>
                  <SelectItem value="closed">Rejected</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Submitter */}
          <div className="px-5 pb-4 flex items-center gap-3">
            <Avatar name={report.user.name} email={report.user.email} size="md" />
            <div>
              <p className="text-sm font-medium">{report.user.name ?? report.user.email.split("@")[0]}</p>
              <p className="text-xs text-muted-foreground capitalize">{report.user.role.replace(/_/g, " ")}</p>
            </div>
          </div>

          <Separator />

          {/* Description */}
          <Section title="Description">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{report.description}</p>
          </Section>

          <Separator />

          {/* Discussion */}
          <Section title="Discussion" badge={report.comments.length}>
            {report.comments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground/60">No comments yet.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {report.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.author.name} email={c.author.email} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold">{c.author.name ?? c.author.email.split("@")[0]}</span>
                        <span className="text-[10px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded-md">{c.author.role.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(c.createdAt)}</span>
                      </div>
                      <div className="rounded-xl bg-muted/50 border px-3.5 py-2.5">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </Section>

          <div className="h-2" />
        </div>

        {/* ── Comment composer ── */}
        <div className="px-5 py-4 border-t shrink-0 bg-background space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add a comment</p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(); }}
            placeholder="Write a comment… (Ctrl+Enter to post)"
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex justify-end">
            <Button
              onClick={submitComment}
              disabled={!comment.trim() || pending}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {pending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />
              }
              Post
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
