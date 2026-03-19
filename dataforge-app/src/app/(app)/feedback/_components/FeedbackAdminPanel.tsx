"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, Search, User, ChevronDown } from "lucide-react";
import { updateFeedbackStatusAction } from "@/actions/feedback.actions";
import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/enums";
import { Input } from "@/components/ui/input";

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

// Map our DB statuses → board columns
const COLUMNS: { status: FeedbackStatus; label: string; color: string; border: string; dot: string }[] = [
  { status: "open",      label: "Bug / Feature", color: "text-violet-600 dark:text-violet-400", border: "border-t-violet-500", dot: "bg-violet-500" },
  { status: "in_review", label: "In Progress",   color: "text-blue-600 dark:text-blue-400",     border: "border-t-blue-500",   dot: "bg-blue-500"   },
  { status: "closed",    label: "Rejected",       color: "text-rose-600 dark:text-rose-400",     border: "border-t-rose-500",   dot: "bg-rose-500"   },
  { status: "resolved",  label: "Completed",      color: "text-emerald-600 dark:text-emerald-400", border: "border-t-emerald-500", dot: "bg-emerald-500" },
];

const TYPE_STYLES: Record<FeedbackType, { label: string; bg: string; icon: React.ElementType }> = {
  bug:     { label: "Bug",     bg: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",     icon: Bug },
  feature: { label: "Feature", bg: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400", icon: Lightbulb },
};

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  low:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function getInitials(name: string | null, email: string) {
  const n = name ?? email;
  return n.slice(0, 2).toUpperCase();
}

function ReportCard({
  report,
  index,
  isAdmin,
  onStatusChange,
}: {
  report: Report;
  index: number;
  isAdmin: boolean;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
}) {
  const TypeIcon = TYPE_STYLES[report.type].icon;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Number + Title */}
      <div>
        <p className="text-[11px] text-muted-foreground/60 font-mono mb-1">
          #{String(index).padStart(3, "0")}
        </p>
        <p className="text-sm font-semibold leading-snug">{report.title}</p>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2">{report.description}</p>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[report.type].bg}`}>
          <TypeIcon className="h-2.5 w-2.5" />
          {TYPE_STYLES[report.type].label}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLES[report.priority] ?? PRIORITY_STYLES.medium}`}>
          {report.priority}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-dashed">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
            {getInitials(report.user.name, report.user.email)}
          </div>
          <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
            {report.user.name ?? report.user.email.split("@")[0]}
          </span>
        </div>

        {isAdmin ? (
          <div className="relative">
            <select
              defaultValue={report.status}
              onChange={(e) => onStatusChange(report.id, e.target.value as FeedbackStatus)}
              className="appearance-none text-[10px] font-medium bg-muted/60 hover:bg-muted border border-border rounded-md pl-2 pr-5 py-1 cursor-pointer focus:outline-none"
            >
              <option value="open">Open</option>
              <option value="in_review">In Progress</option>
              <option value="closed">Rejected</option>
              <option value="resolved">Completed</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground" />
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(report.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  reports,
  startIndex,
  isAdmin,
  onStatusChange,
}: {
  col: typeof COLUMNS[number];
  reports: Report[];
  startIndex: number;
  isAdmin: boolean;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
}) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className={`rounded-t-xl border-t-2 ${col.border} bg-card border border-b-0 px-4 py-3 flex items-center gap-2`}>
        <span className={`h-2 w-2 rounded-full ${col.dot} shrink-0`} />
        <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {reports.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 border border-t-0 rounded-b-xl bg-muted/20 p-3 space-y-3 min-h-[120px]">
        {reports.length === 0 ? (
          <p className="text-xs text-muted-foreground/40 text-center py-6">No items</p>
        ) : (
          reports.map((r, i) => (
            <ReportCard
              key={r.id}
              report={r}
              index={startIndex + i + 1}
              isAdmin={isAdmin}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function FeedbackAdminPanel({
  reports,
  isAdmin = true,
}: {
  reports: Report[];
  isAdmin?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [localReports, setLocalReports] = useState(reports);

  function handleStatusChange(id: string, status: FeedbackStatus) {
    setLocalReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    startTransition(async () => { await updateFeedbackStatusAction(id, status); });
  }

  const filtered = localReports.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="appearance-none text-xs bg-background border border-input rounded-md pl-8 pr-7 py-1.5 focus:outline-none cursor-pointer h-8"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as FeedbackType | "all")}
            className="appearance-none text-xs bg-background border border-input rounded-md pl-3 pr-7 py-1.5 focus:outline-none cursor-pointer h-8"
          >
            <option value="all">All types</option>
            <option value="bug">🐛 Bugs</option>
            <option value="feature">💡 Features</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colReports = filtered.filter((r) => r.status === col.status);
          return (
            <KanbanColumn
              key={col.status}
              col={col}
              reports={colReports}
              startIndex={localReports.indexOf(colReports[0] ?? ({} as Report))}
              isAdmin={isAdmin}
              onStatusChange={handleStatusChange}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">No reports match your filters.</p>
      )}
    </div>
  );
}
