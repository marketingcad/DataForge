"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { X, Bug, Lightbulb, Send, ChevronDown } from "lucide-react";
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
  bug:     { label: "Bug",     bg: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",     icon: Bug },
  feature: { label: "Feature", bg: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400", icon: Lightbulb },
};

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  low:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open:      "Open",
  in_review: "In Progress",
  resolved:  "Completed",
  closed:    "Rejected",
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
  return new Date(date).toLocaleDateString();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-muted-foreground/60">
                #{String(index).padStart(3, "0")}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[report.type].bg}`}>
                <TypeIcon className="h-2.5 w-2.5" />
                {TYPE_STYLES[report.type].label}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLES[report.priority] ?? PRIORITY_STYLES.medium}`}>
                {report.priority}
              </span>
            </div>
            <h2 className="text-base font-semibold leading-snug">{report.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              by {report.user.name ?? report.user.email} · {timeAgo(report.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <div className="relative">
                <select
                  value={report.status}
                  onChange={(e) => handleStatusChange(e.target.value as FeedbackStatus)}
                  className="appearance-none text-xs bg-muted border border-border rounded-lg pl-2.5 pr-6 py-1.5 cursor-pointer focus:outline-none font-medium"
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          <div className="px-5 py-4 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.description}</p>
          </div>

          {/* Discussion */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Discussion · {report.comments.length}
            </p>

            {report.comments.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-6">No comments yet. Be the first to respond.</p>
            ) : (
              <div className="space-y-4">
                {report.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
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
          </div>
        </div>

        {/* Comment input */}
        <div className="px-5 py-3 border-t shrink-0 flex gap-2 items-end">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment(); }}
            placeholder="Add a comment… (Ctrl+Enter to send)"
            rows={2}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
          <button
            onClick={submitComment}
            disabled={!comment.trim() || pending}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
