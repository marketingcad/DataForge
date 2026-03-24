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
} from "lucide-react";
import { useRouter } from "next/navigation";

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

  async function handleRunNow(id: string) {
    const res = await fetch(`/api/keywords/${id}/run`, { method: "POST" });
    if (res.ok) {
      startTransition(() => router.refresh());
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
                    title="Run now"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run now
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
