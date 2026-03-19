"use client";

import { useState } from "react";
import { Bug, Lightbulb, MessageSquare } from "lucide-react";
import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/enums";
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

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  open:      { label: "Open",        color: "text-blue-500" },
  in_review: { label: "In Progress", color: "text-amber-500" },
  resolved:  { label: "Completed",   color: "text-emerald-500" },
  closed:    { label: "Rejected",    color: "text-muted-foreground" },
};

export function FeedbackMyReports({ reports, userId }: { reports: Report[]; userId: string }) {
  const [selected, setSelected] = useState<Report | null>(null);

  if (reports.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground space-y-2">
        <svg className="h-10 w-10 mx-auto text-muted-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
        </svg>
        <p className="text-sm font-medium">No reports yet</p>
        <p className="text-xs">Click Submit Feedback to report a bug or request a feature.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {reports.map((r, i) => {
          const cfg = STATUS_CONFIG[r.status];
          return (
            <div
              key={r.id}
              onClick={() => setSelected(r)}
              className="rounded-xl border bg-card p-4 space-y-2 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {r.type === "bug"
                  ? <Bug className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  : <Lightbulb className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
                <span className="text-[11px] font-mono text-muted-foreground/50">#{String(i + 1).padStart(3, "0")}</span>
                <span className="text-sm font-semibold flex-1 truncate">{r.title}</span>
                <span className={`text-xs font-medium shrink-0 ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/50">
                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                {r.comments.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-3 w-3" />
                    {r.comments.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <FeedbackDetailModal
          report={selected}
          index={reports.indexOf(selected) + 1}
          isAdmin={false}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
