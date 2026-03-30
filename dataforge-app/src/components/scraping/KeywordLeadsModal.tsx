"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  bulkDeleteLeadsAction,
  deleteAllKeywordLeadsAction,
  moveLeadsToFolderAction,
} from "@/actions/leads.actions";
import { getFoldersAction, createFolderAction } from "@/actions/folders.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Phone, Globe, Loader2,
  ChevronLeft, ChevronRight, Trash2, Download,
  AlertTriangle, Check, ChevronDown, CheckCircle2,
  Copy, MapPin, MoreHorizontal, ExternalLink, FolderOpen,
  FolderPlus, Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/notifications";
import { formatPhone } from "@/lib/utils/normalize";
import { toast } from "sonner";

type Lead = {
  id: string;
  businessName: string;
  phone: string;
  email: string | null;
  website: string | null;
  contactPerson: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  dataQualityScore: number;
};

type FolderItem = {
  id: string;
  name: string;
  color: string;
  _count: { leads: number };
  industry: { id: string; name: string; color: string } | null;
};

type SortOption = "name_asc" | "name_desc" | "newest" | "oldest";
type SearchField = "business" | "contact" | "location" | "phone" | "email" | "website";

const SORT_LABELS: Record<SortOption, string> = {
  name_asc:  "Name A→Z",
  name_desc: "Name Z→A",
  newest:    "Newest",
  oldest:    "Oldest",
};

const SEARCH_FIELDS: { value: SearchField; label: string; placeholder: string }[] = [
  { value: "business",  label: "Business",  placeholder: "Search by business name…" },
  { value: "contact",   label: "Contact",   placeholder: "Search by contact person…" },
  { value: "location",  label: "Location",  placeholder: "Search by city or state…" },
  { value: "phone",     label: "Phone",     placeholder: "Search by phone number…" },
  { value: "email",     label: "Email",     placeholder: "Search by email address…" },
  { value: "website",   label: "Website",   placeholder: "Search by website…" },
];

const PRESET_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#64748b", label: "Slate" },
];

interface Props {
  kwId: string;
  keyword: string;
  location: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadsDeleted?: (count: number) => void;
}

function CopyCell({ value, className, children }: { value: string | null | undefined; className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted-foreground select-none">—</span>;
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(value!).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <div className={cn("group/copy flex items-center gap-1 min-w-0 max-w-full", className)}>
      <div
        className="relative flex-1 overflow-hidden min-w-0"
        style={{
          maskImage: "linear-gradient(to right, black 82%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black 82%, transparent 100%)",
        }}
      >
        {children ?? <span className="whitespace-nowrap text-sm">{value}</span>}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 opacity-0 group-hover/copy:opacity-100 transition-opacity text-muted-foreground hover:text-foreground ml-0.5"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function scoreBadgeStyle(score: number) {
  if (score >= 70) return "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800";
  if (score >= 40) return "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800";
  return "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800";
}

function exportToCSV(leads: Lead[], filename: string) {
  const headers = ["Business Name", "Phone", "Website", "Address", "City", "State", "Score"];
  const rows = leads.map((l) => [
    l.businessName, l.phone, l.website ?? "",
    l.address ?? "", l.city ?? "", l.state ?? "", String(l.dataQualityScore),
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function KeywordLeadsModal({ kwId, keyword, location, open, onOpenChange, onLeadsDeleted }: Props) {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [search, setSearch]         = useState("");
  const [debSearch, setDebSearch]   = useState("");
  const [searchField, setSearchField] = useState<SearchField>("business");
  const [sort, setSort]             = useState<SortOption>("newest");
  const [stateFilter, setStateFilter] = useState("");
  const [hasEmail, setHasEmail]     = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<"selected" | "all" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [exporting, setExporting]   = useState(false);

  // Save to folder state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderScope, setFolderScope] = useState<"selected" | "all">("selected");
  const [folders, setFolders]       = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("none");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(PRESET_COLORS[0].value);
  const [folderSearch, setFolderSearch] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  const { add: addNotif } = useNotifications();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [debSearch, searchField, sort, stateFilter, hasEmail, hasWebsite]);

  const fetchLeads = useCallback(async () => {
    if (!open || !kwId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        search: debSearch,
        searchField,
        sort,
        state: stateFilter,
        ...(hasEmail   ? { hasEmail: "1" }   : {}),
        ...(hasWebsite ? { hasWebsite: "1" } : {}),
      });
      const res = await fetch(`/api/keywords/${kwId}/leads?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setLeads(data.leads as Lead[]);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [open, kwId, debSearch, searchField, sort, page, stateFilter, hasEmail, hasWebsite]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (!open) {
      setSearch(""); setDebSearch(""); setSearchField("business"); setPage(1);
      setSelected(new Set()); setConfirmDelete(null); setConfirmDeleteId(null);
      setStateFilter(""); setHasEmail(false); setHasWebsite(false);
      setFolderModalOpen(false);
    }
  }, [open]);

  // Load folders when folder modal opens
  useEffect(() => {
    if (!folderModalOpen) return;
    setLoadingFolders(true);
    getFoldersAction()
      .then((f) => setFolders(f as unknown as FolderItem[]))
      .catch(() => toast.error("Could not load folders"))
      .finally(() => setLoadingFolders(false));
    setSelectedFolder("none");
    setCreatingNew(false);
    setNewFolderName("");
    setNewFolderColor(PRESET_COLORS[0].value);
    setFolderSearch("");
  }, [folderModalOpen]);

  const activeField = SEARCH_FIELDS.find((f) => f.value === searchField) ?? SEARCH_FIELDS[0];
  const allOnPageSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => { const s = new Set(prev); leads.forEach((l) => s.delete(l.id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); leads.forEach((l) => s.add(l.id)); return s; });
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      if (confirmDelete === "all") {
        const count = total;
        await deleteAllKeywordLeadsAction(kwId);
        addNotif({ type: "warning", title: "All leads deleted", message: `Cleared all leads for "${keyword} — ${location}".` });
        setTotal(0); setLeads([]);
        onLeadsDeleted?.(count);
      } else if (confirmDelete === "selected") {
        const ids = Array.from(selected);
        await bulkDeleteLeadsAction(ids);
        addNotif({ type: "warning", title: `${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`, message: `Removed from "${keyword} — ${location}".` });
        setSelected(new Set());
        onLeadsDeleted?.(ids.length);
        await fetchLeads();
      } else if (confirmDeleteId) {
        await bulkDeleteLeadsAction([confirmDeleteId]);
        addNotif({ type: "warning", title: "Lead deleted", message: `Removed from "${keyword} — ${location}".` });
        onLeadsDeleted?.(1);
        await fetchLeads();
      }
    } catch {
      addNotif({ type: "error", title: "Delete failed", message: "Something went wrong. Please try again." });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleExport(scope: "selected" | "all") {
    setExporting(true);
    try {
      let toExport: Lead[];
      if (scope === "selected") {
        toExport = leads.filter((l) => selected.has(l.id));
      } else {
        const res = await fetch(`/api/keywords/${kwId}/leads?page=1&pageSize=999999&sort=${sort}`);
        const data = await res.json();
        toExport = data.leads as Lead[];
      }
      exportToCSV(toExport, `${keyword.replace(/\s+/g, "_")}_${location.replace(/\s+/g, "_")}_leads.csv`);
      addNotif({ type: "success", title: `${toExport.length} lead${toExport.length !== 1 ? "s" : ""} exported`, message: `Saved as CSV for "${keyword} — ${location}".` });
    } catch {
      addNotif({ type: "error", title: "Export failed", message: "Something went wrong. Please try again." });
    } finally {
      setExporting(false);
    }
  }

  function openSaveToFolder(scope: "selected" | "all") {
    setFolderScope(scope);
    setFolderModalOpen(true);
  }

  async function handleSaveToFolder() {
    if (selectedFolder === "none" && !creatingNew) {
      toast.error("Please select a folder.");
      return;
    }
    setSavingFolder(true);
    try {
      let folderId: string | null = null;

      if (creatingNew || selectedFolder === "new") {
        if (!newFolderName.trim()) { toast.error("Please enter a folder name."); setSavingFolder(false); return; }
        const created = await createFolderAction(newFolderName.trim(), newFolderColor, null) as { id: string; name: string; color: string };
        folderId = created.id;
        setFolders((prev) => [...prev, { ...created, _count: { leads: 0 }, industry: null }]);
      } else {
        folderId = selectedFolder === "none" ? null : selectedFolder;
      }

      // Collect IDs to move
      let ids: string[];
      if (folderScope === "all") {
        const res = await fetch(`/api/keywords/${kwId}/leads?page=1&pageSize=999999`);
        const data = await res.json();
        ids = (data.leads as Lead[]).map((l) => l.id);
      } else {
        ids = Array.from(selected);
      }

      await moveLeadsToFolderAction(ids, folderId);

      const folderName = folderId
        ? (folders.find((f) => f.id === folderId)?.name ?? newFolderName.trim())
        : "Unfiled";
      addNotif({
        type: "success",
        title: `${ids.length} lead${ids.length !== 1 ? "s" : ""} saved to "${folderName}"`,
        message: `From "${keyword} — ${location}".`,
      });
      setFolderModalOpen(false);
      setSelected(new Set());
    } catch {
      toast.error("Failed to save leads to folder.");
    } finally {
      setSavingFolder(false);
    }
  }

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(folderSearch.toLowerCase())
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex flex-col p-0 gap-0"
          style={{ width: "calc(100vw - 100px)", maxWidth: "calc(100vw - 100px)", height: "calc(100vh - 120px)" }}
        >
          {/* ── Header ── */}
          <DialogHeader className="px-5 py-3 border-b shrink-0">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
              <span>Auto Keywords</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <span className="font-medium text-foreground truncate">{keyword}</span>
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <MapPin className="h-3 w-3" />{location}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{keyword} — {location}</span>
                  <Badge className="shrink-0 text-[10px] font-medium px-1.5 py-0 bg-primary/10 text-primary border-none">
                    {total} lead{total !== 1 ? "s" : ""}
                  </Badge>
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {/* ── Toolbar ── */}
          <div className="px-4 pt-2.5 pb-2 border-b shrink-0 space-y-2">
            {/* Row 1 — search + sort + actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="flex flex-1 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring transition-colors">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium border-r border-input bg-muted/50 hover:bg-muted shrink-0 transition-colors outline-none"
                      />
                    }
                  >
                    <span className="text-foreground">{activeField.label}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36">
                    {SEARCH_FIELDS.map((f) => (
                      <DropdownMenuItem
                        key={f.value}
                        className="text-xs cursor-pointer gap-2"
                        onClick={() => { setSearchField(f.value); setSearch(""); }}
                      >
                        {f.label}
                        {searchField === f.value && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={activeField.placeholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 h-8 text-xs border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-0"
                  />
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0" />}
                >
                  <span>{SORT_LABELS[sort]}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([val, label]) => (
                    <DropdownMenuItem key={val} className="text-xs cursor-pointer" onClick={() => setSort(val)}>
                      {label}
                      {sort === val && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-4" />

              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0"
                onClick={() => openSaveToFolder("all")} disabled={total === 0}>
                <FolderOpen className="h-3 w-3" />
                Save to folder
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0"
                onClick={() => handleExport("all")} disabled={exporting || total === 0}>
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Export
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete("all")} disabled={total === 0}>
                <Trash2 className="h-3 w-3" />
                Delete all
              </Button>
            </div>

            {/* Row 2 — filters */}
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">State</span>
                <Input
                  placeholder="e.g. TX, CA…"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="h-7 w-24 text-xs"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">Has data</span>
                <div className="flex items-center gap-1.5">
                  {([
                    { key: "email",   label: "Email",   val: hasEmail,   set: setHasEmail },
                    { key: "website", label: "Website", val: hasWebsite, set: setHasWebsite },
                  ] as const).map(({ key, label, val, set }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set(!val)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all select-none",
                        val
                          ? "border-foreground/20 bg-foreground text-background"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      )}
                    >
                      {val && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {(stateFilter || hasEmail || hasWebsite) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground self-end"
                  onClick={() => { setStateFilter(""); setHasEmail(false); setHasWebsite(false); }}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* ── Bulk action bar ── */}
          {someSelected && (
            <div className="px-4 py-2 border-b bg-primary/5 flex items-center gap-3 shrink-0">
              <span className="text-xs font-medium text-primary">{selected.size} selected</span>
              <div className="flex gap-1.5 ml-auto">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                  onClick={() => openSaveToFolder("selected")}>
                  <FolderOpen className="h-3.5 w-3.5" />
                  Save to folder
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                  onClick={() => handleExport("selected")} disabled={exporting}>
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Export
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete("selected")}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* ── Confirm delete bar ── */}
          {(confirmDelete || confirmDeleteId) && (
            <div className="px-4 py-2.5 border-b bg-destructive/5 flex items-center gap-3 shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive flex-1">
                {confirmDelete === "all"
                  ? `Delete ALL ${total} leads for this keyword? This cannot be undone.`
                  : confirmDelete === "selected"
                  ? `Delete ${selected.size} selected lead${selected.size !== 1 ? "s" : ""}? This cannot be undone.`
                  : "Delete this lead? This cannot be undone."}
              </p>
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5"
                onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => { setConfirmDelete(null); setConfirmDeleteId(null); }} disabled={deleting}>
                Cancel
              </Button>
            </div>
          )}

          {/* ── Table ── */}
          <div className="flex-1 overflow-auto relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                <Loader2 className="h-9 w-9 animate-spin text-primary" />
              </div>
            )}

            {!loading && leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <MapPin className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm">{debSearch || stateFilter || hasEmail || hasWebsite ? "No leads match your filters" : "No leads scraped yet for this keyword"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-background w-10">
                      <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead className="sticky top-0 bg-background w-8 text-center">#</TableHead>
                    <TableHead className="sticky top-0 bg-background">Business</TableHead>
                    <TableHead className="sticky top-0 bg-background w-36">Address</TableHead>
                    <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                    <TableHead className="sticky top-0 bg-background">Website</TableHead>
                    <TableHead className="sticky top-0 bg-background text-center w-20">Score</TableHead>
                    <TableHead className="sticky top-0 bg-background w-12 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead, idx) => (
                    <TableRow
                      key={lead.id}
                      data-state={selected.has(lead.id) ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => toggleOne(lead.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono text-center">
                        {(page - 1) * 20 + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium max-w-[180px]">
                        <CopyCell value={lead.businessName} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground w-36">
                        <CopyCell value={lead.address ?? ([lead.city, lead.state].filter(Boolean).join(", ") || null)} />
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        <CopyCell value={lead.phone}>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />{formatPhone(lead.phone)}
                          </span>
                        </CopyCell>
                      </TableCell>
                      <TableCell className="text-sm max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                        <CopyCell value={lead.website}>
                          <a
                            href={lead.website?.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-500 hover:underline whitespace-nowrap"
                          >
                            <Globe className="h-3 w-3 shrink-0" />
                            {lead.website?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                          </a>
                        </CopyCell>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn("text-xs tabular-nums font-semibold", scoreBadgeStyle(lead.dataQualityScore))}
                        >
                          {lead.dataQualityScore}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button variant="ghost" size="icon" className="h-7 w-7" />
                          }>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              className="text-xs gap-2 cursor-pointer"
                              onClick={() => window.open(`/leads/${lead.id}`, "_blank")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View lead
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-xs gap-2 cursor-pointer"
                              onClick={() => { setFolderScope("selected"); setSelected(new Set([lead.id])); setFolderModalOpen(true); }}
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              Save to folder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                              onClick={() => setConfirmDeleteId(lead.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t shrink-0 bg-background">
              <p className="text-xs text-muted-foreground">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs px-2 tabular-nums">{page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Save to folder modal ── */}
      <Dialog open={folderModalOpen} onOpenChange={(v) => { if (!v) setFolderModalOpen(false); }}>
        <DialogContent showCloseButton className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle className="text-sm font-semibold">
              Save {folderScope === "all" ? `all ${total} leads` : `${selected.size} lead${selected.size !== 1 ? "s" : ""}`} to folder
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {loadingFolders ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Folder search */}
                {folders.length > 4 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search folders…"
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                )}

                <RadioGroup value={selectedFolder} onValueChange={(v) => { setSelectedFolder(v); setCreatingNew(v === "new"); }}>
                  {/* Unfiled */}
                  <label className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="none" id="folder-none" />
                    <span className="text-sm">Unfiled</span>
                  </label>

                  {filteredFolders.map((f) => (
                    <label key={f.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                      <RadioGroupItem value={f.id} id={`folder-${f.id}`} />
                      <Folder className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{f._count.leads}</Badge>
                    </label>
                  ))}

                  {/* Create new */}
                  <label className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="new" id="folder-new" />
                    <FolderPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">Create new folder…</span>
                  </label>
                </RadioGroup>

                {/* New folder form */}
                {(creatingNew || selectedFolder === "new") && (
                  <div className="pl-8 space-y-2.5 pt-1">
                    <Input
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          title={c.label}
                          onClick={() => setNewFolderColor(c.value)}
                          className={cn(
                            "h-5 w-5 rounded-full border-2 transition-all",
                            newFolderColor === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFolderModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSaveToFolder} disabled={savingFolder || loadingFolders}>
              {savingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderOpen className="h-3 w-3" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

