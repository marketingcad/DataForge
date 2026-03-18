"use client";

import { Bug, Lightbulb, Circle, CheckCircle2, Clock, XCircle } from "lucide-react";
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

export function FeedbackMyReports({ reports }: { reports: Report[]; userId: string }) {
  if (reports.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground space-y-2">
        <Flag className="h-10 w-10 mx-auto text-muted-foreground/20" />
        <p className="text-sm font-medium">No reports yet</p>
        <p className="text-xs">Click the flag icon in the header to submit a bug or feature request.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const cfg = STATUS_CONFIG[r.status];
        const CfgIcon = cfg.icon;
        return (
          <div key={r.id} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              {r.type === "bug"
                ? <Bug className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                : <Lightbulb className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
              <span className="text-sm font-semibold flex-1">{r.title}</span>
              <div className="flex items-center gap-1">
                <CfgIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{r.description}</p>
            <p className="text-[11px] text-muted-foreground/50">{new Date(r.createdAt).toLocaleDateString()}</p>
          </div>
        );
      })}
    </div>
  );
}

// needed for empty state
function Flag({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
    </svg>
  );
}
