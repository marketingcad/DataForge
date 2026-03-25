"use client";

import { useState } from "react";
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
  DialogDescription,
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
  Trash2,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Loader2,
  ExternalLink,
  Inbox,
  Folder,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";
import { getFoldersAction } from "@/actions/folders.actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PendingLead {
  businessName: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
}

interface KeywordRow {
  id: string;
  keyword: string;
  location: string;
  maxLeads: number;
  intervalHours: number;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  failedAttempts: number;
  lastError: string | null;
  _count: { jobs: number };
  jobs: {
    id: string;
    status: string;
    leadsProcessed: number;
    leadsDiscovered: number;
    pendingLeads: PendingLead[] | null;
    errorMessage: string | null;
    createdAt: string;
  }[];
}

interface KeywordsManagerProps {
  initial: KeywordRow[];
}

const INTERVAL_OPTIONS = [
  { label: "Every 6 hours",  value: 6   },
  { label: "Every 12 hours", value: 12  },
  { label: "Every 24 hours", value: 24  },
  { label: "Every 48 hours", value: 48  },
  { label: "Every week",     value: 168 },
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

function intervalLabel(hours: number) {
  return INTERVAL_OPTIONS.find((o) => o.value === hours)?.label ??
    (hours < 24 ? `Every ${hours}h` : `Every ${hours / 24}d`);
}

export function KeywordsManager({ initial }: KeywordsManagerProps) {
  const [keywords, setKeywords] = useState<KeywordRow[]>(initial);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newMaxLeads, setNewMaxLeads] = useState("50");
  const [newInterval, setNewInterval] = useState("24");
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<KeywordRow | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMaxLeads, setEditMaxLeads] = useState("50");
  const [editInterval, setEditInterval] = useState("24");
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Pending leads save dialog
  const [saveTarget, setSaveTarget] = useState<{ jobId: string; leads: PendingLead[]; keyword: string } | null>(null);
  const [tableLeads, setTableLeads] = useState<PendingLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [tableSearch, setTableSearch] = useState("");
  const [filterHas, setFilterHas] = useState<{ phone: boolean; email: boolean; website: boolean }>({ phone: false, email: false, website: false });
  const [saveFolderId, setSaveFolderId] = useState("none");
  const [saveCategory, setSaveCategory] = useState("");
  const [folders, setFolders] = useState<{ id: string; name: string; color: string; _count: { leads: number }; industry: { id: string; name: string; color: string } | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ saved: number; duplicates: number; failed: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Grid vs list view
  const [view, setView] = useState<"list" | "grid">("list");

  // Run now loading state per keyword
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningLabel, setRunningLabel] = useState<string>("Starting…");
  const [runToast, setRunToast] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  function openEdit(kw: KeywordRow) {
    setEditTarget(kw);
    setEditKeyword(kw.keyword);
    setEditLocation(kw.location);
    setEditMaxLeads(String(kw.maxLeads));
    setEditInterval(String(kw.intervalHours));
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
          intervalHours: parseInt(newInterval),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const kw = data.keyword;
        // Update local state immediately — router.refresh() won't update useState(initial)
        setKeywords((prev) => [
          {
            ...kw,
            _count: { jobs: 0 },
            jobs: [],
            failedAttempts: kw.failedAttempts ?? 0,
            lastError: kw.lastError ?? null,
          },
          ...prev,
        ]);
        setAddOpen(false);
        setNewKeyword("");
        setNewLocation("");
        setNewMaxLeads("50");
        setNewInterval("24");
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
          intervalHours: parseInt(editInterval),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setKeywords((prev) =>
          prev.map((k) =>
            k.id === editTarget.id
              ? {
                  ...k,
                  keyword: updated.keyword.keyword,
                  location: updated.keyword.location,
                  maxLeads: updated.keyword.maxLeads,
                  intervalHours: updated.keyword.intervalHours,
                }
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
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, enabled } : k))
    );
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

  async function openSaveDialog(kw: KeywordRow) {
    const job = kw.jobs[0];
    if (!job?.pendingLeads?.length) return;
    const leads = job.pendingLeads;
    setSaveTarget({ jobId: job.id, leads, keyword: `${kw.keyword} — ${kw.location}` });
    setTableLeads(leads);
    setSelectedIds(new Set(leads.map((_, i) => i)));
    setTableSearch("");
    setFilterHas({ phone: false, email: false, website: false });
    setSaveFolderId("none");
    setSaveCategory(kw.keyword);
    setSaveResult(null);
    setSaveError(null);
    try {
      const f = await getFoldersAction();
      setFolders(f as unknown as typeof folders);
    } catch {
      setFolders([]);
    }
  }

  async function handleCommit() {
    if (!saveTarget) return;
    setSaving(true);
    setSaveError(null);
    try {
      const resolvedFolderId = saveFolderId !== "none" ? saveFolderId : undefined;

      const selectedLeads = tableLeads.filter((_, i) => selectedIds.has(i));

      const res = await fetch(`/api/scraping/jobs/${saveTarget.jobId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: resolvedFolderId,
          category: saveCategory.trim() || undefined,
          leads: selectedLeads,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setSaveResult(result);
        setKeywords((prev) =>
          prev.map((k) => ({
            ...k,
            jobs: k.jobs.map((j) =>
              j.id === saveTarget.jobId ? { ...j, pendingLeads: null, leadsProcessed: result.saved } : j
            ),
          }))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ?? `Save failed (${res.status})`);
      }
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelectAll(visible: PendingLead[]) {
    const visibleIndexes = visible.map((_, i) => tableLeads.indexOf(visible[i]));
    const allSelected = visibleIndexes.every(i => selectedIds.has(i));
    setSelectedIds(prev => {
      const next = new Set(prev);
      visibleIndexes.forEach(i => allSelected ? next.delete(i) : next.add(i));
      return next;
    });
  }

  function deleteSelected() {
    const remaining = tableLeads.filter((_, i) => !selectedIds.has(i));
    setTableLeads(remaining);
    setSelectedIds(new Set(remaining.map((_, i) => i)));
  }

  async function handleRunNow(kwId: string) {
    setRunningId(kwId);
    setRunningLabel("Starting…");
    setRunToast(null);

    let jobId: string;
    try {
      const res = await fetch(`/api/keywords/${kwId}/run`, { method: "POST" });
      if (!res.ok) {
        setRunToast({ id: kwId, msg: "Failed to start scraping. Try again.", ok: false });
        setRunningId(null);
        setTimeout(() => setRunToast(null), 6000);
        return;
      }
      const data = await res.json();
      jobId = data.jobId;
    } catch {
      setRunToast({ id: kwId, msg: "Failed to start scraping. Try again.", ok: false });
      setRunningId(null);
      setTimeout(() => setRunToast(null), 6000);
      return;
    }

    // Trigger the process from the browser so Vercel doesn't kill it
    fetch(`/api/scraping/jobs/${jobId}/process`, { method: "POST" }).catch(() => null);

    // Poll job until completed or failed
    setRunningLabel("Starting browser…");
    const MAX_POLLS = 180; // 30 min max (10s interval)
    let completionHandled = false;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const poll = await fetch(`/api/scraping/jobs/${jobId}`);
        if (!poll.ok) break;
        const job = await poll.json();

        // Live status label
        if (job.status === "pending") {
          setRunningLabel(`Starting browser… (${Math.round((i + 1) * 5)}s)`);
        } else if (job.status === "running") {
          const countSuffix = job.leadsDiscovered > 0 ? ` (${job.leadsDiscovered} found)` : "";
          setRunningLabel((job.errorMessage || "Searching Google Maps…") + countSuffix);
        }

        if (job.status === "completed" || job.status === "failed") {
          applyJobResult(kwId, jobId, job);
          completionHandled = true;
          if (job.status === "failed") {
            setTimeout(() => setRunningId(null), 15000);
            setTimeout(() => setRunToast(null), 15000);
            return;
          }
          break;
        }
      } catch {
        break;
      }
    }

    setRunningId(null);

    // If the loop ended without seeing a terminal status (e.g. Vercel function
    // timed out before writing "completed"), do one final check so we don't
    // leave the user stranded with "No runs yet" when leads were saved.
    if (!completionHandled) {
      try {
        const finalPoll = await fetch(`/api/scraping/jobs/${jobId}`);
        if (finalPoll.ok) {
          const job = await finalPoll.json();
          applyJobResult(kwId, jobId, job);
          completionHandled = true;
        }
      } catch { /* ignore */ }

      if (!completionHandled) {
        setRunToast({ id: kwId, msg: "Scraping is taking longer than expected — refresh the page to see results.", ok: false });
      }
    }

    setTimeout(() => setRunToast(null), 12000);
  }

  function applyJobResult(kwId: string, jobId: string, job: { status: string; leadsDiscovered: number; leadsProcessed: number; pendingLeads: unknown; errorMessage: string | null }) {
    const pendingLeads = (job.pendingLeads as PendingLead[] | null) ?? [];
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
                  pendingLeads: pendingLeads.length > 0 ? pendingLeads : null,
                  errorMessage: job.errorMessage ?? null,
                  createdAt: new Date().toISOString(),
                },
                ...k.jobs.slice(0, 4),
              ],
            }
          : k
      )
    );
    if (job.status === "failed") {
      setRunToast({ id: kwId, msg: `Failed: ${job.errorMessage ?? "Unknown error"}`, ok: false });
    } else if (pendingLeads.length > 0) {
      setRunToast({ id: kwId, msg: `Done! ${pendingLeads.length} leads ready — click the badge to save them.`, ok: true });
    } else {
      setRunToast({ id: kwId, msg: "Scraping done — no new leads found.", ok: true });
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
          {/* View toggle */}
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={cn("px-2.5 py-1.5 transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("grid")}
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

      {/* Run toast */}
      {runToast && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
          runToast.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
            : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400"
        }`}>
          {runToast.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{runToast.msg}</span>
          {runToast.ok && (
            <Link href="/leads" className="ml-auto flex items-center gap-1 underline underline-offset-2 font-medium">
              Go to Leads <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* Empty state */}
      {keywords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground rounded-lg border border-dashed">
          <Clock className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">No keywords yet</p>
          <p className="text-xs text-center max-w-xs">
            Add keywords to automatically scrape Google Maps on a schedule.
            Example: keyword "dentist", location "Chicago, IL".
          </p>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="mt-1">
            Add your first keyword
          </Button>
        </div>
      )}

      {/* Keyword list / grid */}
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
                    {job?.pendingLeads && job.pendingLeads.length > 0 && (
                      <button onClick={() => openSaveDialog(kw)} className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors">
                        <Inbox className="h-3 w-3" />{job.pendingLeads.length} leads ready — click to save
                      </button>
                    )}
                  </div>
                  {runningId === kw.id ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" /><span>{runningLabel}</span>
                    </div>
                  ) : job ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.status === "completed" && job.leadsDiscovered > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />{job.leadsDiscovered} lead{job.leadsDiscovered !== 1 ? "s" : ""} scraped last run</span>}
                      {job.status === "completed" && job.leadsDiscovered === 0 && (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />0 leads scraped</span>
                          {job.errorMessage && <span className="text-xs text-muted-foreground truncate max-w-xs">{job.errorMessage}</span>}
                        </div>
                      )}
                      {job.status === "running" && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"><Loader2 className="h-3 w-3 animate-spin" />Scraping…</span>}
                      {job.status === "failed" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" />Last run failed</span>}
                      <span className="text-xs text-muted-foreground">{relativeTime(job.createdAt)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No runs yet</span>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{intervalLabel(kw.intervalHours)}</span>
                    <span>Last run: {relativeTime(kw.lastRunAt)}</span>
                    <span>Next: {kw.enabled ? nextRunLabel(kw.nextRunAt) : "Paused"}</span>
                    <span>{kw._count.jobs} run{kw._count.jobs !== 1 ? "s" : ""} total</span>
                  </div>
                  {kw.lastError && <p className="text-xs text-rose-500 truncate max-w-xl">Error: {kw.lastError}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => handleRunNow(kw.id)} disabled={runningId === kw.id}>
                    {runningId === kw.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {runningId === kw.id ? runningLabel : "Run now"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(kw)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500" onClick={() => setDeleteConfirm(kw.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Keyword grid */}
      {keywords.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {keywords.map((kw) => {
            const job = kw.jobs[0] ?? null;
            const hasFailed = kw.failedAttempts > 0;
            const isDisabledByFailure = !kw.enabled && kw.failedAttempts >= 5;
            return (
              <div key={kw.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{kw.keyword}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />{kw.location}
                    </p>
                  </div>
                  <Switch checked={kw.enabled} onCheckedChange={(v) => handleToggle(kw.id, v)} />
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    up to {kw.maxLeads} leads/run
                  </span>
                  {isDisabledByFailure && <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Disabled</Badge>}
                  {!kw.enabled && !isDisabledByFailure && <Badge variant="outline" className="text-xs text-muted-foreground">Paused</Badge>}
                  {kw.enabled && !hasFailed && <Badge variant="secondary" className="text-xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="h-3 w-3" />Active</Badge>}
                  {hasFailed && kw.enabled && <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"><AlertTriangle className="h-3 w-3" />{kw.failedAttempts}/5 failures</Badge>}
                </div>

                {/* Pending leads */}
                {job?.pendingLeads && job.pendingLeads.length > 0 && (
                  <button onClick={() => openSaveDialog(kw)} className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors">
                    <Inbox className="h-3.5 w-3.5" />{job.pendingLeads.length} leads ready — click to save
                  </button>
                )}

                {/* Status */}
                {runningId === kw.id ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" /><span className="truncate">{runningLabel}</span>
                  </div>
                ) : job ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.status === "completed" && job.leadsDiscovered > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />{job.leadsDiscovered} scraped</span>}
                    {job.status === "completed" && job.leadsDiscovered === 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />0 leads scraped</span>
                        {job.errorMessage && <span className="text-xs text-muted-foreground truncate">{job.errorMessage}</span>}
                      </div>
                    )}
                    {job.status === "running" && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"><Loader2 className="h-3 w-3 animate-spin" />Scraping…</span>}
                    {job.status === "failed" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" />Failed</span>}
                    <span className="text-xs text-muted-foreground">{relativeTime(job.createdAt)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No runs yet</span>
                )}

                {/* Schedule info */}
                <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                  <div className="flex justify-between"><span>Schedule</span><span className="font-medium text-foreground">{intervalLabel(kw.intervalHours)}</span></div>
                  <div className="flex justify-between"><span>Last run</span><span>{relativeTime(kw.lastRunAt)}</span></div>
                  <div className="flex justify-between"><span>Next</span><span>{kw.enabled ? nextRunLabel(kw.nextRunAt) : "Paused"}</span></div>
                </div>

                {kw.lastError && <p className="text-xs text-rose-500 truncate">Error: {kw.lastError}</p>}

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 flex-1" onClick={() => handleRunNow(kw.id)} disabled={runningId === kw.id}>
                    {runningId === kw.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {runningId === kw.id ? "Running…" : "Run now"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(kw)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500" onClick={() => setDeleteConfirm(kw.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add keyword dialog ───────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Auto-Scrape Keyword</DialogTitle>
          </DialogHeader>
          <KeywordForm
            keyword={newKeyword}        onKeyword={setNewKeyword}
            location={newLocation}      onLocation={setNewLocation}
            maxLeads={newMaxLeads}      onMaxLeads={setNewMaxLeads}
            interval={newInterval}      onInterval={setNewInterval}
          />
          <Separator />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={addSaving || !newKeyword.trim() || !newLocation.trim()}
            >
              {addSaving ? "Adding…" : "Add keyword"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit keyword dialog ──────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Keyword</DialogTitle>
          </DialogHeader>
          <KeywordForm
            keyword={editKeyword}      onKeyword={setEditKeyword}
            location={editLocation}    onLocation={setEditLocation}
            maxLeads={editMaxLeads}    onMaxLeads={setEditMaxLeads}
            interval={editInterval}    onInterval={setEditInterval}
          />
          <Separator />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={handleEdit}
              disabled={editSaving || !editKeyword.trim() || !editLocation.trim()}
            >
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Save pending leads dialog ────────────────────────────── */}
      <Dialog open={!!saveTarget} onOpenChange={(o) => { if (!o && !saving) { setSaveTarget(null); setSaveResult(null); } }}>
        <DialogContent className="w-[calc(100vw-40px)] max-w-[calc(100vw-40px)] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Scraped leads — {saveTarget?.keyword}
              <Badge variant="secondary" className="ml-1">{tableLeads.length} total</Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">Review and save scraped leads</DialogDescription>
          </DialogHeader>

          {!saveResult ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by business name…"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <button type="button"
                  onClick={() => setFilterHas(prev => ({ ...prev, phone: !prev.phone }))}
                  className={cn("text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                    filterHas.phone ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                  Has Phone
                </button>
                <button type="button"
                  onClick={() => setFilterHas(prev => ({ ...prev, email: !prev.email }))}
                  className={cn("text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                    filterHas.email ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                  Has Email
                </button>
                <button type="button"
                  onClick={() => setFilterHas(prev => ({ ...prev, website: !prev.website }))}
                  className={cn("text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                    filterHas.website ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                  Has Website
                </button>
                {selectedIds.size > 0 && (
                  <Button size="sm" variant="destructive" className="gap-1.5 h-8 ml-auto" onClick={deleteSelected}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete {selectedIds.size} selected
                  </Button>
                )}
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto min-h-0">
                {(() => {
                  const visible = tableLeads.filter(l => {
                    if (tableSearch && !l.businessName.toLowerCase().includes(tableSearch.toLowerCase())) return false;
                    if (filterHas.phone && !l.phone) return false;
                    if (filterHas.email && !l.email) return false;
                    if (filterHas.website && !l.website) return false;
                    return true;
                  });
                  const visibleIndexes = visible.map(l => tableLeads.indexOf(l));
                  const allVisibleSelected = visibleIndexes.length > 0 && visibleIndexes.every(i => selectedIds.has(i));
                  const someSelected = visibleIndexes.some(i => selectedIds.has(i));
                  return (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b z-10">
                        <tr>
                          <th className="w-10 px-4 py-2.5 text-left">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              ref={el => { if (el) el.indeterminate = someSelected && !allVisibleSelected; }}
                              onChange={() => toggleSelectAll(visible)}
                              className="h-4 w-4 rounded border-border cursor-pointer"
                            />
                          </th>
                          <th className="w-10 px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">#</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Business</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Address</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Phone</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Email</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Website</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {visible.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                              No leads match your filters.
                            </td>
                          </tr>
                        ) : visible.map((lead, vi) => {
                          const realIdx = tableLeads.indexOf(lead);
                          const isSelected = selectedIds.has(realIdx);
                          return (
                            <tr
                              key={realIdx}
                              className={cn("transition-colors cursor-pointer", isSelected ? "bg-primary/5" : "hover:bg-muted/40")}
                              onClick={() => setSelectedIds(prev => {
                                const next = new Set(prev);
                                isSelected ? next.delete(realIdx) : next.add(realIdx);
                                return next;
                              })}
                            >
                              <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => setSelectedIds(prev => {
                                    const next = new Set(prev);
                                    isSelected ? next.delete(realIdx) : next.add(realIdx);
                                    return next;
                                  })}
                                  className="h-4 w-4 rounded border-border cursor-pointer"
                                />
                              </td>
                              <td className="px-2 py-2.5 text-xs text-muted-foreground">{vi + 1}</td>
                              <td className="px-3 py-2.5 font-medium max-w-[200px] truncate">{lead.businessName}</td>
                              <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[180px] truncate">
                                {[lead.address, lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                              </td>
                              <td className="px-3 py-2.5 text-xs whitespace-nowrap">{lead.phone || <span className="text-muted-foreground/50">—</span>}</td>
                              <td className="px-3 py-2.5 text-xs max-w-[160px] truncate">{lead.email || <span className="text-muted-foreground/50">—</span>}</td>
                              <td className="px-3 py-2.5 text-xs max-w-[160px] truncate">
                                {lead.website ? (
                                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1"
                                    onClick={e => e.stopPropagation()}>
                                    {lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                  </a>
                                ) : <span className="text-muted-foreground/50">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="border-t px-6 py-4 flex items-center gap-3 flex-wrap shrink-0">
                <Select value={saveFolderId} onValueChange={(v) => v && setSaveFolderId(v)}>
                  <SelectTrigger className="w-[200px] h-9 text-sm">
                    <SelectValue placeholder="No folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Folder className="h-3.5 w-3.5" />
                        No folder
                      </span>
                    </SelectItem>
                    {folders.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                          {f.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Category (optional)"
                  value={saveCategory}
                  onChange={(e) => setSaveCategory(e.target.value)}
                  className="w-[180px] h-9 text-sm"
                />
                {saveError && (
                  <p className="text-xs text-rose-500 flex items-center gap-1 mr-auto">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{saveError}
                  </p>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" onClick={() => setSaveTarget(null)} disabled={saving}>Cancel</Button>
                  <Button onClick={handleCommit} disabled={saving || selectedIds.size === 0}>
                    {saving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                      : <>Save {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} →</>}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4 max-w-sm">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-emerald-600">{saveResult.saved} lead{saveResult.saved !== 1 ? "s" : ""} saved</p>
                  {saveResult.duplicates > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">{saveResult.duplicates} duplicate{saveResult.duplicates !== 1 ? "s" : ""} skipped</p>
                  )}
                  {saveResult.failed > 0 && (
                    <p className="text-sm text-rose-500 mt-1 flex items-center justify-center gap-1">
                      <AlertTriangle className="h-4 w-4" />{saveResult.failed} failed
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-center pt-2">
                  <Link href="/leads">
                    <Button variant="outline" className="gap-1.5" onClick={() => setSaveTarget(null)}>
                      Go to Leads <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button onClick={() => { setSaveTarget(null); setSaveResult(null); }}>Done</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete keyword?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the keyword and stops all future scheduled runs.
            Existing job records are kept.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared form fields used by both Add and Edit dialogs ──────────────────────
function KeywordForm({
  keyword, onKeyword,
  location, onLocation,
  maxLeads, onMaxLeads,
  interval, onInterval,
}: {
  keyword: string;   onKeyword:  (v: string) => void;
  location: string;  onLocation: (v: string) => void;
  maxLeads: string;  onMaxLeads: (v: string) => void;
  interval: string;  onInterval: (v: string) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Keyword</Label>
        <Input
          placeholder="e.g. dentist, roofing contractor, plumber"
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Searches Google Maps for this keyword + location.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Location</Label>
        <Input
          placeholder="e.g. Chicago, IL"
          value={location}
          onChange={(e) => onLocation(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Max leads per run</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={maxLeads}
            onChange={(e) => onMaxLeads(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Run schedule</Label>
          <Select value={interval} onValueChange={(v) => v && onInterval(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
