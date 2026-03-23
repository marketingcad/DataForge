"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Bug, Lightbulb, Search, MessageSquare, AlertCircle, Zap, ChevronDown } from "lucide-react";
import { updateFeedbackStatusAction } from "@/actions/feedback.actions";
import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/enums";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedbackDetailModal } from "./FeedbackDetailModal";

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

const COLUMNS: {
  status: FeedbackStatus;
  label: string;
  accent: string;
  headerBg: string;
  dotColor: string;
  countBg: string;
}[] = [
  {
    status: "open",
    label: "Bug / Feature",
    accent: "border-t-violet-500",
    headerBg: "bg-violet-500/5",
    dotColor: "bg-violet-500",
    countBg: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
  },
  {
    status: "in_review",
    label: "In Progress",
    accent: "border-t-blue-500",
    headerBg: "bg-blue-500/5",
    dotColor: "bg-blue-500",
    countBg: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  },
  {
    status: "closed",
    label: "Rejected",
    accent: "border-t-rose-500",
    headerBg: "bg-rose-500/5",
    dotColor: "bg-rose-500",
    countBg: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
  },
  {
    status: "resolved",
    label: "Completed",
    accent: "border-t-emerald-500",
    headerBg: "bg-emerald-500/5",
    dotColor: "bg-emerald-500",
    countBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
];

const TYPE_CFG: Record<FeedbackType, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  bug:     { label: "Bug",     bg: "bg-rose-100 dark:bg-rose-950/50",     text: "text-rose-600 dark:text-rose-400",     icon: Bug },
  feature: { label: "Feature", bg: "bg-violet-100 dark:bg-violet-950/50", text: "text-violet-600 dark:text-violet-400", icon: Lightbulb },
};

const PRIORITY_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  high:   { bg: "bg-rose-100 dark:bg-rose-950/50",   text: "text-rose-600 dark:text-rose-400",   dot: "bg-rose-500" },
  medium: { bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  low:    { bg: "bg-sky-100 dark:bg-sky-950/50",     text: "text-sky-600 dark:text-sky-400",     dot: "bg-sky-500" },
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
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
}
function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ReportCard({
  report,
  index,
  onClick,
}: {
  report: Report;
  index: number | undefined;
  onClick: () => void;
}) {
  const typeCfg = TYPE_CFG[report.type];
  const TypeIcon = typeCfg.icon;
  const priCfg = PRIORITY_CFG[report.priority] ?? PRIORITY_CFG.medium;

  return (
    <div
      onClick={onClick}
      className="group rounded-xl border bg-card hover:bg-accent/30 hover:border-border/80 hover:shadow-sm transition-all cursor-pointer p-4 space-y-3"
    >
      {/* Index + title */}
      <div>
        <p className="text-[10px] font-mono text-muted-foreground/40 mb-1">#{String(index).padStart(3, "0")}</p>
        <p className="text-sm font-semibold leading-snug group-hover:text-foreground transition-colors line-clamp-2">
          {report.title}
        </p>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{report.description}</p>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeCfg.bg} ${typeCfg.text}`}>
          <TypeIcon className="h-2.5 w-2.5" />
          {typeCfg.label}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${priCfg.bg} ${priCfg.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${priCfg.dot}`} />
          {report.priority.charAt(0).toUpperCase() + report.priority.slice(1)}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/60">
        {/* Avatar + name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`h-5 w-5 rounded-full ${avatarColor(report.user.email)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
            {getInitials(report.user.name, report.user.email)}
          </div>
          <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">
            {report.user.name ?? report.user.email.split("@")[0]}
          </span>
        </div>

        {/* Right side: comments + time */}
        <div className="flex items-center gap-2 shrink-0">
          {report.comments.length > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
              <MessageSquare className="h-3 w-3" />
              <span>{report.comments.length}</span>
            </div>
          )}
          <span className="text-[10px] text-muted-foreground/40">{timeAgo(report.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  reports,
  numberMap,
  onCardClick,
}: {
  col: typeof COLUMNS[number];
  reports: Report[];
  globalReports: Report[];
  numberMap: Map<string, number>;
  onCardClick: (report: Report) => void;
}) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className={`rounded-t-xl border-t-2 ${col.accent} border border-b-0 ${col.headerBg} px-4 py-3 flex items-center gap-2`}>
        <span className={`h-2 w-2 rounded-full ${col.dotColor} shrink-0`} />
        <span className="text-sm font-semibold">{col.label}</span>
        <span className={`ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 leading-none ${col.countBg}`}>
          {reports.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 border border-t-0 rounded-b-xl bg-muted/10 p-3 space-y-2.5 min-h-[200px]">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-10 text-center">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Zap className="h-4 w-4 text-muted-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground/40">Nothing here</p>
          </div>
        ) : (
          reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              index={numberMap.get(r.id)}
              onClick={() => onCardClick(r)}
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [localReports, setLocalReports] = useState(reports);
  const [selected, setSelected] = useState<Report | null>(null);

  // Sync with server-refreshed props
  useEffect(() => { setLocalReports(reports); }, [reports]);

  // Stable number map: oldest report = #1
  const numberMap = useMemo(() => {
    const sorted = [...localReports].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return new Map(sorted.map((r, i) => [r.id, i + 1]));
  }, [localReports]);

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

  const selectedSync = selected ? (localReports.find((r) => r.id === selected.id) ?? selected) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <Select value={priorityFilter} onValueChange={(v) => { if (v) setPriorityFilter(v); }}>
          <SelectTrigger className="h-9 w-[150px] text-sm">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { if (v) setTypeFilter(v as FeedbackType | "all"); }}>
          <SelectTrigger className="h-9 w-[130px] text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="bug">🐛 Bugs</SelectItem>
            <SelectItem value="feature">💡 Features</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            col={col}
            reports={filtered.filter((r) => r.status === col.status)}
            globalReports={localReports}
            numberMap={numberMap}
            onCardClick={setSelected}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">No reports match your filters.</p>
      )}

      {selectedSync && (
        <FeedbackDetailModal
          report={selectedSync}
          index={numberMap.get(selectedSync.id) ?? 1}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
