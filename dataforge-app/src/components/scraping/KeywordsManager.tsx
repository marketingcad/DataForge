"use client";

import { useState, useTransition } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { getFoldersAction } from "@/actions/folders.actions";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [keywords, setKeywords] = useState<KeywordRow[]>(initial);
  const [, startTransition] = useTransition();

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
  const [saveFolderId, setSaveFolderId] = useState("");
  const [saveCategory, setSaveCategory] = useState("");
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ saved: number; duplicates: number; failed: number } | null>(null);

  // Run now loading state per keyword
  const [runningId, setRunningId] = useState<string | null>(null);
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
        setAddOpen(false);
        setNewKeyword("");
        setNewLocation("");
        setNewMaxLeads("50");
        setNewInterval("24");
        startTransition(() => router.refresh());
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
    setSaveTarget({ jobId: job.id, leads: job.pendingLeads, keyword: `${kw.keyword} — ${kw.location}` });
    setSaveFolderId("");
    setSaveCategory(kw.keyword);
    setSaveResult(null);
    try {
      const result = await getFoldersAction();
      setFolders(result.map((f) => ({ id: f.id, name: f.name })));
    } catch {
      setFolders([]);
    }
  }

  async function handleCommit() {
    if (!saveTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scraping/jobs/${saveTarget.jobId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: saveFolderId || undefined,
          category: saveCategory.trim() || undefined,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setSaveResult(result);
        // Clear pending leads locally on the keyword row
        setKeywords((prev) =>
          prev.map((k) => ({
            ...k,
            jobs: k.jobs.map((j) =>
              j.id === saveTarget.jobId ? { ...j, pendingLeads: null, leadsProcessed: result.saved } : j
            ),
          }))
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow(id: string) {
    setRunningId(id);
    setRunToast(null);
    try {
      const res = await fetch(`/api/keywords/${id}/run`, { method: "POST" });
      if (res.ok) {
        setRunToast({ id, msg: "Scraping started — leads will appear on the Leads page.", ok: true });
        startTransition(() => router.refresh());
      } else {
        setRunToast({ id, msg: "Failed to start scraping. Try again.", ok: false });
      }
    } catch {
      setRunToast({ id, msg: "Failed to start scraping. Try again.", ok: false });
    } finally {
      setRunningId(null);
      setTimeout(() => setRunToast(null), 6000);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {keywords.length} keyword{keywords.length !== 1 ? "s" : ""} ·{" "}
          {keywords.filter((k) => k.enabled).length} active
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Keyword
        </Button>
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

      {/* Keyword list */}
      {keywords.length > 0 && (
        <div className="rounded-lg border divide-y">
          {keywords.map((kw) => {
            const job = kw.jobs[0] ?? null;
            const hasFailed = kw.failedAttempts > 0;
            const isDisabledByFailure = !kw.enabled && kw.failedAttempts >= 5;

            return (
              <div key={kw.id} className="p-4 flex items-start gap-4">
                {/* Enable/disable toggle */}
                <div className="pt-0.5">
                  <Switch
                    checked={kw.enabled}
                    onCheckedChange={(v) => handleToggle(kw.id, v)}
                  />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{kw.keyword}</span>
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {kw.location}
                    </span>

                    {isDisabledByFailure && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Disabled (5 failures)
                      </Badge>
                    )}
                    {!kw.enabled && !isDisabledByFailure && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Paused
                      </Badge>
                    )}
                    {kw.enabled && !hasFailed && (
                      <Badge variant="secondary" className="text-xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </Badge>
                    )}
                    {hasFailed && kw.enabled && (
                      <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-3 w-3" />
                        {kw.failedAttempts}/5 failures
                      </Badge>
                    )}
                    {job?.pendingLeads && job.pendingLeads.length > 0 && (
                      <button
                        onClick={() => openSaveDialog(kw)}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors"
                      >
                        <Inbox className="h-3 w-3" />
                        {job.pendingLeads.length} leads ready — click to save
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Max {kw.maxLeads} leads/run</span>
                    <span>{intervalLabel(kw.intervalHours)}</span>
                    <span>Last run: {relativeTime(kw.lastRunAt)}</span>
                    <span>Next: {kw.enabled ? nextRunLabel(kw.nextRunAt) : "Paused"}</span>
                    <span>{kw._count.jobs} run{kw._count.jobs !== 1 ? "s" : ""} total</span>
                    {job && (
                      <span>
                        Latest:{" "}
                        <span className={
                          job.status === "completed" ? "text-emerald-600" :
                          job.status === "failed"    ? "text-rose-500"    : "text-blue-500"
                        }>
                          {job.status}
                        </span>
                        {job.status === "completed" && ` · ${job.leadsProcessed} leads`}
                      </span>
                    )}
                  </div>

                  {kw.lastError && (
                    <p className="text-xs text-rose-500 truncate max-w-xl">
                      Error: {kw.lastError}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8"
                    onClick={() => handleRunNow(kw.id)}
                    disabled={runningId === kw.id}
                    title="Run now"
                  >
                    {runningId === kw.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Play className="h-3.5 w-3.5" />}
                    {runningId === kw.id ? "Starting…" : "Run now"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(kw)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                    onClick={() => setDeleteConfirm(kw.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save scraped leads</DialogTitle>
            <DialogDescription>
              {saveTarget?.keyword} · {saveTarget?.leads.length} leads ready
            </DialogDescription>
          </DialogHeader>

          {!saveResult ? (
            <div className="space-y-4 py-1">
              {/* Lead preview */}
              <div className="rounded-md border divide-y max-h-48 overflow-y-auto text-xs">
                {saveTarget?.leads.map((lead, i) => (
                  <div key={i} className="px-3 py-2 flex items-center gap-3">
                    <span className="font-medium truncate flex-1">{lead.businessName}</span>
                    {lead.phone && <span className="text-muted-foreground shrink-0">{lead.phone}</span>}
                    {lead.city && <span className="text-muted-foreground shrink-0">{lead.city}{lead.state ? `, ${lead.state}` : ""}</span>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Save to folder (optional)</Label>
                  <Select value={saveFolderId} onValueChange={(v) => setSaveFolderId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="No folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No folder</SelectItem>
                      {folders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input
                    placeholder="e.g. dentist"
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-medium">Leads saved!</p>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="text-emerald-600 font-medium">{saveResult.saved} saved</span>
                {saveResult.duplicates > 0 && <span>{saveResult.duplicates} duplicates</span>}
                {saveResult.failed > 0 && <span className="text-rose-500">{saveResult.failed} failed</span>}
              </div>
            </div>
          )}

          <Separator />
          <DialogFooter>
            {!saveResult ? (
              <>
                <Button variant="ghost" onClick={() => setSaveTarget(null)} disabled={saving}>Cancel</Button>
                <Button onClick={handleCommit} disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : `Save ${saveTarget?.leads.length ?? ""} leads`}
                </Button>
              </>
            ) : (
              <>
                <Link href="/leads">
                  <Button variant="outline" className="gap-1.5" onClick={() => setSaveTarget(null)}>
                    Go to Leads <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button onClick={() => { setSaveTarget(null); setSaveResult(null); }}>Done</Button>
              </>
            )}
          </DialogFooter>
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
