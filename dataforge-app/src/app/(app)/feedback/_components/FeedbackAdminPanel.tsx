"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, Circle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { updateFeedbackStatusAction } from "@/actions/feedback.actions";
import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/enums";

type Report = {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string; role: string };
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; icon: React.ElementType; color: string }> = {
  open:      { label: "Open",      icon: Circle,       color: "text-blue-500" },
  in_review: { label: "In Review", icon: Clock,        color: "text-amber-500" },
  resolved:  { label: "Resolved",  icon: CheckCircle2, color: "text-emerald-500" },
  closed:    { label: "Closed",    icon: XCircle,      color: "text-muted-foreground" },
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  low:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function ReportCard({ report }: { report: Report }) {
  const [, startTransition] = useTransition();
  const cfg = STATUS_CONFIG[report.status];
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {report.type === "bug"
            ? <Bug className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            : <Lightbulb className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          }
          <span className="text-sm font-semibold">{report.title}</span>
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[report.priority]}`}>
            {report.priority}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
          <select
            defaultValue={report.status}
            onChange={(e) => { const val = e.target.value as FeedbackStatus; startTransition(async () => { await updateFeedbackStatusAction(report.id, val); }); }}
            className="text-xs bg-transparent border-none focus:outline-none cursor-pointer"
          >
            {Object.entries(STATUS_CONFIG).map(([val, c]) => (
              <option key={val} value={val}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{report.description}</p>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>{report.user.name ?? report.user.email} · {report.user.role.replace("_", " ")}</span>
        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

export function FeedbackAdminPanel({ reports }: { reports: Report[] }) {
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");

  const filtered = reports.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(["all", "open", "in_review", "resolved", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === s ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(["all", "bug", "feature"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 font-medium transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {t === "all" ? "All Types" : t === "bug" ? "🐛 Bugs" : "💡 Features"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No reports match the filter.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
