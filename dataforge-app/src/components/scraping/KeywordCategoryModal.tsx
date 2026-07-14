"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Play,
  Square,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Loader2,
  Inbox,
  History,
  LayoutGrid,
  List,
  Folder,
  RefreshCw,
  Check,
  Star,
  Repeat2,
  Settings2,
  Copy,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

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
  autoRun: boolean;
  _count: { jobs: number; leads: number };
  jobs: {
    id: string;
    status: string;
    leadsProcessed: number;
    leadsDiscovered: number;
    errorMessage: string | null;
    createdAt: string;
    startedById?: string | null;
  }[];
}

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

/**
 * Category search/picker list shared by the "Move to folder" and
 * "Duplicate to folder" popovers. Defined at module scope (NOT inside
 * KeywordCategoryModal) so its component identity stays stable across the
 * modal's frequent re-renders — otherwise the cmdk <CommandInput> remounts on
 * every parent render and the user's typed search text is wiped.
 */
function CategoryPickerList({
  favorites,
  allCategories,
  onPick,
  onToggleFavorite,
  currentCat,
}: {
  favorites: string[];
  allCategories: string[];
  onPick: (cat: string) => void;
  onToggleFavorite: (e: React.MouseEvent, cat: string) => void;
  currentCat?: string;
}) {
  const favCats = favorites.filter((f) => allCategories.includes(f));
  const otherCats = allCategories.filter((c) => !favorites.includes(c));
  return (
    <Command>
      <CommandInput placeholder="Search categories…" />
      <CommandList>
        <CommandEmpty>No category found.</CommandEmpty>
        {favCats.length > 0 && (
          <>
            <CommandGroup heading="Favorites">
              {favCats.map((cat) => (
                <CommandItem
                  key={cat}
                  value={cat}
                  onSelect={() => onPick(cat)}
                  className="group flex items-center gap-2 pr-1"
                >
                  {currentCat !== undefined && (
                    <Check className={cn("h-4 w-4 shrink-0", currentCat === cat ? "opacity-100" : "opacity-0")} />
                  )}
                  <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />
                  <span className="flex-1 truncate">{cat}</span>
                  <button type="button" onClick={(e) => onToggleFavorite(e, cat)} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted" title="Remove from favorites">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading={favCats.length > 0 ? "All Categories" : undefined}>
          {otherCats.map((cat) => (
            <CommandItem
              key={cat}
              value={cat}
              onSelect={() => onPick(cat)}
              className="group flex items-center gap-2 pr-1"
            >
              {currentCat !== undefined && (
                <Check className={cn("h-4 w-4 shrink-0", currentCat === cat ? "opacity-100" : "opacity-0")} />
              )}
              <span className="flex-1 truncate">{cat}</span>
              <button type="button" onClick={(e) => onToggleFavorite(e, cat)} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted" title="Add to favorites">
                <Star className="h-3 w-3 text-muted-foreground" />
              </button>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/**
 * Multi-select category picker for the "Duplicate to folders" popover — lets the
 * user tick several categories and duplicate into all of them at once.
 */
function MultiCategoryPickerList({
  favorites,
  allCategories,
  selected,
  onToggle,
  onToggleFavorite,
  onConfirm,
}: {
  favorites: string[];
  allCategories: string[];
  selected: Set<string>;
  onToggle: (cat: string) => void;
  onToggleFavorite: (e: React.MouseEvent, cat: string) => void;
  onConfirm: () => void;
}) {
  const favCats = favorites.filter((f) => allCategories.includes(f));
  const otherCats = allCategories.filter((c) => !favorites.includes(c));

  const row = (cat: string, fav: boolean) => (
    <CommandItem
      key={cat}
      value={cat}
      onSelect={() => onToggle(cat)}
      className="group flex items-center gap-2 pr-1"
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          selected.has(cat) ? "bg-primary border-primary text-primary-foreground" : "border-input"
        )}
      >
        {selected.has(cat) && <Check className="h-3 w-3" />}
      </span>
      {fav && <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />}
      <span className="flex-1 truncate">{cat}</span>
      <button
        type="button"
        onClick={(e) => onToggleFavorite(e, cat)}
        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        title={fav ? "Remove from favorites" : "Add to favorites"}
      >
        <Star className={cn("h-3 w-3", fav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
      </button>
    </CommandItem>
  );

  return (
    <div className="flex flex-col">
      <Command>
        <CommandInput placeholder="Search categories…" />
        <CommandList>
          <CommandEmpty>No category found.</CommandEmpty>
          {favCats.length > 0 && (
            <>
              <CommandGroup heading="Favorites">{favCats.map((c) => row(c, true))}</CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup heading={favCats.length > 0 ? "All Categories" : undefined}>
            {otherCats.map((c) => row(c, false))}
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="flex items-center gap-2 border-t p-2">
        <span className="text-[11px] text-muted-foreground">{selected.size} selected</span>
        <Button
          size="sm"
          className="ml-auto h-7 text-xs"
          disabled={selected.size === 0}
          onClick={onConfirm}
        >
          {selected.size ? `Duplicate to ${selected.size} folder${selected.size !== 1 ? "s" : ""}` : "Duplicate"}
        </Button>
      </div>
    </div>
  );
}

interface KeywordCategoryModalProps {
  category: string;
  keywords: KeywordRow[];
  allCategories: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runningIds: Record<string, true>;
  runningJobIds: Record<string, string>;
  runningLabels: Record<string, string>;
  /** Boss/admin may stop any run. */
  canManageAll: boolean;
  /** Current user id — a specialist may stop only runs they started. */
  currentUserId: string;
  /** kwIds whose current run was started by this user this session (immediate stop). */
  startedByMe: Set<string>;
  onToggle: (id: string, enabled: boolean) => void;
  onRunNow: (kwId: string) => void;
  onStop: (kwId: string, jobId: string) => void;
  onAutoRun: (kwId: string) => void;
  onUpdateSetting: (kwId: string, data: Partial<KeywordRow>) => void;
  onEdit: (kw: KeywordRow) => void;
  onDelete: (kwId: string) => void;
  onViewLeads: (kw: KeywordRow) => void;
  onHistory: (kw: KeywordRow) => void;
  onMoveCategory: (kwId: string, newCategory: string) => void;
  onDuplicateMany: (kwId: string, targetCategories: string[]) => void;
}

export function KeywordCategoryModal({
  category,
  keywords,
  allCategories,
  open,
  onOpenChange,
  runningIds,
  runningJobIds,
  runningLabels,
  canManageAll,
  currentUserId,
  startedByMe,
  onToggle,
  onRunNow,
  onStop,
  onAutoRun,
  onUpdateSetting,
  onEdit,
  onDelete,
  onViewLeads,
  onHistory,
  onMoveCategory,
  onDuplicateMany,
}: KeywordCategoryModalProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [movingKwId, setMovingKwId] = useState<string | null>(null);
  const [duplicatingKwId, setDuplicatingKwId] = useState<string | null>(null);
  const [dupSelected, setDupSelected] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<string[]>([]);
  const [kwSearch, setKwSearch] = useState("");
  const [kwStatusFilter, setKwStatusFilter] = useState<"all" | "active" | "paused" | "disabled">("all");

  useEffect(() => {
    try {
      const v = localStorage.getItem("kw-favorite-categories");
      if (v) setFavorites(JSON.parse(v));
    } catch { /* ignore */ }
  }, []);

  function toggleFavorite(e: React.MouseEvent, cat: string) {
    e.stopPropagation();
    const next = favorites.includes(cat)
      ? favorites.filter((f) => f !== cat)
      : [...favorites, cat];
    setFavorites(next);
    localStorage.setItem("kw-favorite-categories", JSON.stringify(next));
  }

  useEffect(() => {
    const stored = localStorage.getItem("kw-cat-view");
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  function handleSetView(v: "grid" | "list") {
    setView(v);
    localStorage.setItem("kw-cat-view", v);
  }

  const isUncategorized = category === "Uncategorized";

  const filteredKeywords = keywords.filter((kw) => {
    const term = kwSearch.toLowerCase();
    if (term && !kw.keyword.toLowerCase().includes(term) && !kw.location.toLowerCase().includes(term)) return false;
    if (kwStatusFilter === "active" && (!kw.enabled || kw.failedAttempts >= 5)) return false;
    if (kwStatusFilter === "paused" && (kw.enabled || kw.failedAttempts >= 5)) return false;
    if (kwStatusFilter === "disabled" && kw.failedAttempts < 5) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0"
        style={{
          width: "calc(100vw - 100px)",
          maxWidth: "calc(100vw - 100px)",
          height: "calc(100vh - 120px)",
        }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0 bg-muted">
              {isUncategorized
                ? <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                : <Folder className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="truncate">{category}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px] font-medium px-1.5 py-0">
                  {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}
                </Badge>
              </DialogTitle>
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-md border overflow-hidden shrink-0">
              <button
                onClick={() => handleSetView("grid")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                )}
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleSetView("list")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                )}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Filter bar ── */}
        <div className="px-5 py-2 border-b shrink-0 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search keyword or location…"
              value={kwSearch}
              onChange={(e) => setKwSearch(e.target.value)}
            />
            {kwSearch && (
              <button onClick={() => setKwSearch("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(["all", "active", "paused", "disabled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setKwStatusFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                  kwStatusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {(kwSearch || kwStatusFilter !== "all") && (
            <span className="text-xs text-muted-foreground">
              {filteredKeywords.length} of {keywords.length}
            </span>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {keywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <p className="text-sm">No keywords in this category</p>
            </div>
          ) : filteredKeywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <p className="text-sm">No keywords match your filters</p>
              <button onClick={() => { setKwSearch(""); setKwStatusFilter("all"); }} className="text-xs text-primary hover:underline">
                Clear filters
              </button>
            </div>
          ) : view === "grid" ? (
            /* ── Grid view ── */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredKeywords.map((kw) => {
                const job = kw.jobs[0] ?? null;
                const hasFailed = kw.failedAttempts > 0;
                const isDisabledByFailure = !kw.enabled && kw.failedAttempts >= 5;
                const isRunning = !!runningIds[kw.id] || (job?.status === "running" || job?.status === "pending");
                const isAutoRunning = kw.autoRun;
                const stopJobId = runningJobIds[kw.id] ?? job?.id ?? "";
                // Only the person who started this run (or a boss/admin) may stop it.
                const canStop = canManageAll || startedByMe.has(kw.id) || job?.startedById === currentUserId;

                return (
                  <div key={kw.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                    {/* Name + location + toggle */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{kw.keyword}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          📍 <span className="truncate">{kw.location}</span>
                        </p>
                      </div>
                      <Switch
                        checked={kw.enabled}
                        onCheckedChange={(v) => onToggle(kw.id, v)}
                      />
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        up to {kw.maxLeads} leads/run
                      </span>
                      {isDisabledByFailure && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />Disabled
                        </Badge>
                      )}
                      {!kw.enabled && !isDisabledByFailure && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Paused</Badge>
                      )}
                      {kw.enabled && !hasFailed && (
                        <Badge variant="secondary" className="text-xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />Active
                        </Badge>
                      )}
                      {hasFailed && kw.enabled && (
                        <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                          <AlertTriangle className="h-3 w-3" />{kw.failedAttempts}/5 failures
                        </Badge>
                      )}
                    </div>

                    {/* View leads */}
                    <button
                      onClick={() => onViewLeads(kw)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors"
                    >
                      <Inbox className="h-3.5 w-3.5" />
                      View {kw._count.leads > 0 ? `${kw._count.leads} ` : ""}scraped leads
                    </button>

                    {/* Job status */}
                    {isRunning ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        <span className="truncate">{isAutoRunning ? `[Auto] ${runningLabels[kw.id] ?? "Starting…"}` : (runningLabels[kw.id] ?? "Starting…")}</span>
                      </div>
                    ) : isAutoRunning ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Auto run active — next run starting…
                      </div>
                    ) : job ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {job.status === "completed" && job.leadsProcessed > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />{job.leadsProcessed} saved
                            </span>
                          )}
                          {job.status === "completed" && job.leadsProcessed === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />No new leads
                            </span>
                          )}
                          {job.status === "running" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                              <Loader2 className="h-3 w-3 animate-spin" />Scraping…
                            </span>
                          )}
                          {job.status === "failed" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="h-3 w-3" />Failed
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                            {relativeTime(job.createdAt)}
                          </span>
                        </div>
                        {job.status === "completed" && job.leadsProcessed === 0 && job.errorMessage && !job.errorMessage.startsWith("Done") && !isRunning && Date.now() - new Date(job.createdAt).getTime() < 60 * 60 * 1000 && (
                          <span className="text-xs text-muted-foreground truncate">{job.errorMessage}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No runs yet</span>
                    )}

                    {/* Schedule mini-table */}
                    <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                      <div className="flex justify-between">
                        <span>Schedule</span>
                        <span className="font-medium text-foreground">{intervalLabel(kw.intervalMinutes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last run</span>
                        <span suppressHydrationWarning>{relativeTime(kw.lastRunAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Next</span>
                        <span>{kw.enabled ? nextRunLabel(kw.nextRunAt) : "Paused"}</span>
                      </div>
                    </div>

                    {kw.lastError && (
                      <p className="text-xs text-rose-500 truncate">Error: {kw.lastError}</p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 mt-auto">
                      {isAutoRunning ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 flex-1 text-rose-600 border-rose-300 hover:bg-rose-50"
                          onClick={() => onAutoRun(kw.id)}
                          title="Auto-run keeps scraping on the server until stopped"
                        >
                          <Square className="h-3.5 w-3.5" />Stop Auto
                        </Button>
                      ) : isRunning && canStop ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 flex-1 text-rose-600 border-rose-300 hover:bg-rose-50"
                          onClick={() => onStop(kw.id, stopJobId)}
                        >
                          <Square className="h-3.5 w-3.5" />Stop
                        </Button>
                      ) : isRunning ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="gap-1.5 h-8 flex-1 text-muted-foreground"
                          title="Only the person who started this run, or a boss/admin, can stop it"
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />Running…
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 flex-1"
                            onClick={() => onRunNow(kw.id)}
                            disabled={isRunning}
                          >
                            <Play className="h-3.5 w-3.5" />Run now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                            title="Auto run — repeats until stopped"
                            onClick={() => onAutoRun(kw.id)}
                            disabled={isRunning}
                          >
                            <Repeat2 className="h-3.5 w-3.5" />
                          </Button>
                          {/* Advanced settings popover */}
                          <Popover>
                            <PopoverTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background p-0 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-colors" title="Advanced options">
                              <Settings2 className="h-3.5 w-3.5" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" align="end">
                              <p className="text-xs font-semibold mb-2.5 text-foreground">Advanced options</p>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-medium">Cycle cities per run</p>
                                    <p className="text-[11px] text-muted-foreground">Alternate through cities in the state each run</p>
                                  </div>
                                  <Switch
                                    checked={kw.cityRotationEnabled ?? true}
                                    onCheckedChange={(v) => onUpdateSetting(kw.id, { cityRotationEnabled: v })}
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-medium">Grab email from website</p>
                                    <p className="text-[11px] text-muted-foreground">Visit each lead&apos;s website to find a contact email</p>
                                  </div>
                                  <Switch
                                    checked={kw.grabEmail ?? false}
                                    onCheckedChange={(v) => onUpdateSetting(kw.id, { grabEmail: v })}
                                  />
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title="Run history" onClick={() => onHistory(kw)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => onEdit(kw)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* Move to folder */}
                      <Popover open={movingKwId === kw.id} onOpenChange={(o) => setMovingKwId(o ? kw.id : null)}>
                        <PopoverTrigger
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Move to category"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[240px]" align="end">
                          <CategoryPickerList
                            favorites={favorites}
                            allCategories={allCategories}
                            currentCat={kw.category || "Uncategorized"}
                            onToggleFavorite={toggleFavorite}
                            onPick={(cat) => { onMoveCategory(kw.id, cat); setMovingKwId(null); }}
                          />
                        </PopoverContent>
                      </Popover>
                      {/* Duplicate to folders (multi-select) */}
                      <Popover open={duplicatingKwId === kw.id} onOpenChange={(o) => { setDuplicatingKwId(o ? kw.id : null); setDupSelected(new Set()); }}>
                        <PopoverTrigger
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Duplicate to other folders"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[260px]" align="end">
                          <div className="px-3 py-2 border-b">
                            <p className="text-xs font-semibold">Duplicate to folders</p>
                            <p className="text-[11px] text-muted-foreground">Pick one or more — a copy is made in each</p>
                          </div>
                          <MultiCategoryPickerList
                            favorites={favorites}
                            allCategories={allCategories}
                            selected={dupSelected}
                            onToggleFavorite={toggleFavorite}
                            onToggle={(cat) => setDupSelected((prev) => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; })}
                            onConfirm={() => { onDuplicateMany(kw.id, [...dupSelected]); setDuplicatingKwId(null); setDupSelected(new Set()); }}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500" onClick={() => onDelete(kw.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── List view ── */
            <div className="divide-y">
              {filteredKeywords.map((kw) => {
                const job = kw.jobs[0] ?? null;
                const hasFailed = kw.failedAttempts > 0;
                const isDisabledByFailure = !kw.enabled && kw.failedAttempts >= 5;
                const isRunning = !!runningIds[kw.id] || (job?.status === "running" || job?.status === "pending");
                const isAutoRunning = kw.autoRun;
                const stopJobId = runningJobIds[kw.id] ?? job?.id ?? "";
                // Only the person who started this run (or a boss/admin) may stop it.
                const canStop = canManageAll || startedByMe.has(kw.id) || job?.startedById === currentUserId;

                return (
                  <div key={kw.id} className="px-5 py-4 flex items-start gap-4">
                    {/* Enable toggle */}
                    <div className="pt-0.5">
                      <Switch
                        checked={kw.enabled}
                        onCheckedChange={(v) => onToggle(kw.id, v)}
                      />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Name + badges row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{kw.keyword}</span>
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          📍 {kw.location}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          up to {kw.maxLeads} leads/run
                        </span>
                        {isDisabledByFailure && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />Disabled (5 failures)
                          </Badge>
                        )}
                        {!kw.enabled && !isDisabledByFailure && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Paused</Badge>
                        )}
                        {kw.enabled && !hasFailed && (
                          <Badge variant="secondary" className="text-xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />Active
                          </Badge>
                        )}
                        {hasFailed && kw.enabled && (
                          <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                            <AlertTriangle className="h-3 w-3" />{kw.failedAttempts}/5 failures
                          </Badge>
                        )}
                        <button
                          onClick={() => onViewLeads(kw)}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <Inbox className="h-3 w-3" />
                          View {kw._count.leads > 0 ? `${kw._count.leads} ` : ""}scraped leads
                        </button>
                      </div>

                      {/* Job status */}
                      {isRunning ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                          <span>{isAutoRunning ? `[Auto] ${runningLabels[kw.id] ?? "Starting…"}` : (runningLabels[kw.id] ?? "Starting…")}</span>
                        </div>
                      ) : isAutoRunning ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          Auto run active — next run starting…
                        </div>
                      ) : job ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {job.status === "completed" && job.leadsProcessed > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />{job.leadsProcessed} lead{job.leadsProcessed !== 1 ? "s" : ""} saved last run
                              </span>
                            )}
                            {job.status === "completed" && job.leadsProcessed === 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" />No new leads
                              </span>
                            )}
                            {job.status === "running" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                                <Loader2 className="h-3 w-3 animate-spin" />Scraping…
                              </span>
                            )}
                            {job.status === "failed" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="h-3 w-3" />Last run failed
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                              {relativeTime(job.createdAt)}
                            </span>
                          </div>
                          {job.status === "completed" && job.leadsProcessed === 0 && job.errorMessage && !job.errorMessage.startsWith("Done") && !isRunning && Date.now() - new Date(job.createdAt).getTime() < 60 * 60 * 1000 && (
                            <span className="text-xs text-muted-foreground truncate max-w-xs">{job.errorMessage}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No runs yet</span>
                      )}

                      {/* Schedule row */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{intervalLabel(kw.intervalMinutes)}</span>
                        <span suppressHydrationWarning>Last run: {relativeTime(kw.lastRunAt)}</span>
                        <span>Next: {kw.enabled ? nextRunLabel(kw.nextRunAt) : "Paused"}</span>
                        <span>{kw._count.jobs} run{kw._count.jobs !== 1 ? "s" : ""} total</span>
                      </div>

                      {kw.lastError && (
                        <p className="text-xs text-rose-500 truncate max-w-xl">Error: {kw.lastError}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isAutoRunning ? (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-rose-600 border-rose-300 hover:bg-rose-50" onClick={() => onAutoRun(kw.id)} title="Auto-run keeps scraping on the server until stopped">
                          <Square className="h-3.5 w-3.5" />Stop Auto
                        </Button>
                      ) : isRunning && canStop ? (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-rose-600 border-rose-300 hover:bg-rose-50" onClick={() => onStop(kw.id, stopJobId)}>
                          <Square className="h-3.5 w-3.5" />Stop
                        </Button>
                      ) : isRunning ? (
                        <Button size="sm" variant="outline" disabled className="gap-1.5 h-8 text-muted-foreground" title="Only the person who started this run, or a boss/admin, can stop it">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />Running…
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => onRunNow(kw.id)} disabled={isRunning}>
                            <Play className="h-3.5 w-3.5" />Run now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                            title="Auto run — repeats until stopped"
                            onClick={() => onAutoRun(kw.id)}
                            disabled={isRunning}
                          >
                            <Repeat2 className="h-3.5 w-3.5" />
                          </Button>
                          {/* Advanced settings popover */}
                          <Popover>
                            <PopoverTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background p-0 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-colors" title="Advanced options">
                              <Settings2 className="h-3.5 w-3.5" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" align="end">
                              <p className="text-xs font-semibold mb-2.5 text-foreground">Advanced options</p>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-medium">Cycle cities per run</p>
                                    <p className="text-[11px] text-muted-foreground">Alternate through cities in the state each run</p>
                                  </div>
                                  <Switch
                                    checked={kw.cityRotationEnabled ?? true}
                                    onCheckedChange={(v) => onUpdateSetting(kw.id, { cityRotationEnabled: v })}
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-medium">Grab email from website</p>
                                    <p className="text-[11px] text-muted-foreground">Visit each lead&apos;s website to find a contact email</p>
                                  </div>
                                  <Switch
                                    checked={kw.grabEmail ?? false}
                                    onCheckedChange={(v) => onUpdateSetting(kw.id, { grabEmail: v })}
                                  />
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title="Run history" onClick={() => onHistory(kw)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => onEdit(kw)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* Move to folder */}
                      <Popover open={movingKwId === kw.id} onOpenChange={(o) => setMovingKwId(o ? kw.id : null)}>
                        <PopoverTrigger
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Move to category"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[240px]" align="end">
                          <CategoryPickerList
                            favorites={favorites}
                            allCategories={allCategories}
                            currentCat={kw.category || "Uncategorized"}
                            onToggleFavorite={toggleFavorite}
                            onPick={(cat) => { onMoveCategory(kw.id, cat); setMovingKwId(null); }}
                          />
                        </PopoverContent>
                      </Popover>
                      {/* Duplicate to folders (multi-select) */}
                      <Popover open={duplicatingKwId === kw.id} onOpenChange={(o) => { setDuplicatingKwId(o ? kw.id : null); setDupSelected(new Set()); }}>
                        <PopoverTrigger
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Duplicate to other folders"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[260px]" align="end">
                          <div className="px-3 py-2 border-b">
                            <p className="text-xs font-semibold">Duplicate to folders</p>
                            <p className="text-[11px] text-muted-foreground">Pick one or more — a copy is made in each</p>
                          </div>
                          <MultiCategoryPickerList
                            favorites={favorites}
                            allCategories={allCategories}
                            selected={dupSelected}
                            onToggleFavorite={toggleFavorite}
                            onToggle={(cat) => setDupSelected((prev) => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; })}
                            onConfirm={() => { onDuplicateMany(kw.id, [...dupSelected]); setDuplicatingKwId(null); setDupSelected(new Set()); }}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500" onClick={() => onDelete(kw.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
