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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Clock,
  Loader2,
  Tags,
  Check,
  Trash2,
  Folder,
  Inbox,
  Users,
  Search,
  Activity,
} from "lucide-react";
import { KeywordLeadsModal } from "@/components/scraping/KeywordLeadsModal";
import { KeywordHistoryModal } from "@/components/scraping/KeywordHistoryModal";
import { KeywordCategoryModal } from "@/components/scraping/KeywordCategoryModal";
import { CategoryCombobox } from "@/components/scraping/CategoryCombobox";
import { LocationCombobox } from "@/components/scraping/LocationCombobox";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CAT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#64748b",
];

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
  category: string;
  extraKeywords: string[];
  extraKeywordsMode: string;
  extraKeywordsMin: number;
  extraKeywordsMax: number;
  extraKeywordsOrder: string[];
  cityRotationEnabled: boolean;
  grabEmail: boolean;
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

  // Track in-flight category moves so the background poller doesn't revert them
  const pendingMovesRef = useRef<Map<string, string>>(new Map());

  // Category folder state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Extra (empty) categories created manually — persisted in localStorage
  const [manualCategories, setManualCategories] = useState<{ name: string; color: string }[]>([]);
  // User-chosen colors per category name — persisted in localStorage
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const mc = localStorage.getItem("kw-manual-categories");
      if (mc) setManualCategories(JSON.parse(mc));
      const cc = localStorage.getItem("kw-category-colors");
      if (cc) setCategoryColors(JSON.parse(cc));
    } catch { /* ignore */ }
  }, []);

  function saveManualCategories(list: { name: string; color: string }[]) {
    setManualCategories(list);
    localStorage.setItem("kw-manual-categories", JSON.stringify(list));
  }
  function saveCategoryColor(name: string, color: string) {
    const next = { ...categoryColors, [name]: color };
    setCategoryColors(next);
    localStorage.setItem("kw-category-colors", JSON.stringify(next));
  }

  // Create category dialog
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [createCatName, setCreateCatName] = useState("");
  const [createCatColor, setCreateCatColor] = useState(CAT_COLORS[0]);

  function handleCreateCategory() {
    const name = createCatName.trim();
    if (!name) return;
    // Persist the color for this category name
    saveCategoryColor(name, createCatColor);
    // If no keywords exist for this category yet, track it as a manual category
    const exists = keywords.some((k) => (k.category || "Uncategorized") === name);
    if (!exists && !manualCategories.some((c) => c.name === name)) {
      saveManualCategories([...manualCategories, { name, color: createCatColor }]);
    }
    setCreateCatOpen(false);
    setCreateCatName("");
    setCreateCatColor(CAT_COLORS[0]);
  }

  // Derived: sorted unique categories (from keywords + manual empty ones)
  const allCategoryNames = Array.from(new Set([
    ...keywords.map((k) => k.category || "Uncategorized"),
    ...manualCategories.map((c) => c.name),
  ])).sort((a, b) =>
    a === "Uncategorized" ? -1 : b === "Uncategorized" ? 1 : a.localeCompare(b)
  );

  function getCategoryColor(cat: string, idx: number): string {
    if (cat === "Uncategorized") return "#64748b";
    if (categoryColors[cat]) return categoryColors[cat];
    const manual = manualCategories.find((c) => c.name === cat);
    if (manual) return manual.color;
    return CAT_COLORS[idx % (CAT_COLORS.length - 1)];
  }

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newMaxLeads, setNewMaxLeads] = useState("50");
  const [newInterval, setNewInterval] = useState("1440");
  const [newCategory, setNewCategory] = useState("Uncategorized");
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
  const [editCategory, setEditCategory] = useState("Uncategorized");
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

  // Auto-run state — loops handleRunNow until stopped or page leave
  const autoRunRef = useRef<string | null>(null);
  const [autoRunId, setAutoRunId] = useState<string | null>(null);

  useEffect(() => () => { autoRunRef.current = null; }, []);

  useEffect(() => {
    function isActive(kws: KeywordRow[]) {
      return kws.some((k) => k.jobs[0]?.status === "pending" || k.jobs[0]?.status === "running");
    }

    async function refresh() {
      try {
        const res = await fetch("/api/keywords");
        if (!res.ok) return;
        const data = await res.json();
        let fresh: KeywordRow[] = data.keywords ?? [];
        // Re-apply any optimistic category moves still in-flight so the poll
        // doesn't revert the UI back to the old category before PATCH completes.
        if (pendingMovesRef.current.size > 0) {
          fresh = fresh.map((k) => {
            const pending = pendingMovesRef.current.get(k.id);
            return pending !== undefined ? { ...k, category: pending } : k;
          });
        }
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

        // Fast poll while a job is running; slow poll when idle to save DB quota
        const targetMs = isActive(fresh) ? 4000 : 30000;
        if (pollIntervalRef.current !== targetMs) {
          pollIntervalRef.current = targetMs;
          clearInterval(pollRef.current!);
          pollRef.current = setInterval(refresh, targetMs);
        }
      } catch { /* ignore network errors */ }
    }

    // Fire immediately so the UI is always fresh on mount / visibility change
    refresh();

    pollIntervalRef.current = isActive(keywords) ? 4000 : 30000;
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

  async function handleStop(kwId: string, jobId: string) {
    // Also stop auto-run loop for this keyword if active
    if (autoRunRef.current === kwId) {
      autoRunRef.current = null;
      setAutoRunId(null);
    }
    setRunningId(null); setRunningJobId(null);
    await fetch(`/api/scraping/jobs/${jobId}/cancel`, { method: "POST" }).catch(() => null);
  }

  async function handleAutoRun(kwId: string) {
    // Toggle off if already auto-running this keyword
    if (autoRunRef.current === kwId) {
      autoRunRef.current = null;
      setAutoRunId(null);
      return;
    }

    autoRunRef.current = kwId;
    setAutoRunId(kwId);

    while (autoRunRef.current === kwId) {
      await handleRunNow(kwId);
      if (autoRunRef.current !== kwId) break;
      // Brief pause between runs so DB writes settle before next job starts
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (autoRunRef.current === kwId) {
      autoRunRef.current = null;
      setAutoRunId(null);
    }
  }

  function openEdit(kw: KeywordRow) {
    setEditTarget(kw);
    setEditKeyword(kw.keyword);
    setEditLocation(kw.location);
    setEditMaxLeads(String(kw.maxLeads));
    setEditInterval(String(kw.intervalMinutes));
    setEditCategory(kw.category || "Uncategorized");
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
          category: newCategory || "Uncategorized",
          extraKeywords: newExtraKeywords,
          extraKeywordsMode: newExtraMode,
          extraKeywordsMin: parseInt(newExtraMin),
          extraKeywordsMax: parseInt(newExtraMax),
          extraKeywordsOrder: newExtraOrder,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const kw = data.keyword;
        setKeywords((prev) => [
          { ...kw, _count: { jobs: 0, leads: 0 }, jobs: [], failedAttempts: kw.failedAttempts ?? 0, lastError: kw.lastError ?? null },
          ...prev,
        ]);
        setAddOpen(false);
        setNewKeyword(""); setNewLocation(""); setNewMaxLeads("50"); setNewInterval("1440"); setNewCategory("Uncategorized");
        setNewExtraKeywords([]); setNewExtraMode("random"); setNewExtraMin("1"); setNewExtraMax("3"); setNewExtraOrder([]);
      } else {
        toast.error(data.error ?? "Failed to save keyword.");
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
          category: editCategory || "Uncategorized",
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
              ? { ...k, keyword: updated.keyword.keyword, location: updated.keyword.location, maxLeads: updated.keyword.maxLeads, intervalMinutes: updated.keyword.intervalMinutes, category: updated.keyword.category ?? "Uncategorized", extraKeywords: updated.keyword.extraKeywords ?? [], extraKeywordsMode: updated.keyword.extraKeywordsMode ?? "random", extraKeywordsMin: updated.keyword.extraKeywordsMin ?? 1, extraKeywordsMax: updated.keyword.extraKeywordsMax ?? 3, extraKeywordsOrder: updated.keyword.extraKeywordsOrder ?? [] }
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

  async function handleUpdateSetting(id: string, data: Partial<KeywordRow>) {
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, ...data } : k)));
    await fetch(`/api/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    setKeywords((prev) => prev.filter((k) => k.id !== id));
    setDeleteConfirm(null);
  }

  async function handleMoveCategory(kwId: string, newCategory: string) {
    // Optimistic update
    setKeywords((prev) =>
      prev.map((k) => k.id === kwId ? { ...k, category: newCategory } : k)
    );
    // Register as in-flight so the background poller doesn't revert it
    pendingMovesRef.current.set(kwId, newCategory);
    try {
      await fetch(`/api/keywords/${kwId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
    } finally {
      pendingMovesRef.current.delete(kwId);
    }
  }

  async function handleDuplicate(kwId: string, targetCategory: string) {
    const source = keywords.find((k) => k.id === kwId);
    if (!source) return;

    const conflict = keywords.find(
      (k) =>
        k.id !== kwId &&
        k.category === targetCategory &&
        k.keyword.trim().toLowerCase() === source.keyword.trim().toLowerCase() &&
        k.location.trim().toLowerCase() === source.location.trim().toLowerCase()
    );
    if (conflict) {
      toast.warning(`"${source.keyword}" in ${source.location} already exists in "${targetCategory}" — duplicate not created.`);
      return;
    }

    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: source.keyword,
          location: source.location,
          maxLeads: source.maxLeads,
          intervalMinutes: source.intervalMinutes,
          extraKeywords: source.extraKeywords,
          extraKeywordsMode: source.extraKeywordsMode,
          extraKeywordsMin: source.extraKeywordsMin,
          extraKeywordsMax: source.extraKeywordsMax,
          extraKeywordsOrder: source.extraKeywordsOrder,
          category: targetCategory,
        }),
      });
      if (!res.ok) { toast.error("Failed to duplicate keyword"); return; }
      const data = await res.json();
      setKeywords((prev) => [...prev, {
        ...data.keyword,
        lastRunAt: null,
        nextRunAt: data.keyword.nextRunAt ?? null,
        failedAttempts: 0,
        lastError: null,
        _count: { jobs: 0, leads: 0 },
        jobs: [],
      }]);
      toast.success(`Keyword duplicated to "${targetCategory}"`);
    } catch {
      toast.error("Failed to duplicate keyword");
    }
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
          {keywords.filter((k) => k.enabled).length} active ·{" "}
          {allCategoryNames.length} categor{allCategoryNames.length !== 1 ? "ies" : "y"}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreateCatOpen(true)} className="gap-1.5">
            <Folder className="h-4 w-4" />
            New Category
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Keyword
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {keywords.length === 0 && manualCategories.length === 0 && (
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

      {/* ── Folder board ── */}
      {(keywords.length > 0 || manualCategories.length > 0) && (
        <div className="flex flex-wrap gap-4">
          {allCategoryNames.map((cat, idx) => {
            const kwsInCat = keywords.filter((k) => (k.category || "Uncategorized") === cat);
            const color = getCategoryColor(cat, idx);
            const activeCount = kwsInCat.filter((k) => k.enabled).length;
            const hasRunning = kwsInCat.some((k) => k.id === runningId);
            const totalLeads = kwsInCat.reduce((sum, k) => sum + k._count.leads, 0);
            const isUncategorized = cat === "Uncategorized";

            return (
              <div
                key={cat}
                className="relative w-64 shrink-0 rounded-xl border bg-card hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden group"
              >
                {/* Card body — clickable */}
                <button
                  onClick={() => setSelectedCategory(cat)}
                  className="w-full text-left p-4 space-y-4 focus:outline-none"
                >
                  {/* Icon + name + count */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 bg-muted">
                        {isUncategorized
                          ? <Inbox className="h-4 w-4 text-muted-foreground" />
                          : <Folder className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 pr-6">
                        <p className="text-sm font-semibold truncate leading-tight">{cat}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {activeCount} active · {kwsInCat.length - activeCount} paused
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs tabular-nums font-semibold">
                      {kwsInCat.length}
                    </Badge>
                  </div>

                  {/* Meta info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Search className="h-3 w-3 shrink-0" />
                      <span>{kwsInCat.length} keyword{kwsInCat.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3 shrink-0" />
                      <span>{totalLeads} lead{totalLeads !== 1 ? "s" : ""} scraped</span>
                    </div>
                    {hasRunning ? (
                      <div className="flex items-center gap-2 text-[11px] text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        <span>Scraping in progress…</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Activity className="h-3 w-3 shrink-0" />
                        <span>{activeCount} active</span>
                      </div>
                    )}
                  </div>

                  {/* Hover hint */}
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Click to manage keywords →
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Category modal ── */}
      {selectedCategory !== null && (
        <KeywordCategoryModal
          category={selectedCategory}
          keywords={keywords.filter((k) => (k.category || "Uncategorized") === selectedCategory)}
          open={selectedCategory !== null}
          onOpenChange={(o) => { if (!o) setSelectedCategory(null); }}
          runningId={runningId}
          runningJobId={runningJobId}
          runningLabel={runningLabel}
          allCategories={allCategoryNames}
          onToggle={handleToggle}
          onRunNow={handleRunNow}
          onStop={handleStop}
          autoRunId={autoRunId}
          onAutoRun={handleAutoRun}
          onUpdateSetting={handleUpdateSetting}
          onEdit={openEdit}
          onDelete={(kwId) => setDeleteConfirm(kwId)}
          onViewLeads={(kw) => setViewLeadsKw(kw)}
          onHistory={(kw) => setHistoryKw(kw)}
          onMoveCategory={handleMoveCategory}
          onDuplicate={handleDuplicate}
        />
      )}


      {/* ── Create category dialog ── */}
      <Dialog open={createCatOpen} onOpenChange={(v) => { if (!v) setCreateCatName(""); setCreateCatOpen(v); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category name</Label>
              <Input
                placeholder="e.g. Healthcare, Real Estate…"
                value={createCatName}
                onChange={(e) => setCreateCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateCatOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCategory} disabled={!createCatName.trim()}>
              Create category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add keyword dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Auto-Scrape Keyword</DialogTitle></DialogHeader>
          <KeywordForm
            keyword={newKeyword}    onKeyword={setNewKeyword}
            location={newLocation}  onLocation={setNewLocation}
            maxLeads={newMaxLeads}  onMaxLeads={setNewMaxLeads}
            interval={newInterval}  onInterval={setNewInterval}
            category={newCategory}  onCategory={setNewCategory}
            existingCategories={allCategoryNames}
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
            category={editCategory}  onCategory={setEditCategory}
            existingCategories={allCategoryNames}
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
  category, onCategory,
  existingCategories,
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
  category: string;        onCategory:        (v: string) => void;
  existingCategories: string[];
  extraKeywords: string[]; onExtraKeywords:   (v: string[]) => void;
  extraMode: "random" | "ordered"; onExtraMode: (v: "random" | "ordered") => void;
  extraMin: string;        onExtraMin:        (v: string) => void;
  extraMax: string;        onExtraMax:        (v: string) => void;
  extraOrder: string[];    onExtraOrder:      (v: string[]) => void;
}) {
  const [extraModalOpen, setExtraModalOpen] = useState(false);

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

      {/* Extra keywords — compact trigger */}
      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Extra keywords</span>
          {extraKeywords.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {extraKeywords.length}
            </span>
          )}
          {extraKeywords.length > 0 && (
            <span className="text-xs text-muted-foreground capitalize">{extraMode}</span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setExtraModalOpen(true)}>
          {extraKeywords.length > 0 ? "Manage" : "Add"}
        </Button>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Category</Label>
        <CategoryCombobox
          categories={existingCategories}
          value={category}
          onSelect={onCategory}
        />
      </div>

      <LocationCombobox value={location} onChange={onLocation} />
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

      <ExtraKeywordsModal
        open={extraModalOpen}
        onOpenChange={setExtraModalOpen}
        extraKeywords={extraKeywords}
        onExtraKeywords={onExtraKeywords}
        extraMode={extraMode}
        onExtraMode={onExtraMode}
        extraMin={extraMin}
        onExtraMin={onExtraMin}
        extraMax={extraMax}
        onExtraMax={onExtraMax}
        extraOrder={extraOrder}
        onExtraOrder={onExtraOrder}
        mainKeyword={keyword}
        mainLocation={location}
      />
    </div>
  );
}

// ── Extra Keywords Modal ──────────────────────────────────────────────────────
function ExtraKeywordsModal({
  open, onOpenChange,
  extraKeywords, onExtraKeywords,
  extraMode, onExtraMode,
  extraMin, onExtraMin,
  extraMax, onExtraMax,
  extraOrder, onExtraOrder,
  mainKeyword, mainLocation,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  extraKeywords: string[]; onExtraKeywords: (v: string[]) => void;
  extraMode: "random" | "ordered"; onExtraMode: (v: "random" | "ordered") => void;
  extraMin: string; onExtraMin: (v: string) => void;
  extraMax: string; onExtraMax: (v: string) => void;
  extraOrder: string[]; onExtraOrder: (v: string[]) => void;
  mainKeyword: string; mainLocation: string;
}) {
  const [inputVal, setInputVal] = useState("");

  const maxExtras = extraKeywords.length;
  const minVal = Math.max(1, Math.min(parseInt(extraMin) || 1, maxExtras || 1));

  function addExtras() {
    const parts = inputVal.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;

    // Seed blocked words: main keyword + location + all already-saved extra keywords
    const usedWords = new Set<string>(
      [
        ...mainKeyword.split(/\s+/),
        ...mainLocation.split(/[\s,]+/),
        ...extraKeywords.flatMap((k) => k.split(/\s+/)),
      ]
        .map((w) => w.toLowerCase().trim())
        .filter(Boolean)
    );

    let strippedWordCount = 0;
    let skippedCount = 0;
    const deduped: string[] = [];

    for (const part of parts) {
      const words = part.split(/\s+/);
      const kept = words.filter((w) => {
        const lower = w.toLowerCase().trim();
        if (usedWords.has(lower)) return false;
        return true;
      });

      strippedWordCount += words.length - kept.length;

      const result = kept.join(" ").trim();
      if (!result) {
        skippedCount++;
        continue;
      }

      // Mark these words as used so later entries in this batch don't repeat them
      for (const w of kept) usedWords.add(w.toLowerCase().trim());

      deduped.push(result);
    }

    const merged = [...extraKeywords, ...deduped];

    const msgs: string[] = [];
    if (strippedWordCount > 0) msgs.push("The system removes multiple keywords that are included multiple times");
    if (skippedCount > 0) msgs.push(`${skippedCount} entr${skippedCount !== 1 ? "ies" : "y"} became empty after stripping and were skipped`);
    if (msgs.length > 0) toast.info(msgs.join(". ") + ".", { duration: 4000 });

    onExtraKeywords(merged);
    setInputVal("");
  }

  function removeExtra(val: string) {
    onExtraKeywords(extraKeywords.filter((k) => k !== val));
    onExtraOrder(extraOrder.filter((o) => o !== val));
  }

  function clearAll() {
    onExtraKeywords([]);
    onExtraOrder([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col gap-0 p-0" style={{ maxHeight: "80vh" }}>
        <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Tags className="h-4 w-4" />
              Extra Keywords
              {extraKeywords.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {extraKeywords.length}
                </span>
              )}
            </DialogTitle>
            {extraKeywords.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive gap-1.5" onClick={clearAll}>
                <Trash2 className="h-3 w-3" />
                Clear all keywords
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Mode + min/max */}
        <div className="px-5 py-3 border-b shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">Mode:</span>
            <div className="flex items-center rounded-md border overflow-hidden text-xs">
              {(["random", "ordered"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onExtraMode(mode)}
                  className={cn(
                    "px-3 py-1.5 capitalize transition-colors",
                    extraMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {extraMode === "random" && extraKeywords.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pick per run</span>
                <span className="text-xs font-medium">
                  {parseInt(extraMin) || 0} – {parseInt(extraMax) || 40} keyword{parseInt(extraMax) !== 1 ? "s" : ""}
                </span>
              </div>
              <Slider
                min={0}
                max={40}
                value={[
                  parseInt(extraMin) || 0,
                  parseInt(extraMax) || 40,
                ]}
                onValueChange={(val) => {
                  const arr = Array.isArray(val) ? val : [val as number];
                  onExtraMin(String(arr[0] ?? 0));
                  onExtraMax(String(arr[1] ?? 40));
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0</span>
                <span>40</span>
              </div>
            </div>
          )}

          {extraMode === "ordered" && extraKeywords.length > 0 && (
            <p className="text-xs text-muted-foreground">Click a keyword pill to select it and set its order. Each run uses the next selected keyword in sequence.</p>
          )}
        </div>

        {/* Add input */}
        <div className="px-5 py-2.5 border-b shrink-0 flex items-center gap-2">
          <Input
            placeholder="Type keyword(s) — separate multiple with commas…"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtras(); } }}
            className="h-8 text-sm flex-1"
          />
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={addExtras}>Add</Button>
        </div>

        {/* Pills */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {extraKeywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Tags className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm">No extra keywords yet</p>
              <p className="text-xs text-center max-w-xs">Type one or more keywords separated by commas and press Add.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {extraKeywords.map((k) => {
                const pos = extraOrder.indexOf(k);
                const orderedSelected = extraMode === "ordered" && pos !== -1;
                if (extraMode === "ordered") {
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        if (orderedSelected) {
                          onExtraOrder(extraOrder.filter((o) => o !== k));
                        } else {
                          onExtraOrder([...extraOrder, k]);
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all select-none",
                        orderedSelected
                          ? "bg-foreground text-background border-foreground/20"
                          : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                      )}
                    >
                      {orderedSelected ? (
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
                }
                return (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {k}
                    <button type="button" onClick={() => removeExtra(k)} className="text-muted-foreground hover:text-foreground leading-none ml-0.5">×</button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t shrink-0 flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
