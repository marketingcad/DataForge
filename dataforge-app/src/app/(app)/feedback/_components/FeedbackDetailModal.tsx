"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { X, Bug, Lightbulb, Send, ChevronDown, ChevronRight, CheckCircle2, Clock, Circle, XCircle } from "lucide-react";
import { addFeedbackCommentAction, updateFeedbackStatusAction } from "@/actions/feedback.actions";
import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/enums";

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

const TYPE_STYLES: Record<FeedbackType, { label: string; bg: string; icon: React.ElementType }> = {
  bug:     { label: "Bug",     bg: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",         icon: Bug },
  feature: { label: "Feature", bg: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400", icon: Lightbulb },
};

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  medium: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  low:    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; icon: React.ElementType; color: string }> = {
  open:      { label: "Open",        icon: Circle,       color: "text-blue-500" },
  in_review: { label: "In Progress", icon: Clock,        color: "text-amber-500" },
  resolved:  { label: "Completed",   icon: CheckCircle2, color: "text-emerald-500" },
  closed:    { label: "Rejected",    icon: XCircle,      color: "text-rose-500" },
};

function getInitials(name: string | null, email: string) {
  return (name ?? email).slice(0, 2).toUpperCase();
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

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/50 transition-colors"
      >
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
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
  const TypeIcon = TYPE_STYLES[report.type].icon;
  const statusCfg = STATUS_CONFIG[report.status];
  const StatusIcon = statusCfg.icon;

  // Keep in sync if parent updates
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
      {/* Backdrop — clicking closes */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Side panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col bg-card border-l shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[report.type].bg}`}>
              <TypeIcon className="h-2.5 w-2.5" />
              {TYPE_STYLES[report.type].label}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLES[report.priority] ?? PRIORITY_STYLES.medium}`}>
              {report.priority.charAt(0).toUpperCase() + report.priority.slice(1)}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Title + meta */}
          <div className="px-5 py-4 space-y-1">
            <p className="text-[11px] text-muted-foreground/60 font-mono">#{String(index).padStart(3, "0")}</p>
            <h2 className="text-base font-bold leading-snug">{report.title}</h2>
            <p className="text-xs text-muted-foreground">Submitted {timeAgo(report.createdAt)}</p>
          </div>

          {/* Status row */}
          <div className="px-5 py-3 border-t flex items-center gap-3">
            <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
            <div className="flex-1">
              <span className={`text-sm font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
              <p className="text-[11px] text-muted-foreground">{formatDate(report.createdAt)}</p>
            </div>
            {isAdmin && (
              <div className="relative">
                <select
                  value={report.status}
                  onChange={(e) => handleStatusChange(e.target.value as FeedbackStatus)}
                  className="appearance-none text-xs bg-muted border border-border rounded-lg pl-2.5 pr-6 py-1.5 cursor-pointer focus:outline-none font-medium"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In Progress</option>
                  <option value="resolved">Completed</option>
                  <option value="closed">Rejected</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Submitter */}
          <div className="px-5 py-3 border-t flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
              {getInitials(report.user.name, report.user.email)}
            </div>
            <div>
              <p className="text-xs font-medium">{report.user.name ?? report.user.email.split("@")[0]}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{report.user.role.replace("_", " ")}</p>
            </div>
          </div>

          {/* Description */}
          <Section title="Description">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{report.description}</p>
          </Section>

          {/* Discussion */}
          <Section title={`Discussion · ${report.comments.length}`}>
            {report.comments.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-4">No comments yet. Be the first to share your thoughts!</p>
            ) : (
              <div className="space-y-4">
                {report.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {getInitials(c.author.name, c.author.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-semibold">{c.author.name ?? c.author.email.split("@")[0]}</span>
                        <span className="text-[10px] text-muted-foreground/50 capitalize">{c.author.role.replace("_", " ")}</span>
                        <span className="text-[10px] text-muted-foreground/40 ml-auto">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </Section>

          <div className="h-4" />
        </div>

        {/* Comment input — pinned to bottom */}
        <div className="px-5 py-3 border-t shrink-0 space-y-2">
          <p className="text-xs font-semibold text-foreground">Add a comment</p>
          <div className="flex gap-2 items-end">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(); }}
              placeholder="Add a comment… Type @ to mention someone"
              rows={2}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
            <button
              onClick={submitComment}
              disabled={!comment.trim() || pending}
              className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium transition-colors shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Post
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
