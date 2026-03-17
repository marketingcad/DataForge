"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getLeadsForFolderAction,
  getAllLeadsForExportAction,
  bulkDeleteLeadsAction,
} from "@/actions/leads.actions";
import { deleteFolderAction, updateFolderCategoryAction } from "@/actions/folders.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Folder, Search, Phone, Globe, Mail, Loader2,
  ChevronLeft, ChevronRight, Trash2, Download,
  MoreVertical, Tags, AlertTriangle, Check, ChevronDown, CheckCircle2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/notifications";

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
  country: string | null;
  dataQualityScore: number;
};

type SortOption = "name_asc" | "name_desc" | "newest" | "oldest";
type SearchField = "business" | "contact" | "location" | "phone" | "email" | "website" | "score";

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
  { value: "score",     label: "Score",     placeholder: "Min score (e.g. 70)…" },
];

type FolderInfo = { id: string; name: string; color: string };
type IndustryOption = { id: string; name: string; color: string };

interface Props {
  folder: FolderInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allIndustries?: IndustryOption[];
  currentIndustryId?: string | null;
  onFolderDeleted?: (id: string) => void;
  onCategoryChanged?: (id: string) => void;
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
  const headers = ["Business Name", "Contact", "Phone", "Email", "Website", "City", "State", "Score"];
  const rows = leads.map((l) => [
    l.businessName, l.contactPerson ?? "", l.phone,
    l.email ?? "", l.website ?? "", l.city ?? "", l.state ?? "",
    String(l.dataQualityScore),
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

export function FolderLeadsModal({
  folder, open, onOpenChange,
  allIndustries = [], currentIndustryId,
  onFolderDeleted, onCategoryChanged,
}: Props) {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [search, setSearch]         = useState("");
  const [debSearch, setDebSearch]   = useState("");
  const [searchField, setSearchField] = useState<SearchField>("business");
  const [sort, setSort]             = useState<SortOption>("newest");
  const [minScore, setMinScore]     = useState<string>("");
  const [maxScore, setMaxScore]     = useState<string>("");
  const [status, setStatus]         = useState<string>("");
  const [stateFilter, setStateFilter] = useState<string>("");
  const [hasEmail, setHasEmail]     = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [hasContact, setHasContact] = useState(false);
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<"selected" | "all" | "folder" | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [exporting, setExporting]   = useState(false);

  // Change category
  const { add: addNotif } = useNotifications();

  const [showChangeCategory, setShowChangeCategory] = useState(false);
  const [categorySearch, setCategorySearch]         = useState("");
  const [savingCategory, setSavingCategory]         = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [debSearch, searchField, sort, minScore, maxScore, status, stateFilter, hasEmail, hasWebsite, hasContact]);

  const fetchLeads = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const r = await getLeadsForFolderAction({
        folderId: folder.id,
        search: debSearch,
        searchField,
        sort,
        page,
        minScore: minScore !== "" ? Number(minScore) : undefined,
        maxScore: maxScore !== "" ? Number(maxScore) : undefined,
        status,
        state: stateFilter,
        hasEmail: hasEmail || undefined,
        hasWebsite: hasWebsite || undefined,
        hasContact: hasContact || undefined,
      });
      setLeads(r.leads as Lead[]);
      setTotal(r.total);
      setTotalPages(r.totalPages);
    } finally {
      setLoading(false);
    }
  }, [open, folder.id, debSearch, searchField, sort, page, minScore, maxScore, status, stateFilter, hasEmail, hasWebsite, hasContact]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (!open) {
      setSearch(""); setDebSearch(""); setSearchField("business"); setPage(1);
      setSelected(new Set()); setConfirmDelete(null);
      setMinScore(""); setMaxScore("");
      setStatus(""); setStateFilter("");
      setHasEmail(false); setHasWebsite(false); setHasContact(false);
    }
  }, [open]);

  const hasActiveFilters = minScore || maxScore || status || stateFilter || hasEmail || hasWebsite || hasContact;

  function clearFilters() {
    setMinScore(""); setMaxScore("");
    setStatus(""); setStateFilter("");
    setHasEmail(false); setHasWebsite(false); setHasContact(false);
  }

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
      if (confirmDelete === "folder") {
        await deleteFolderAction(folder.id);
        addNotif({ type: "success", title: `Folder deleted`, message: `"${folder.name}" has been removed.` });
        onOpenChange(false);
        onFolderDeleted?.(folder.id);
      } else if (confirmDelete === "all") {
        const all = await getAllLeadsForExportAction(folder.id);
        await bulkDeleteLeadsAction((all.leads as Lead[]).map((l) => l.id));
        addNotif({ type: "warning", title: `All leads deleted`, message: `Cleared all leads from "${folder.name}".` });
        setTotal(0); setLeads([]);
      } else if (confirmDelete === "selected") {
        const ids = Array.from(selected);
        await bulkDeleteLeadsAction(ids);
        addNotif({ type: "warning", title: `${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`, message: `Removed from "${folder.name}".` });
        setSelected(new Set());
        await fetchLeads();
      }
    } catch {
      addNotif({ type: "error", title: "Delete failed", message: "Something went wrong. Please try again." });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  async function handleExport(scope: "selected" | "all") {
    setExporting(true);
    try {
      const toExport = scope === "selected"
        ? leads.filter((l) => selected.has(l.id))
        : (await getAllLeadsForExportAction(folder.id)).leads as Lead[];
      exportToCSV(toExport, `${folder.name.replace(/\s+/g, "_")}_leads.csv`);
      addNotif({ type: "success", title: `${toExport.length} lead${toExport.length !== 1 ? "s" : ""} exported`, message: `Saved as CSV from "${folder.name}".` });
    } catch {
      addNotif({ type: "error", title: "Export failed", message: "Something went wrong. Please try again." });
    } finally {
      setExporting(false);
    }
  }

  async function handleChangeCategory(industryId: string | null) {
    setSavingCategory(true);
    try {
      await updateFolderCategoryAction(folder.id, industryId);
      const name = allIndustries.find((i) => i.id === industryId)?.name ?? "Uncategorized";
      addNotif({ type: "info", title: `Category changed`, message: `"${folder.name}" moved to ${name}.` });
      setShowChangeCategory(false);
      setCategorySearch("");
      onOpenChange(false);
      onCategoryChanged?.(folder.id);
    } catch {
      addNotif({ type: "error", title: "Category change failed", message: "Something went wrong. Please try again." });
    } finally {
      setSavingCategory(false);
    }
  }

  const filteredCategories = categorySearch.trim()
    ? allIndustries.filter((i) => i.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : allIndustries;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex flex-col p-0 gap-0"
          style={{ width: "calc(100vw - 100px)", maxWidth: "calc(100vw - 100px)", height: "calc(100vh - 120px)" }}
        >
          {/* ── Header ── */}
          <DialogHeader className="px-5 py-3 border-b shrink-0">
            {/* Breadcrumb */}
            {(() => {
              const currentIndustry = allIndustries.find((i) => i.id === currentIndustryId) ?? null;
              return (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
                  <span>All Categories</span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  {currentIndustry ? (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0 inline-block" style={{ backgroundColor: currentIndustry.color }} />
                      <span className="font-medium text-foreground">{currentIndustry.name}</span>
                    </span>
                  ) : (
                    <span className="font-medium text-foreground">Uncategorized</span>
                  )}
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  <span className="font-medium text-foreground truncate">{folder.name}</span>
                </div>
              );
            })()}
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                style={{ backgroundColor: folder.color + "22" }}
              >
                <Folder className="h-3.5 w-3.5" style={{ color: folder.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{folder.name}</span>
                  <Badge
                    className="shrink-0 text-[10px] font-medium px-1.5 py-0"
                    style={{ backgroundColor: folder.color + "18", color: folder.color, border: "none" }}
                  >
                    {total} lead{total !== 1 ? "s" : ""}
                  </Badge>
                </DialogTitle>
              </div>

              {/* Folder-only 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" />}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {allIndustries.length > 0 && (
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-xs"
                      onClick={() => { setCategorySearch(""); setShowChangeCategory(true); }}
                    >
                      <Tags className="h-3 w-3" />
                      Change category
                    </DropdownMenuItem>
                  )}
                  {allIndustries.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive"
                    onClick={() => setConfirmDelete("folder")}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogHeader>

          {/* ── Toolbar ── */}
          <div className="px-4 pt-2.5 pb-2 border-b shrink-0 space-y-2">

            {/* Row 1 — search + sort + lead actions */}
            <div className="flex items-center gap-2">
              {/* Search field selector + input group */}
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

              {/* Score range */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Score range</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min={0} max={100} placeholder="0"
                    value={minScore} onChange={(e) => setMinScore(e.target.value)}
                    className="h-7 w-12 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-muted-foreground">–</span>
                  <Input
                    type="number" min={0} max={100} placeholder="100"
                    value={maxScore} onChange={(e) => setMaxScore(e.target.value)}
                    className="h-7 w-12 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" className="h-7 gap-1 text-xs w-28 justify-between" />}
                  >
                    <span className={status ? "" : "text-muted-foreground"}>
                      {status === "active" ? "Active" : status === "flagged" ? "Flagged" : status === "invalid" ? "Invalid" : "All statuses"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-32">
                    <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setStatus("")}>
                      All statuses {!status && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {["active", "flagged", "invalid"].map((s) => (
                      <DropdownMenuItem key={s} className="text-xs cursor-pointer capitalize" onClick={() => setStatus(s)}>
                        {s} {status === s && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* State */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">State</Label>
                <Input
                  placeholder="e.g. TX, CA…"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="h-7 w-24 text-xs"
                />
              </div>

              {/* Has data toggles — pill chips */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Has data</Label>
                <div className="flex items-center gap-1.5">
                  {([
                    { key: "email",   label: "Email",   val: hasEmail,   set: setHasEmail },
                    { key: "website", label: "Website", val: hasWebsite, set: setHasWebsite },
                    { key: "contact", label: "Contact", val: hasContact, set: setHasContact },
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

              {/* Clear filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground self-end"
                  onClick={clearFilters}>
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
          {confirmDelete && (
            <div className="px-4 py-2.5 border-b bg-destructive/5 flex items-center gap-3 shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive flex-1">
                {confirmDelete === "folder"
                  ? `Delete the folder "${folder.name}"? Leads inside will not be deleted.`
                  : confirmDelete === "all"
                  ? `Delete ALL ${total} leads in this folder? This cannot be undone.`
                  : `Delete ${selected.size} selected lead${selected.size !== 1 ? "s" : ""}? This cannot be undone.`}
              </p>
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5"
                onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setConfirmDelete(null)} disabled={deleting}>
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
                <Folder className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm">{debSearch ? "No leads match your search" : "No leads in this folder"}</p>
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
                    <TableHead className="sticky top-0 bg-background">Contact</TableHead>
                    <TableHead className="sticky top-0 bg-background w-36">Address</TableHead>
                    <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                    <TableHead className="sticky top-0 bg-background">Email</TableHead>
                    <TableHead className="sticky top-0 bg-background">Website</TableHead>
                    <TableHead className="sticky top-0 bg-background text-center w-20">Score</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground max-w-[120px]">
                        <CopyCell value={lead.contactPerson} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground w-36">
                        <CopyCell value={lead.address ?? ([lead.city, lead.state, lead.country].filter(Boolean).join(", ") || null)} />
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        <CopyCell value={lead.phone}>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />{lead.phone}
                          </span>
                        </CopyCell>
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px]">
                        <CopyCell value={lead.email}>
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="whitespace-nowrap">{lead.email}</span>
                          </span>
                        </CopyCell>
                      </TableCell>
                      <TableCell className="text-sm max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                        <CopyCell value={lead.website}>
                          <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-500 hover:underline whitespace-nowrap">
                            <Globe className="h-3 w-3 shrink-0" />{lead.website}
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

      {/* ── Change category dialog ── */}
      <Dialog
        open={showChangeCategory}
        onOpenChange={(v) => { if (!v) { setShowChangeCategory(false); setCategorySearch(""); } }}
      >
        <DialogContent showCloseButton className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle className="text-sm font-semibold">
              Change category —{" "}
              <span className="text-muted-foreground font-normal">{folder.name}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search categories…"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="pl-8 h-9 text-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto px-1 pb-2">
            {(!categorySearch || "uncategorized".includes(categorySearch.toLowerCase())) && (
              <button
                disabled={savingCategory || currentIndustryId == null}
                onClick={() => handleChangeCategory(null)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                <span className="flex-1 text-left text-muted-foreground">Uncategorized</span>
                {currentIndustryId == null && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            )}

            {filteredCategories.map((ind) => {
              const isCurrent = currentIndustryId === ind.id;
              return (
                <button
                  key={ind.id}
                  disabled={savingCategory || isCurrent}
                  onClick={() => handleChangeCategory(ind.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                  <span className="flex-1 text-left">{ind.name}</span>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                  {savingCategory && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </button>
              );
            })}

            {filteredCategories.length === 0 && categorySearch && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No categories match &ldquo;{categorySearch}&rdquo;
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
