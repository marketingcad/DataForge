"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Play,
  Square,
  Trash2,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Check,
  Pencil,
  Loader2,
  Inbox,
  LayoutGrid,
  List,
  History,
} from "lucide-react";
import { KeywordLeadsModal } from "@/components/scraping/KeywordLeadsModal";
import { KeywordHistoryModal } from "@/components/scraping/KeywordHistoryModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface KeywordRow {
  id: string;
  keyword: string;
  location: string;
  maxLeads: number;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  failedAttempts: number;
  lastError: string | null;
  extraKeywords: string[];
  extraKeywordsMode: string;
  extraKeywordsMin: number;
  extraKeywordsMax: number;
  extraKeywordsOrder: string[];
  _count: { jobs: number; leads: number };
  jobs: {
    id: string;
    status: string;
    leadsProcessed: number;
    leadsDiscovered: number;
    errorMessage: string | null;
    createdAt: string;
  }[];
}

interface KeywordsManagerProps {
  initial: KeywordRow[];
}

// All values are in minutes
const INTERVAL_OPTIONS = [
  { label: "Every 5 minutes",  value: 5    },
  { label: "Every 10 minutes", value: 10   },
  { label: "Every 20 minutes", value: 20   },
  { label: "Every 30 minutes", value: 30   },
  { label: "Every 1 hour",     value: 60   },
  { label: "Every 2 hours",    value: 120  },
  { label: "Every 4 hours",    value: 240  },
  { label: "Every 6 hours",    value: 360  },
  { label: "Every 12 hours",   value: 720  },
  { label: "Every 1 day",      value: 1440 },
  { label: "Every 3 days",     value: 4320 },
  { label: "Every 1 week",     value: 10080},
];

function relativeTime(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function nextRunLabel(iso: string | null) {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.floor(hrs / 24)}d`;
}

function intervalLabel(minutes: number) {
  return INTERVAL_OPTIONS.find((o) => o.value === minutes)?.label ??
    (minutes < 60 ? `Every ${minutes}m` :
     minutes < 1440 ? `Every ${minutes / 60}h` :
     `Every ${minutes / 1440}d`);
}

export function KeywordsManager({ initial }: KeywordsManagerProps) {
  const [keywords, setKeywords] = useState<KeywordRow[]>(initial);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newMaxLeads, setNewMaxLeads] = useState("50");
  const [newInterval, setNewInterval] = useState("1440");
  const [newExtraKeywords, setNewExtraKeywords] = useState<string[]>([]);
  const [newExtraMode, setNewExtraMode] = useState<"random" | "ordered">("random");
  const [newExtraMin, setNewExtraMin] = useState("1");
  const [newExtraMax, setNewExtraMax] = useState("3");
  const [newExtraOrder, setNewExtraOrder] = useState<string[]>([]);
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<KeywordRow | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMaxLeads, setEditMaxLeads] = useState("50");
  const [editInterval, setEditInterval] = useState("1440");
  const [editExtraKeywords, setEditExtraKeywords] = useState<string[]>([]);
  const [editExtraMode, setEditExtraMode] = useState<"random" | "ordered">("random");
  const [editExtraMin, setEditExtraMin] = useState("1");
  const [editExtraMax, setEditExtraMax] = useState("3");
  const [editExtraOrder, setEditExtraOrder] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // View leads modal
  const [viewLeadsKw, setViewLeadsKw] = useState<KeywordRow | null>(null);

  // History modal
  const [historyKw, setHistoryKw] = useState<KeywordRow | null>(null);

  // Grid vs list view — persisted in localStorage
  const [view, setView] = useState<"list" | "grid">("list");
  useEffect(() => {
    const stored = localStorage.getItem("kw-view");
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);
  function handleSetView(v: "list" | "grid") {
    setView(v);
    localStorage.setItem("kw-view", v);
  }

  // Run now loading state per keyword
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [runningLabel, setRunningLabel] = useState<string>("Starting…");

  // Track job IDs that have already had their completion toast shown
  const completedToastRef = useRef<Set<string>>(new Set());

  // Auto-refresh the keyword list so status, last run, next run, and badges
  // update without a page reload.
  // - Every 3 s when any job is pending/running (smooth progress during scraping)
  // - Every 5 s otherwise (catches cron-triggered jobs starting within 5 s)
  // - Also fires immediately when the tab regains visibility
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<number>(0);

  // Track which job IDs we've already started live-polling to avoid duplicates
  const livePolledJobsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function isActive(kws: KeywordRow[]) {
      return kws.some((k) => k.jobs[0]?.status === "pending" || k.jobs[0]?.status === "running");
    }

    async function refresh() {
      try {
        const res = await fetch("/api/keywords");
        if (!res.ok) return;
        const data = await res.json();
        const fresh: KeywordRow[] = data.keywords ?? [];
        setKeywords(fresh);

        // If the cron fired a job we're not already tracking, start live polling for it
        // so the spinner, progress label, toast, and lead count all update in real time.
        for (const kw of fresh) {
          const j = kw.jobs[0];
          if (!j) continue;
          if (j.status !== "running" && j.status !== "pending") continue;
          if (livePolledJobsRef.current.has(j.id)) continue;
          livePolledJobsRef.current.add(j.id);
          resumePolling(kw.id, j.id);
        }

        // Switch interval speed based on whether any job is active
        const targetMs = isActive(fresh) ? 3000 : 5000;
        if (pollIntervalRef.current !== targetMs) {
          pollIntervalRef.current = targetMs;
          clearInterval(pollRef.current!);
          pollRef.current = setInterval(refresh, targetMs);
        }
      } catch { /* ignore network errors */ }
    }

    // Fire immediately so the UI is always fresh on mount / visibility change
    refresh();

    pollIntervalRef.current = isActive(keywords) ? 3000 : 5000;
    pollRef.current = setInterval(refresh, pollIntervalRef.current);

    // Re-fire instantly when user returns to the tab
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(pollRef.current!);
      pollRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount, resume live polling if any keyword already has a running job
  useEffect(() => {
    const runningKw = keywords.find((k) => k.jobs[0]?.status === "running" || k.jobs[0]?.status === "pending");
    if (runningKw && runningKw.jobs[0]) {
      livePolledJobsRef.current.add(runningKw.jobs[0].id);
      resumePolling(runningKw.id, runningKw.jobs[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount, auto-trigger any keyword jobs stuck in "pending" for > 90 seconds.
  // The cron creates the job but the server-to-server process call sometimes doesn't
  // start — firing it from the browser (same as "Run now") is a reliable fallback.
  useEffect(() => {
    const STUCK_MS = 90 * 1000;
    const stuckJobs = keywords.filter((k) => {
      const j = k.jobs[0];
      return j?.status === "pending" && Date.now() - new Date(j.createdAt).getTime() > STUCK_MS;
    });
    for (const kw of stuckJobs) {
      fetch(`/api/scraping/jobs/${kw.jobs[0].id}/process`, { method: "POST" }).catch(() => null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resumePolling(kwId: string, jobId: string) {
    setRunningId(kwId);
    setRunningJobId(jobId);
    setRunningLabel("Reconnecting…");
    const MAX_POLLS = 60;
    let completionHandled = false;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const poll = await fetch(`/api/scraping/jobs/${jobId}`);
        if (!poll.ok) break;
        const job = await poll.json();
        if (job.status === "running") {
          const msg = job.errorMessage || "Searching Google Maps…";
          const prefix = job.leadsDiscovered > 0 ? `[ ${job.leadsDiscovered} found ] — ` : "";
          setRunningLabel(prefix + msg);

          // Scraper logged a terminal message but Vercel timed out before writing status="completed"
          if (job.errorMessage?.startsWith("Done") || job.errorMessage?.startsWith("All discovered")) {
            applyJobResult(kwId, jobId, { ...job, status: "completed" });
            completionHandled = true;
            break;
          }
        }
        if (job.status === "completed" || job.status === "failed" || job.status === "paused") {
          applyJobResult(kwId, jobId, job);
          completionHandled = true;
          break;
        }
      } catch { break; }
    }
    setRunningId(null); setRunningJobId(null);
    if (!completionHandled) {
      try {
        const p = await fetch(`/api/scraping/jobs/${jobId}`);
        if (p.ok) applyJobResult(kwId, jobId, await p.json());
      } catch { /* ignore */ }
    }
  }

  async function handleStop(_kwId: string, jobId: string) {
    // Clear running state immediately so the UI stops showing the spinner.
    // The scraper will finish in the background and write its final result.
    setRunningId(null); setRunningJobId(null);
    await fetch(`/api/scraping/jobs/${jobId}/cancel`, { method: "POST" }).catch(() => null);
  }

  function openEdit(kw: KeywordRow) {
    setEditTarget(kw);
    setEditKeyword(kw.keyword);
    setEditLocation(kw.location);
    setEditMaxLeads(String(kw.maxLeads));
    setEditInterval(String(kw.intervalMinutes));
    setEditExtraKeywords(kw.extraKeywords ?? []);
    setEditExtraMode((kw.extraKeywordsMode ?? "random") as "random" | "ordered");
    setEditExtraMin(String(kw.extraKeywordsMin ?? 1));
    setEditExtraMax(String(kw.extraKeywordsMax ?? 3));
    setEditExtraOrder(kw.extraKeywordsOrder ?? []);
  }

  async function handleAdd() {
    if (!newKeyword.trim() || !newLocation.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          location: newLocation.trim(),
          maxLeads: parseInt(newMaxLeads),
          intervalMinutes: parseInt(newInterval),
          extraKeywords: newExtraKeywords,
          extraKeywordsMode: newExtraMode,
          extraKeywordsMin: parseInt(newExtraMin),
          extraKeywordsMax: parseInt(newExtraMax),
          extraKeywordsOrder: newExtraOrder,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const kw = data.keyword;
        setKeywords((prev) => [
          { ...kw, _count: { jobs: 0, leads: 0 }, jobs: [], failedAttempts: kw.failedAttempts ?? 0, lastError: kw.lastError ?? null },
          ...prev,
        ]);
        setAddOpen(false);
        setNewKeyword(""); setNewLocation(""); setNewMaxLeads("50"); setNewInterval("1440");
        setNewExtraKeywords([]); setNewExtraMode("random"); setNewExtraMin("1"); setNewExtraMax("3"); setNewExtraOrder([]);
      }
    } finally {
      setAddSaving(false);
    }
  }

  async function handleEdit() {
    if (!editTarget || !editKeyword.trim() || !editLocation.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/keywords/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: editKeyword.trim(),
          location: editLocation.trim(),
          maxLeads: parseInt(editMaxLeads),
          intervalMinutes: parseInt(editInterval),
          extraKeywords: editExtraKeywords,
          extraKeywordsMode: editExtraMode,
          extraKeywordsMin: parseInt(editExtraMin),
          extraKeywordsMax: parseInt(editExtraMax),
          extraKeywordsOrder: editExtraOrder,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setKeywords((prev) =>
          prev.map((k) =>
            k.id === editTarget.id
              ? { ...k, keyword: updated.keyword.keyword, location: updated.keyword.location, maxLeads: updated.keyword.maxLeads, intervalMinutes: updated.keyword.intervalMinutes, extraKeywords: updated.keyword.extraKeywords ?? [], extraKeywordsMode: updated.keyword.extraKeywordsMode ?? "random", extraKeywordsMin: updated.keyword.extraKeywordsMin ?? 1, extraKeywordsMax: updated.keyword.extraKeywordsMax ?? 3, extraKeywordsOrder: updated.keyword.extraKeywordsOrder ?? [] }
              : k
          )
        );
        setEditTarget(null);
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, enabled } : k)));
    await fetch(`/api/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    setKeywords((prev) => prev.filter((k) => k.id !== id));
    setDeleteConfirm(null);
  }

  async function handleRunNow(kwId: string) {
    setRunningId(kwId);
    setRunningLabel("Starting…");

    let jobId: string;
    try {
      const res = await fetch(`/api/keywords/${kwId}/run`, { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to start scraping. Try again.");
        setRunningId(null); setRunningJobId(null);
        return;
      }
      const data = await res.json();
      jobId = data.jobId;
      setRunningJobId(jobId);
      // Prevent the background poll from starting a second resumePolling for this job
      livePolledJobsRef.current.add(jobId);
    } catch {
      toast.error("Failed to start scraping. Try again.");
      setRunningId(null); setRunningJobId(null);
      return;
    }

    fetch(`/api/scraping/jobs/${jobId}/process`, { method: "POST" }).catch(() => null);

    setRunningLabel("Starting browser…");
    const MAX_POLLS = 180;
    let completionHandled = false;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const poll = await fetch(`/api/scraping/jobs/${jobId}`);
        if (!poll.ok) break;
        const job = await poll.json();

        if (job.status === "pending") {
          setRunningLabel(`Starting browser… (${Math.round((i + 1) * 5)}s)`);
        } else if (job.status === "running") {
          const msg = job.errorMessage || "Searching Google Maps…";
          const prefix = job.leadsDiscovered > 0 ? `[ ${job.leadsDiscovered} found ] — ` : "";
          setRunningLabel(prefix + msg);
          if (job.leadsDiscovered > 0) {
            setKeywords((prev) =>
              prev.map((k) =>
                k.id === kwId
                  ? { ...k, jobs: k.jobs.map((j) => j.id === jobId ? { ...j, leadsDiscovered: job.leadsDiscovered } : j) }
                  : k
              )
            );
          }

          // If the scraper already finished (logged "Done") but Vercel timed out
          // before writing status="completed", treat it as completed client-side.
          if (job.errorMessage?.startsWith("Done")) {
            applyJobResult(kwId, jobId, { ...job, status: "completed" });
            completionHandled = true;
            break;
          }
        }

        if (job.status === "completed" || job.status === "failed") {
          applyJobResult(kwId, jobId, job);
          completionHandled = true;
          if (job.status === "failed") {
            setTimeout(() => { setRunningId(null); setRunningJobId(null); }, 15000);
            return;
          }
          break;
        }
      } catch { break; }
    }

    setRunningId(null); setRunningJobId(null);

    if (!completionHandled) {
      try {
        const finalPoll = await fetch(`/api/scraping/jobs/${jobId}`);
        if (finalPoll.ok) {
          applyJobResult(kwId, jobId, await finalPoll.json());
          completionHandled = true;
        }
      } catch { /* ignore */ }

      if (!completionHandled) {
        toast.warning("Scraping is taking longer than expected — refresh the page to see results.");
      }
    }
  }

  function applyJobResult(kwId: string, jobId: string, job: { status: string; leadsDiscovered: number; leadsProcessed: number; duplicatesFound: number; errorMessage: string | null }) {
    const alreadyToasted = completedToastRef.current.has(jobId);
    completedToastRef.current.add(jobId);
    // Refresh the real lead count from the server instead of estimating from leadsProcessed
    fetch(`/api/keywords/${kwId}/leads?page=1`)
      .then((r) => r.json())
      .then((data) => {
        setKeywords((prev) =>
          prev.map((k) => k.id === kwId ? { ...k, _count: { ...k._count, leads: data.total ?? k._count.leads } } : k)
        );
      })
      .catch(() => {});

    setKeywords((prev) =>
      prev.map((k) =>
        k.id === kwId
          ? {
              ...k,
              lastRunAt: new Date().toISOString(),
              jobs: [
                {
                  id: jobId,
                  status: job.status,
                  leadsDiscovered: job.leadsDiscovered,
                  leadsProcessed: job.leadsProcessed,
                  errorMessage: job.errorMessage ?? null,
                  createdAt: new Date().toISOString(),
                },
                ...k.jobs.slice(0, 4),
              ],
            }
          : k
      )
    );
    if (!alreadyToasted) {
      if (job.status === "failed") {
        toast.error(`Scrape failed: ${job.errorMessage ?? "Unknown error"}`);
      } else if (job.leadsProcessed > 0) {
        toast.success(`Done! ${job.leadsProcessed} lead${job.leadsProcessed !== 1 ? "s" : ""} saved${job.duplicatesFound > 0 ? `, ${job.duplicatesFound} already existed` : ""}.`, {
          action: { label: "Go to Leads", onClick: () => { window.location.href = "/leads"; } },
          duration: 12000,
        });
      } else {
        toast.info("Scraping done — no new leads found.");
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {keywords.length} keyword{keywords.length !== 1 ? "s" : ""} ·{" "}
          {keywords.filter((k) => k.enabled).length} active
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              onClick={() => handleSetView("list")}
              className={cn("px-2.5 py-1.5 transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleSetView("grid")}
              className={cn("px-2.5 py-1.5 transition-colors", view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Keyword
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {keywords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground rounded-lg border border-dashed">
          <Clock className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">No keywords yet</p>
          <p className="text-xs text-center max-w-xs">
            Add keywords to automatically scrape Google Maps on a schedule.
            Example: keyword &quot;dentist&quot;, location &quot;Chicago, IL&quot;.
          </p>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="mt-1">
            Add your first keyword
          </Button>
        </div>
      )}

      {/* ── List view ── */}
      {keywords.length > 0 && view === "list" && (
        <div className="rounded-lg border divide-y">
          {keywords.map((kw) => {
            const job = kw.jobs[0] ?? null;
            const hasFailed = kw.failedAttempts > 0;
            const isDisabledByFailure = !kw.enabled && kw.failedAttempts >= 5;
            return (
              <div key={kw.id} className="p-4 flex items-start gap-4">
                <div className="pt-0.5">
                  <Switch checked={kw.enabled} onCheckedChange={(v) => handleToggle(kw.id, v)} />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{kw.keyword}</span>
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{kw.location}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      up to {kw.maxLeads} leads/run
                    </span>
                    {isDisabledByFailure && <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Disabled (5 failures)</Badge>}
                    {!kw.enabled && !isDisabledByFailure && <Badge variant="outline" className="text-xs text-muted-foreground">Paused</Badge>}
                    {kw.enabled && !hasFailed && <Badge variant="secondary" className="text-xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="h-3 w-3" />Active</Badge>}
                    {hasFailed && kw.enabled && <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"><AlertTriangle className="h-3 w-3" />{kw.failedAttempts}/5 failures</Badge>}
                    {(
                      <button onClick={() => setViewLeadsKw(kw)} className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors">
                        <Inbox className="h-3 w-3" />View {kw._count.leads > 0 ? `${kw._count.leads} ` : ""}scraped leads
                      </button>
                    )}
                  </div>
                  {runningId === kw.id ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" /><span>{runningLabel}</span>
                    </div>
                  ) : job ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {job.status === "completed" && job.leadsProcessed > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />{job.leadsProcessed} lead{job.leadsProcessed !== 1 ? "s" : ""} saved last run</span>}
                        {job.status === "completed" && job.leadsProcessed === 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />No new leads</span>}
                        {job.status === "running" && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"><Loader2 className="h-3 w-3 animate-spin" />Scraping…</span>}
                        {job.status === "failed" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" />Last run failed</span>}
                        <span className="text-xs text-muted-foreground" suppressHydrationWarning>{relativeTime(job.createdAt)}</span>
                      </div>
                      {job.status === "completed" && job.leadsProcessed === 0 && job.errorMessage && !job.errorMessage.startsWith("Done") && (
                        <span className="text-xs text-muted-foreground truncate max-w-xs">{job.errorMessage}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No runs yet</span>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{intervalLabel(kw.intervalMinutes)}</span>
                    <span suppressHydrationWarning>Last run: {relativeTime(kw.lastRunAt)}</span>
                    <span>Next: {kw.enabled ? nextRunLabel(kw.nextRunAt) : "Paused"}</span>
                    <span>{kw._count.jobs} run{kw._count.jobs !== 1 ? "s" : ""} total</span>
                  </div>
                  {kw.lastError && <p className="text-xs text-rose-500 truncate max-w-xl">Error: {kw.lastError}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {runningId === kw.id ? (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-rose-600 border-rose-300 hover:bg-rose-50" onClick={() => runningJobId && handleStop(kw.id, runningJobId)}>
                      <Square className="h-3.5 w-3.5" />Stop
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => handleRunNow(kw.id)}>
                      <Play className="h-3.5 w-3.5" />Run now
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title="Run history" onClick={() => setHistoryKw(kw)}><History className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(kw)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500" onClick={() => setDeleteConfirm(kw.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Grid view ── */}
      {keywords.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {keywords.map((kw) => {
            const job = kw.jobs[0] ?? null;
            const hasFailed = kw.failedAttempts > 0;
            const isDisabledByFailure = !kw.enabled && kw.failedAttempts >= 5;
            return (
              <div key={kw.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{kw.keyword}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />{kw.location}
                    </p>
                  </div>
                  <Switch checked={kw.enabled} onCheckedChange={(v) => handleToggle(kw.id, v)} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    up to {kw.maxLeads} leads/run
                  </span>
                  {isDisabledByFailure && <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Disabled</Badge>}
                  {!kw.enabled && !isDisabledByFailure && <Badge variant="outline" className="text-xs text-muted-foreground">Paused</Badge>}
                  {kw.enabled && !hasFailed && <Badge variant="secondary" className="text-xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="h-3 w-3" />Active</Badge>}
                  {hasFailed && kw.enabled && <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"><AlertTriangle className="h-3 w-3" />{kw.failedAttempts}/5 failures</Badge>}
                </div>

                {(
                  <button onClick={() => setViewLeadsKw(kw)} className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors">
                    <Inbox className="h-3.5 w-3.5" />View {kw._count.leads > 0 ? `${kw._count.leads} ` : ""}scraped leads
                  </button>
                )}

                {runningId === kw.id ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" /><span className="truncate">{runningLabel}</span>
                  </div>
                ) : job ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.status === "completed" && job.leadsProcessed > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />{job.leadsProcessed} saved</span>}
                      {job.status === "completed" && job.leadsProcessed === 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />No new leads</span>}
                      {job.status === "running" && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"><Loader2 className="h-3 w-3 animate-spin" />Scraping…</span>}
                      {job.status === "failed" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" />Failed</span>}
                      <span className="text-xs text-muted-foreground" suppressHydrationWarning>{relativeTime(job.createdAt)}</span>
                    </div>
                    {job.status === "completed" && job.leadsProcessed === 0 && job.errorMessage && !job.errorMessage.startsWith("Done") && (
                      <span className="text-xs text-muted-foreground truncate">{job.errorMessage}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No runs yet</span>
                )}

                <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                  <div className="flex justify-between"><span>Schedule</span><span className="font-medium text-foreground">{intervalLabel(kw.intervalMinutes)}</span></div>
                  <div className="flex justify-between"><span>Last run</span><span suppressHydrationWarning>{relativeTime(kw.lastRunAt)}</span></div>
                  <div className="flex justify-between"><span>Next</span><span>{kw.enabled ? nextRunLabel(kw.nextRunAt) : "Paused"}</span></div>
                </div>

                {kw.lastError && <p className="text-xs text-rose-500 truncate">Error: {kw.lastError}</p>}

                <div className="flex items-center gap-1 pt-1 mt-auto">
                  {runningId === kw.id ? (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 flex-1 text-rose-600 border-rose-300 hover:bg-rose-50" onClick={() => runningJobId && handleStop(kw.id, runningJobId)}>
                      <Square className="h-3.5 w-3.5" />Stop
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 flex-1" onClick={() => handleRunNow(kw.id)}>
                      <Play className="h-3.5 w-3.5" />Run now
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title="Run history" onClick={() => setHistoryKw(kw)}><History className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(kw)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500" onClick={() => setDeleteConfirm(kw.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add keyword dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Auto-Scrape Keyword</DialogTitle></DialogHeader>
          <KeywordForm
            keyword={newKeyword}    onKeyword={setNewKeyword}
            location={newLocation}  onLocation={setNewLocation}
            maxLeads={newMaxLeads}  onMaxLeads={setNewMaxLeads}
            interval={newInterval}  onInterval={setNewInterval}
            extraKeywords={newExtraKeywords} onExtraKeywords={setNewExtraKeywords}
            extraMode={newExtraMode}   onExtraMode={setNewExtraMode}
            extraMin={newExtraMin}     onExtraMin={setNewExtraMin}
            extraMax={newExtraMax}     onExtraMax={setNewExtraMax}
            extraOrder={newExtraOrder} onExtraOrder={setNewExtraOrder}
          />
          <Separator />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSaving || !newKeyword.trim() || !newLocation.trim()}>
              {addSaving ? "Adding…" : "Add keyword"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit keyword dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Keyword</DialogTitle></DialogHeader>
          <KeywordForm
            keyword={editKeyword}    onKeyword={setEditKeyword}
            location={editLocation}  onLocation={setEditLocation}
            maxLeads={editMaxLeads}  onMaxLeads={setEditMaxLeads}
            interval={editInterval}  onInterval={setEditInterval}
            extraKeywords={editExtraKeywords} onExtraKeywords={setEditExtraKeywords}
            extraMode={editExtraMode}     onExtraMode={setEditExtraMode}
            extraMin={editExtraMin}       onExtraMin={setEditExtraMin}
            extraMax={editExtraMax}       onExtraMax={setEditExtraMax}
            extraOrder={editExtraOrder}   onExtraOrder={setEditExtraOrder}
          />
          <Separator />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editSaving || !editKeyword.trim() || !editLocation.trim()}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete keyword confirm dialog ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete keyword?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the keyword and stops all future scheduled runs. Existing job records are kept.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Run history modal ── */}
      {historyKw && (
        <KeywordHistoryModal
          kwId={historyKw.id}
          keyword={historyKw.keyword}
          location={historyKw.location}
          open={!!historyKw}
          onOpenChange={(o) => { if (!o) setHistoryKw(null); }}
        />
      )}

      {/* ── Scraped leads modal (mirrors FolderLeadsModal) ── */}
      {viewLeadsKw && (
        <KeywordLeadsModal
          kwId={viewLeadsKw.id}
          keyword={viewLeadsKw.keyword}
          location={viewLeadsKw.location}
          open={!!viewLeadsKw}
          onOpenChange={(o) => { if (!o) setViewLeadsKw(null); }}
          onLeadsDeleted={(count) => {
            setKeywords((prev) =>
              prev.map((k) =>
                k.id === viewLeadsKw!.id
                  ? { ...k, _count: { ...k._count, leads: Math.max(0, k._count.leads - count) } }
                  : k
              )
            );
          }}
        />
      )}
    </div>
  );
}

// ── Shared keyword form fields ──────────────────────────────────────────────
function KeywordForm({
  keyword, onKeyword,
  location, onLocation,
  maxLeads, onMaxLeads,
  interval, onInterval,
  extraKeywords, onExtraKeywords,
  extraMode, onExtraMode,
  extraMin, onExtraMin,
  extraMax, onExtraMax,
  extraOrder, onExtraOrder,
}: {
  keyword: string;         onKeyword:         (v: string) => void;
  location: string;        onLocation:        (v: string) => void;
  maxLeads: string;        onMaxLeads:        (v: string) => void;
  interval: string;        onInterval:        (v: string) => void;
  extraKeywords: string[]; onExtraKeywords:   (v: string[]) => void;
  extraMode: "random" | "ordered"; onExtraMode: (v: "random" | "ordered") => void;
  extraMin: string;        onExtraMin:        (v: string) => void;
  extraMax: string;        onExtraMax:        (v: string) => void;
  extraOrder: string[];    onExtraOrder:      (v: string[]) => void;
}) {
  const [inputVal, setInputVal] = useState("");

  function addExtra() {
    const trimmed = inputVal.trim();
    if (!trimmed || extraKeywords.includes(trimmed)) { setInputVal(""); return; }
    onExtraKeywords([...extraKeywords, trimmed]);
    setInputVal("");
  }

  function removeExtra(val: string) {
    onExtraKeywords(extraKeywords.filter((k) => k !== val));
  }

  const maxExtras = extraKeywords.length;
  const minVal = Math.max(1, Math.min(parseInt(extraMin) || 1, maxExtras || 1));

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Keyword</Label>
        <Input
          placeholder="e.g. dentist, roofing contractor, plumber"
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Searches Google Maps for this keyword + location.</p>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Extra keywords <span className="text-muted-foreground font-normal">(optional)</span></Label>
          {extraKeywords.length > 0 && (
            <div className="flex items-center rounded-md border overflow-hidden text-xs">
              {(["random", "ordered"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onExtraMode(mode)}
                  className={cn(
                    "px-2.5 py-1 capitalize transition-colors",
                    extraMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. orthodontist"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }}
          />
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addExtra}>Add</Button>
        </div>

        {extraKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {extraKeywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                {k}
                <button type="button" onClick={() => removeExtra(k)} className="text-muted-foreground hover:text-foreground leading-none">×</button>
              </span>
            ))}
          </div>
        )}

        {extraKeywords.length > 0 && extraMode === "random" && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-muted-foreground shrink-0">Pick per run:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">min</span>
              <Input
                type="number" min={1} max={maxExtras}
                value={extraMin}
                onChange={(e) => onExtraMin(e.target.value)}
                className="h-7 w-14 text-xs text-center"
              />
              <span className="text-xs text-muted-foreground">max</span>
              <Input
                type="number" min={minVal} max={maxExtras}
                value={extraMax}
                onChange={(e) => onExtraMax(e.target.value)}
                className="h-7 w-14 text-xs text-center"
              />
              <span className="text-xs text-muted-foreground">of {maxExtras}</span>
            </div>
          </div>
        )}

        {extraKeywords.length > 0 && extraMode === "ordered" && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground">Enable keywords you want to be in order — click to select, click again to remove.</p>
            <div className="flex flex-wrap gap-1.5">
              {extraKeywords.map((k) => {
                const pos = extraOrder.indexOf(k);
                const selected = pos !== -1;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        onExtraOrder(extraOrder.filter((o) => o !== k));
                      } else {
                        onExtraOrder([...extraOrder, k]);
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all select-none",
                      selected
                        ? "bg-foreground text-background border-foreground/20"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {selected ? (
                      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background border border-border text-[8px] font-bold text-foreground leading-none">
                          {pos + 1}
                        </span>
                      </span>
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    {k}
                  </button>
                );
              })}
            </div>
            {extraOrder.length === 0 && (
              <p className="text-xs text-amber-500">No keywords selected — all extras will be used in added order.</p>
            )}
          </div>
        )}

        {extraKeywords.length === 0 && (
          <p className="text-xs text-muted-foreground">Each run combines the main keyword with a selection of these for variety.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Location</Label>
        <Input placeholder="e.g. Chicago, IL" value={location} onChange={(e) => onLocation(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Max leads per run</Label>
          <Input type="number" min={1} max={200} value={maxLeads} onChange={(e) => onMaxLeads(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Run schedule</Label>
          <Select value={interval} onValueChange={(v) => v && onInterval(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
