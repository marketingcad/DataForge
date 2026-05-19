"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  bulkDeleteLeadsAction,
  deleteAllKeywordLeadsAction,
  moveLeadsToFolderAction,
} from "@/actions/leads.actions";
import { FolderPickerModal } from "@/components/shared/FolderPickerModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Search, Phone, Globe, Loader2,
  ChevronLeft, ChevronRight, Trash2, Download,
  AlertTriangle, Check, ChevronDown,
  Copy, MapPin, MoreHorizontal, ExternalLink, FolderOpen, SlidersHorizontal,
  RefreshCw, StopCircle, Pencil,
} from "lucide-react";
import { Dialog as EditDialog, DialogContent as EditDialogContent, DialogHeader as EditDialogHeader, DialogTitle as EditDialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { updateLeadInlineAction } from "@/actions/leads.actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
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
  country: string | null;
  dataQualityScore: number;
};

type SortOption = "name_asc" | "name_desc" | "newest" | "oldest";
type SearchField = "business" | "contact" | "location" | "phone" | "email" | "website";
type FilterValue = "has" | "no" | null;

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

type ColDef = { key: string; label: string; getValue: (l: Lead) => string };
const COLUMNS: ColDef[] = [
  { key: "businessName",     label: "Business Name", getValue: (l) => l.businessName },
  { key: "contactPerson",    label: "Contact",       getValue: (l) => l.contactPerson ?? "" },
  { key: "address",          label: "Address",       getValue: (l) => l.address ?? "" },
  { key: "phone",            label: "Phone",         getValue: (l) => l.phone },
  { key: "email",            label: "Email",         getValue: (l) => l.email ?? "" },
  { key: "website",          label: "Website",       getValue: (l) => l.website ?? "" },
  { key: "dataQualityScore", label: "Score",         getValue: (l) => String(l.dataQualityScore) },
];
type ColKey = "businessName" | "contactPerson" | "address" | "phone" | "email" | "website" | "dataQualityScore";
const DEFAULT_COLS = new Set<ColKey>(["businessName", "contactPerson", "address", "phone", "email", "website"]);

function exportToCSV(leads: Lead[], filename: string, cols: Set<ColKey>) {
  const active = COLUMNS.filter(c => cols.has(c.key as ColKey));
  const escape = (s: string) => `"${s.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
  const csv = [active.map(c => c.label), ...leads.map(l => active.map(c => c.getValue(l)))]
    .map(r => r.map(escape).join(",")).join("\n");
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
  const [filterEmail,   setFilterEmail]   = useState<FilterValue>(null);
  const [filterWebsite, setFilterWebsite] = useState<FilterValue>(null);
  const [filterAddress, setFilterAddress] = useState<FilterValue>(null);
  const [filterPhone,   setFilterPhone]   = useState<FilterValue>(null);
  const [filterScore,   setFilterScore]   = useState<FilterValue>(null);
  const [filterName,    setFilterName]    = useState<FilterValue>(null);
  const [scoreMin,  setScoreMin]  = useState("");
  const [scoreMax,  setScoreMax]  = useState("");
  const [scoreSlider, setScoreSlider] = useState<[number, number]>([0, 100]);
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState(20);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<"selected" | "all" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [exportCols, setExportCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS));
  const [colPickerOpen, setColPickerOpen] = useState(false);

  // Re-grab emails state
  const [regrabJobId, setRegrabJobId]       = useState<string | null>(null);
  const [regrabStatus, setRegrabStatus]     = useState<string | null>(null);
  const [regrabProgress, setRegrabProgress] = useState("");
  const [regrabStopping, setRegrabStopping] = useState(false);
  const [regrabStarting, setRegrabStarting] = useState(false);

  // Per-lead regrab state
  const [regrabbingIds, setRegrabbingIds] = useState<Set<string>>(new Set());

  // Bulk regrab state
  const [bulkRegrabbing, setBulkRegrabbing] = useState(false);
  const [bulkRegrabbingDone, setBulkRegrabbingDone] = useState(0);
  const [bulkRegrabbingTotal, setBulkRegrabbingTotal] = useState(0);

  // Edit lead state
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Folder picker state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderScope, setFolderScope] = useState<"selected" | "all">("selected");
  // IDs to move — captured when folder modal opens so we have a stable snapshot
  const [pendingMoveIds, setPendingMoveIds] = useState<string[]>([]);

  const { add: addNotif } = useNotifications();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [debSearch, searchField, sort, stateFilter, filterEmail, filterWebsite, filterAddress, filterPhone, filterScore, filterName, scoreMin, scoreMax, pageSize]);

  const fetchLeads = useCallback(async () => {
    if (!open || !kwId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: debSearch,
        searchField,
        sort,
        state: stateFilter,
        ...(filterEmail   ? { email:   filterEmail }   : {}),
        ...(filterWebsite ? { website: filterWebsite } : {}),
        ...(filterAddress ? { address: filterAddress } : {}),
        ...(filterPhone   ? { phone:   filterPhone }   : {}),
        ...(filterScore   ? { score:   filterScore }   : {}),
        ...(filterName    ? { name:    filterName }    : {}),
        ...(scoreMin !== "" ? { scoreMin } : {}),
        ...(scoreMax !== "" ? { scoreMax } : {}),
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
  }, [open, kwId, debSearch, searchField, sort, page, pageSize, stateFilter, filterEmail, filterWebsite, filterAddress, filterPhone, filterScore, filterName, scoreMin, scoreMax]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Poll regrab job progress
  useEffect(() => {
    if (!regrabJobId) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval>;

    async function pollOnce() {
      if (stopped) return;
      try {
        const res = await fetch(`/api/scraping/jobs/${regrabJobId}`);
        if (!res.ok) return;
        const job = await res.json() as { status: string; errorMessage?: string | null };
        if (stopped) return;
        setRegrabStatus(job.status);
        if (job.errorMessage) setRegrabProgress(job.errorMessage);
        if (job.status === "completed" || job.status === "paused") {
          stopped = true;
          clearInterval(timer);
          setRegrabStatus(job.status);
          setRegrabStopping(false);
          sessionStorage.removeItem(`regrab_kw_${kwId}`);
          fetchLeads();
          toast.success(job.errorMessage ?? "Re-grab complete.", { duration: 6000 });
        } else if (job.status === "failed") {
          stopped = true;
          clearInterval(timer);
          setRegrabStopping(false);
          sessionStorage.removeItem(`regrab_kw_${kwId}`);
          toast.error(job.errorMessage ?? "Re-grab failed.", { duration: 8000 });
        }
      } catch { /* ignore transient fetch errors */ }
    }

    pollOnce();
    timer = setInterval(pollOnce, 3000);

    return () => { stopped = true; clearInterval(timer); };
  }, [regrabJobId, fetchLeads]);

  // Restore in-progress regrab job when modal reopens
  useEffect(() => {
    if (open && !regrabJobId && kwId) {
      const saved = sessionStorage.getItem(`regrab_kw_${kwId}`);
      if (saved) {
        setRegrabJobId(saved);
        setRegrabStatus("running");
        setRegrabProgress("Resuming…");
      }
    }
  }, [open, kwId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      setSearch(""); setDebSearch(""); setSearchField("business"); setPage(1);
      setSelected(new Set()); setConfirmDelete(null); setConfirmDeleteId(null);
      setStateFilter(""); setPageSize(20);
      setFilterEmail(null); setFilterWebsite(null); setFilterAddress(null);
      setFilterPhone(null); setFilterScore(null); setFilterName(null);
      setScoreMin(""); setScoreMax(""); setScoreSlider([0, 100]);
      setFolderModalOpen(false);
      // regrab state intentionally NOT cleared — job persists across modal close/reopen
    }
  }, [open]);

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

  async function openFolderPicker(scope: "selected" | "all", singleId?: string) {
    setFolderScope(scope);
    if (scope === "all") {
      // Fetch all IDs upfront so FolderPickerModal doesn't need to know about pagination
      try {
        const res = await fetch(`/api/keywords/${kwId}/leads?page=1&pageSize=999999`);
        const data = await res.json();
        setPendingMoveIds((data.leads as Lead[]).map((l) => l.id));
      } catch {
        toast.error("Could not load leads. Try again.");
        return;
      }
    } else if (singleId) {
      setPendingMoveIds([singleId]);
    } else {
      setPendingMoveIds(Array.from(selected));
    }
    setFolderModalOpen(true);
  }

  async function handleMoveToFolder(folderId: string | null) {
    const count = pendingMoveIds.length;
    await moveLeadsToFolderAction(pendingMoveIds, folderId);
    const folderLabel = folderId ? "folder" : "Unfiled";
    addNotif({
      type: "success",
      title: `${count} lead${count !== 1 ? "s" : ""} saved to ${folderLabel}`,
      message: `From "${keyword} — ${location}".`,
    });
    setSelected(new Set());
    setPage(1);
    onLeadsDeleted?.(count);
    await fetchLeads();
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
      exportToCSV(toExport, `${keyword.replace(/\s+/g, "_")}_${location.replace(/\s+/g, "_")}_leads.csv`, exportCols);
      addNotif({ type: "success", title: `${toExport.length} lead${toExport.length !== 1 ? "s" : ""} exported`, message: `Saved as CSV for "${keyword} — ${location}".` });
    } catch {
      addNotif({ type: "error", title: "Export failed", message: "Something went wrong. Please try again." });
    } finally {
      setExporting(false);
    }
  }

  async function startRegrab() {
    setRegrabStarting(true);
    try {
      const res = await fetch(`/api/keywords/${kwId}/regrab-emails`, { method: "POST" });
      const data = await res.json() as { jobId?: string; alreadyRunning?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not start re-grab");
        return;
      }
      setRegrabJobId(data.jobId!);
      setRegrabStatus("pending");
      setRegrabProgress(data.alreadyRunning ? "Already running — monitoring…" : "Starting…");
      sessionStorage.setItem(`regrab_kw_${kwId}`, data.jobId!);
    } catch {
      toast.error("Failed to start re-grab");
    } finally {
      setRegrabStarting(false);
    }
  }

  async function stopRegrab() {
    if (!regrabJobId) return;
    setRegrabStopping(true);
    try {
      await fetch(`/api/scraping/jobs/${regrabJobId}/cancel`, { method: "POST" });
    } catch { /* ignore */ }
  }

  async function handleRegrabOne(lead: Lead) {
    if (!lead.website) return;
    setRegrabbingIds((prev) => new Set(prev).add(lead.id));
    try {
      const res = await fetch(`/api/leads/${lead.id}/regrab-email`, { method: "POST" });
      const data = await res.json() as { found?: boolean; email?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not re-grab email");
      } else if (data.found && data.email) {
        setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, email: data.email! } : l));
        toast.success(`Email found: ${data.email}`);
      } else {
        toast.info("No email found on this website");
      }
    } catch {
      toast.error("Failed to re-grab email");
    } finally {
      setRegrabbingIds((prev) => { const s = new Set(prev); s.delete(lead.id); return s; });
    }
  }

  function openEditLead(lead: Lead) {
    setEditLead(lead);
    setEditForm({
      businessName: lead.businessName,
      phone: lead.phone,
      email: lead.email ?? "",
      website: lead.website ?? "",
      contactPerson: lead.contactPerson ?? "",
      address: lead.address ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      country: lead.country ?? "",
    });
  }

  async function handleEditSave() {
    if (!editLead) return;
    setEditSaving(true);
    try {
      const result = await updateLeadInlineAction(editLead.id, {
        businessName: String(editForm.businessName ?? editLead.businessName),
        phone: String(editForm.phone ?? editLead.phone),
        email: String(editForm.email ?? ""),
        website: String(editForm.website ?? ""),
        contactPerson: String(editForm.contactPerson ?? ""),
        address: String(editForm.address ?? ""),
        city: String(editForm.city ?? ""),
        state: String(editForm.state ?? ""),
        country: String(editForm.country ?? ""),
      });
      if (result.error) { toast.error(result.error); return; }
      setLeads((prev) => prev.map((l) => l.id === editLead.id ? { ...l, ...editForm } : l));
      toast.success("Lead updated");
      setEditLead(null);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleBulkRegrab() {
    const eligible = leads.filter((l) => selected.has(l.id) && l.website);
    if (eligible.length === 0) {
      toast.info("No selected leads have a website to scrape");
      return;
    }
    setBulkRegrabbing(true);
    setBulkRegrabbingTotal(eligible.length);
    setBulkRegrabbingDone(0);
    let done = 0;
    for (const lead of eligible) {
      try {
        const res = await fetch(`/api/leads/${lead.id}/regrab-email`, { method: "POST" });
        const data = await res.json() as { found?: boolean; email?: string };
        if (data.found && data.email) {
          setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, email: data.email! } : l));
        }
      } catch { /* continue */ }
      done++;
      setBulkRegrabbingDone(done);
    }
    setBulkRegrabbing(false);
    toast.success(`Re-grab complete — processed ${eligible.length} lead${eligible.length !== 1 ? "s" : ""}`);
  }

  const folderPickerLabel = folderScope === "all"
    ? `Save all ${total} leads`
    : `Save ${pendingMoveIds.length} lead${pendingMoveIds.length !== 1 ? "s" : ""}`;

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
                onClick={() => openFolderPicker("all")} disabled={total === 0}>
                <FolderOpen className="h-3 w-3" />
                Save to folder
              </Button>
              <div className="flex items-center shrink-0">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs rounded-r-none border-r-0"
                  onClick={() => handleExport("all")} disabled={exporting || total === 0}>
                  {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  Export CSV
                </Button>
                <Popover open={colPickerOpen} onOpenChange={setColPickerOpen}>
                  <PopoverTrigger
                    disabled={total === 0}
                    className="h-8 px-1.5 rounded-l-none border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center shrink-0 disabled:opacity-50"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                  </PopoverTrigger>
                  <PopoverContent align="end" side="bottom" className="w-44 p-2">
                    <p className="text-[10px] font-medium text-muted-foreground px-1 pb-1.5">Columns to export</p>
                    {COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 px-1 py-1 cursor-pointer text-xs rounded hover:bg-accent">
                        <Checkbox
                          checked={exportCols.has(col.key as ColKey)}
                          onCheckedChange={(checked) => setExportCols(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(col.key as ColKey); else next.delete(col.key as ColKey);
                            return next;
                          })}
                        />
                        {col.label}
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete("all")} disabled={total === 0}>
                <Trash2 className="h-3 w-3" />
                Delete all
              </Button>

              <Separator orientation="vertical" className="h-4" />

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs shrink-0"
                disabled={total === 0 || regrabStarting || regrabStatus === "running" || regrabStatus === "pending"}
                onClick={startRegrab}
              >
                {regrabStarting
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />}
                Re-grab emails
              </Button>
            </div>

            {/* Filters row */}
            <div className="flex items-end gap-2.5">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">State</span>
                <Input
                  placeholder="e.g. TX, CA…"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="h-7 w-24 text-xs"
                />
              </div>

              {/* Has data dropdown */}
              {(() => {
                const active = [
                  filterEmail === "has" ? "Email" : null,
                  filterWebsite === "has" ? "Website" : null,
                  filterAddress === "has" ? "Address" : null,
                  filterPhone === "has" ? "Phone" : null,
                  filterScore === "has" ? "Score" : null,
                  filterName === "has" ? "Name" : null,
                ].filter(Boolean);
                return (
                  <Popover>
                    <PopoverTrigger
                      className={cn(
                        "inline-flex items-center gap-1.5 h-7 rounded-md border border-input bg-background px-2.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                        active.length > 0 && "border-primary text-primary bg-primary/5"
                      )}
                    >
                      Has data
                      {active.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{active.length}</span>}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent align="start" side="bottom" className="w-44 p-1.5">
                      {([
                        ["Email",   filterEmail,   setFilterEmail],
                        ["Website", filterWebsite, setFilterWebsite],
                        ["Address", filterAddress, setFilterAddress],
                        ["Phone",   filterPhone,   setFilterPhone],
                        ["Score",   filterScore,   setFilterScore],
                        ["Name",    filterName,    setFilterName],
                      ] as [string, FilterValue, (v: FilterValue) => void][]).map(([label, val, setter]) => (
                        <label key={label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent text-xs">
                          <Checkbox checked={val === "has"} onCheckedChange={(c) => setter(c ? "has" : null)} />
                          {label}
                        </label>
                      ))}
                    </PopoverContent>
                  </Popover>
                );
              })()}
              {/* Has no data dropdown */}
              {(() => {
                const active = [
                  filterEmail === "no" ? "Email" : null,
                  filterWebsite === "no" ? "Website" : null,
                  filterAddress === "no" ? "Address" : null,
                  filterPhone === "no" ? "Phone" : null,
                  filterScore === "no" ? "Score" : null,
                  filterName === "no" ? "Name" : null,
                ].filter(Boolean);
                return (
                  <Popover>
                    <PopoverTrigger
                      className={cn(
                        "inline-flex items-center gap-1.5 h-7 rounded-md border border-input bg-background px-2.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                        active.length > 0 && "border-primary text-primary bg-primary/5"
                      )}
                    >
                      Has no data
                      {active.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{active.length}</span>}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent align="start" side="bottom" className="w-44 p-1.5">
                      {([
                        ["Email",   filterEmail,   setFilterEmail],
                        ["Website", filterWebsite, setFilterWebsite],
                        ["Address", filterAddress, setFilterAddress],
                        ["Phone",   filterPhone,   setFilterPhone],
                        ["Score",   filterScore,   setFilterScore],
                        ["Name",    filterName,    setFilterName],
                      ] as [string, FilterValue, (v: FilterValue) => void][]).map(([label, val, setter]) => (
                        <label key={label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent text-xs">
                          <Checkbox checked={val === "no"} onCheckedChange={(c) => setter(c ? "no" : null)} />
                          {label}
                        </label>
                      ))}
                    </PopoverContent>
                  </Popover>
                );
              })()}

              {/* Score range */}
              <div className="space-y-1.5 w-40 ml-[5px] mb-[5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Score range</span>
                  <span className="text-[10px] font-medium tabular-nums">
                    {scoreSlider[0]} – {scoreSlider[1]}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  value={scoreSlider}
                  onValueChange={(val) => {
                    const arr = Array.isArray(val) ? val : [val as number];
                    setScoreSlider([arr[0] ?? 0, arr[1] ?? 100]);
                  }}
                  onValueCommitted={(val) => {
                    const arr = Array.isArray(val) ? val : [val as number];
                    const min = arr[0] ?? 0;
                    const max = arr[1] ?? 100;
                    setScoreMin(min > 0 ? String(min) : "");
                    setScoreMax(max < 100 ? String(max) : "");
                  }}
                />
              </div>

              {(stateFilter || filterEmail || filterWebsite || filterAddress || filterPhone || filterScore || filterName || scoreMin || scoreMax) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground self-end"
                  onClick={() => {
                    setStateFilter("");
                    setFilterEmail(null); setFilterWebsite(null); setFilterAddress(null);
                    setFilterPhone(null); setFilterScore(null); setFilterName(null);
                    setScoreMin(""); setScoreMax(""); setScoreSlider([0, 100]);
                  }}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* ── Re-grab progress bar ── */}
          {regrabJobId && regrabStatus !== "completed" && regrabStatus !== "failed" && (
            <div className="px-4 py-2 border-b bg-primary/5 flex items-center gap-3 shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              <p className="text-xs text-primary flex-1 tabular-nums">
                {regrabProgress || "Re-grabbing emails…"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive shrink-0"
                onClick={stopRegrab}
                disabled={regrabStopping}
              >
                {regrabStopping
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <StopCircle className="h-3 w-3" />}
                Stop
              </Button>
            </div>
          )}
          {regrabJobId && (regrabStatus === "completed" || regrabStatus === "paused" || regrabStatus === "failed") && (
            <div className="px-4 py-2 border-b bg-muted/40 flex items-center gap-3 shrink-0">
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <p className="text-xs text-muted-foreground flex-1 tabular-nums">
                {regrabProgress || "Re-grab complete."}
              </p>
              <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0"
                onClick={() => { sessionStorage.removeItem(`regrab_kw_${kwId}`); setRegrabJobId(null); setRegrabStatus(null); setRegrabProgress(""); }}>
                Dismiss
              </Button>
            </div>
          )}

          {/* ── Bulk action bar ── */}
          {someSelected && (
            <div className="px-4 py-2 border-b bg-primary/5 flex items-center gap-3 shrink-0">
              <span className="text-xs font-medium text-primary">{selected.size} selected</span>
              {bulkRegrabbing && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {bulkRegrabbingDone} / {bulkRegrabbingTotal} re-grabbed
                </span>
              )}
              <div className="flex gap-1.5 ml-auto">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                  onClick={handleBulkRegrab} disabled={bulkRegrabbing}>
                  {bulkRegrabbing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  Re-grab emails
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                  onClick={() => openFolderPicker("selected")}>
                  <FolderOpen className="h-3.5 w-3.5" />
                  Save to folder
                </Button>
                <div className="flex items-center">
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs rounded-r-none border-r-0"
                    onClick={() => handleExport("selected")} disabled={exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Export CSV
                  </Button>
                  <Popover open={colPickerOpen} onOpenChange={setColPickerOpen}>
                    <PopoverTrigger className="h-7 px-1.5 rounded-l-none border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center shrink-0">
                      <SlidersHorizontal className="h-3 w-3" />
                    </PopoverTrigger>
                    <PopoverContent align="end" side="top" className="w-44 p-2">
                      <p className="text-[10px] font-medium text-muted-foreground px-1 pb-1.5">Columns to export</p>
                      {COLUMNS.map(col => (
                        <label key={col.key} className="flex items-center gap-2 px-1 py-1 cursor-pointer text-xs rounded hover:bg-accent">
                          <Checkbox
                            checked={exportCols.has(col.key as ColKey)}
                            onCheckedChange={(checked) => setExportCols(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(col.key as ColKey); else next.delete(col.key as ColKey);
                              return next;
                            })}
                          />
                          {col.label}
                        </label>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
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
                <p className="text-sm">{debSearch || stateFilter || filterEmail || filterWebsite || filterAddress || filterPhone || filterScore || filterName || scoreMin || scoreMax ? "No leads match your filters" : "No leads scraped yet for this keyword"}</p>
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
                    <TableHead className="sticky top-0 bg-background">Email</TableHead>
                    <TableHead className="sticky top-0 bg-background">Website</TableHead>
                    <TableHead className="sticky top-0 bg-background text-center w-20">Score</TableHead>
                    <TableHead className="sticky top-0 bg-background w-24 text-center">Actions</TableHead>
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
                        {(page - 1) * pageSize + idx + 1}
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
                      <TableCell className="text-sm max-w-[160px]" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const cleanEmail = lead.email?.replace(/^mailto:/i, "").trim() || null;
                          return (
                            <CopyCell value={cleanEmail}>
                              <a
                                href={`mailto:${cleanEmail}`}
                                className="inline-flex items-center gap-1 text-blue-500 hover:underline whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                ✉ {cleanEmail}
                              </a>
                            </CopyCell>
                          );
                        })()}
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
                        {/* Desktop: icon buttons only */}
                        <div className="hidden sm:flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title={lead.website ? "Re-grab email from website" : "No website available"}
                            disabled={!lead.website || regrabbingIds.has(lead.id)}
                            onClick={() => handleRegrabOne(lead)}
                          >
                            {regrabbingIds.has(lead.id)
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RefreshCw className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Edit lead"
                            onClick={() => openEditLead(lead)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Mobile: 3-dot with all actions */}
                        <div className="flex sm:hidden items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                className="text-xs gap-2 cursor-pointer"
                                disabled={!lead.website || regrabbingIds.has(lead.id)}
                                onClick={() => handleRegrabOne(lead)}
                              >
                                {regrabbingIds.has(lead.id)
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <RefreshCw className="h-3.5 w-3.5" />}
                                Re-grab email
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs gap-2 cursor-pointer"
                                onClick={() => openEditLead(lead)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit lead
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-xs gap-2 cursor-pointer"
                                onClick={() => window.open(`/leads/${lead.id}`, "_blank")}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                View lead
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs gap-2 cursor-pointer"
                                onClick={() => openFolderPicker("selected", lead.id)}
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t shrink-0 bg-background">
            <p className="text-xs text-muted-foreground tabular-nums">
              {total === 0 ? "0 leads" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<button type="button" className="inline-flex items-center gap-1 h-7 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent transition-colors" />}
                >
                  {pageSize}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-20">
                  {[10, 20, 50, 100].map((n) => (
                    <DropdownMenuItem key={n} className="text-xs cursor-pointer justify-between"
                      onClick={() => setPageSize(n)}>
                      {n}
                      {pageSize === n && <Check className="h-3 w-3" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs px-2 tabular-nums">{page} / {Math.max(1, totalPages)}</span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={page === totalPages || totalPages <= 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit lead dialog ── */}
      <EditDialog open={!!editLead} onOpenChange={(v) => { if (!v) setEditLead(null); }}>
        <EditDialogContent showCloseButton className="max-w-md p-0 overflow-hidden">
          <EditDialogHeader className="px-4 pt-4 pb-3 border-b">
            <EditDialogTitle className="text-sm font-semibold">Edit Lead</EditDialogTitle>
          </EditDialogHeader>
          <div className="px-4 py-3 space-y-3 max-h-[70vh] overflow-y-auto">
            {([
              ["businessName", "Business Name"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["website", "Website"],
              ["contactPerson", "Contact Person"],
              ["address", "Address"],
              ["city", "City"],
              ["state", "State"],
              ["country", "Country"],
            ] as [keyof Lead, string][]).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  className="h-8 text-sm"
                  value={String(editForm[field] ?? "")}
                  onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setEditLead(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleEditSave} disabled={editSaving}>
              {editSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Save
            </Button>
          </div>
        </EditDialogContent>
      </EditDialog>

      {/* ── Folder picker (shared component) ── */}
      <FolderPickerModal
        open={folderModalOpen}
        onOpenChange={setFolderModalOpen}
        title={folderPickerLabel}
        confirmLabel={`${folderPickerLabel} →`}
        onConfirm={handleMoveToFolder}
      />
    </>
  );
}
