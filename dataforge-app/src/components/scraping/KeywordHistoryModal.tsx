"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Users,
  Copy,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JobHistory {
  id: string;
  status: string;
  leadsDiscovered: number;
  leadsProcessed: number;
  duplicatesFound: number;
  failedRecords: number;
  errorMessage: string | null;
  maxLeads: number;
  createdAt: string;
  startTime: string | null;
  completedTime: string | null;
}

interface KeywordHistoryModalProps {
  kwId: string;
  keyword: string;
  location: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

function parseReason(job: JobHistory): { summary: string; detail: string | null; type: "success" | "warning" | "error" | "info" } {
  const msg = job.errorMessage ?? "";

  if (job.status === "failed") {
    if (msg.includes("CAPTCHA")) return { summary: "Blocked by CAPTCHA", detail: "Google detected automated traffic and showed a CAPTCHA. Try running again later or use a more specific location.", type: "error" };
    if (msg.includes("timeout") || msg.includes("Timeout")) return { summary: "Timed out", detail: "The scraper ran out of time before finishing. This usually happens on Vercel's 5-minute limit. Try a more specific city-level location instead of a broad region.", type: "error" };
    if (msg.includes("No results feed")) return { summary: "No results page found", detail: "Google Maps didn't return a results feed — the search may have triggered a CAPTCHA or Maps changed its layout.", type: "error" };
    if (msg.includes("__CANCELLED__") || msg.includes("Stopped by user")) return { summary: "Stopped by user", detail: null, type: "warning" };
    return { summary: "Scrape failed", detail: msg || "Unknown error.", type: "error" };
  }

  if (job.status === "completed") {
    if (job.leadsProcessed > 0 && job.leadsDiscovered === 0) {
      return { summary: `${job.leadsProcessed} lead${job.leadsProcessed !== 1 ? "s" : ""} saved`, detail: null, type: "success" };
    }
    if (job.leadsProcessed > 0) {
      const parts: string[] = [`${job.leadsProcessed} of ${job.leadsDiscovered} businesses scraped were saved.`];
      if (job.duplicatesFound > 0) parts.push(`${job.duplicatesFound} skipped — already in the database.`);
      if (job.leadsDiscovered < job.maxLeads) parts.push(`Google Maps only returned ${job.leadsDiscovered} result${job.leadsDiscovered !== 1 ? "s" : ""} for this search — fewer than your ${job.maxLeads}-lead limit.`);
      return { summary: `${job.leadsProcessed} lead${job.leadsProcessed !== 1 ? "s" : ""} saved`, detail: parts.join(" "), type: "success" };
    }
    if (job.leadsDiscovered > 0 && job.leadsProcessed === 0) {
      if (job.duplicatesFound > 0) return { summary: "No new leads", detail: `Found ${job.leadsDiscovered} business${job.leadsDiscovered !== 1 ? "es" : ""} on Google Maps but all ${job.duplicatesFound} were already in your database.`, type: "warning" };
      return { summary: "No new leads", detail: `Found ${job.leadsDiscovered} result${job.leadsDiscovered !== 1 ? "s" : ""} but none were saved — they may have lacked contact details or were duplicates.`, type: "warning" };
    }
    if (job.leadsDiscovered === 0) {
      if (msg.includes("All discovered")) return { summary: "All results already saved", detail: "Every business Google Maps returned for this keyword is already in your database.", type: "info" };
      return { summary: "No results found", detail: "Google Maps returned no businesses for this keyword + location combination. Try a different keyword or a more populated city.", type: "info" };
    }
    // Fallback for "Done" message
    if (msg.startsWith("Done")) return { summary: msg, detail: null, type: "success" };
    return { summary: "Completed", detail: msg || null, type: "success" };
  }

  if (job.status === "running") return { summary: "Still running", detail: msg || null, type: "info" };
  return { summary: job.status, detail: msg || null, type: "info" };
}

export function KeywordHistoryModal({ kwId, keyword, location, open, onOpenChange }: KeywordHistoryModalProps) {
  const [jobs, setJobs] = useState<JobHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/keywords/${kwId}/history`)
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [open, kwId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">
            Scrape History — {keyword} in {location}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Last 20 runs, most recent first</p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading history…</span>
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-30" />
              <p className="text-sm">No runs yet for this keyword.</p>
            </div>
          )}

          {!loading && jobs.length > 0 && (
            <div className="space-y-3">
              {jobs.map((job, idx) => {
                const reason = parseReason(job);
                const duration = formatDuration(job.startTime, job.completedTime);
                const isFirst = idx === 0;

                return (
                  <div
                    key={job.id}
                    className={cn(
                      "rounded-lg border p-4 space-y-3",
                      reason.type === "success" && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
                      reason.type === "error"   && "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20",
                      reason.type === "warning" && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
                      reason.type === "info"    && "border-border bg-muted/30",
                    )}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {reason.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        {reason.type === "error"   && <XCircle className="h-4 w-4 text-rose-500 shrink-0" />}
                        {reason.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                        {reason.type === "info"    && <Info className="h-4 w-4 text-blue-500 shrink-0" />}
                        <span className={cn(
                          "text-sm font-medium",
                          reason.type === "success" && "text-emerald-700 dark:text-emerald-300",
                          reason.type === "error"   && "text-rose-600 dark:text-rose-400",
                          reason.type === "warning" && "text-amber-700 dark:text-amber-300",
                          reason.type === "info"    && "text-foreground",
                        )}>
                          {reason.summary}
                        </span>
                        {isFirst && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Latest</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{formatDate(job.createdAt)}</span>
                    </div>

                    {/* Reason / detail */}
                    {reason.detail && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{reason.detail}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                      {job.leadsDiscovered > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {job.leadsDiscovered} found on Maps
                        </span>
                      )}
                      {job.leadsProcessed > 0 && (
                        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          {job.leadsProcessed} saved
                        </span>
                      )}
                      {job.duplicatesFound > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Copy className="h-3 w-3" />
                          {job.duplicatesFound} duplicate{job.duplicatesFound !== 1 ? "s" : ""}
                        </span>
                      )}
                      {duration && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {duration}
                        </span>
                      )}
                      <span className="text-muted-foreground/60">limit: {job.maxLeads}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
