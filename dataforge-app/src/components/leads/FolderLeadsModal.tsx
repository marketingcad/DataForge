"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getLeadsForFolderAction,
  getAllLeadsForExportAction,
  bulkDeleteLeadsAction,
  markLeadsExportedAction,
} from "@/actions/leads.actions";
import { deleteFolderAction, updateFolderCategoryAction, updateFolderSubcategoryAction, renameFolderAction } from "@/actions/folders.actions";
import { getSubcategoriesByIndustryAction } from "@/actions/industry.actions";
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
  Folder, Search, Phone, Globe, Mail, Loader2,
  ChevronLeft, ChevronRight, Trash2, Download,
  MoreVertical, MoreHorizontal, Tags, AlertTriangle, Check, ChevronDown,
  Copy, SlidersHorizontal, RefreshCw, StopCircle, Pencil,
} from "lucide-react";
import { Dialog as EditDialog, DialogContent as EditDialogContent, DialogHeader as EditDialogHeader, DialogTitle as EditDialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateLeadInlineAction } from "@/actions/leads.actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/notifications";
import { formatPhone } from "@/lib/utils/normalize";
import { useMigration } from "@/contexts/MigrationContext";

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
  migratedToGhl: boolean;
  exportedAt: string | Date | null;
};

type SortOption = "name_asc" | "name_desc" | "newest" | "oldest";
type SearchField = "business" | "contact" | "location" | "phone" | "email" | "website" | "score";
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
  { value: "location",  label: "Location",  placeholder: "Search by city, state, or address…" },
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
  filterUserId?: string;
  onFolderDeleted?: (id: string) => void;
  onCategoryChanged?: (id: string) => void;
}

function CopyCell({ value, className, children, wrap }: { value: string | null | undefined; className?: string; children?: React.ReactNode; wrap?: boolean }) {
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
    <div className={cn("group/copy flex items-start gap-1 min-w-0 max-w-full", className)}>
      <div
        className={cn("relative flex-1 min-w-0", !wrap && "overflow-hidden")}
        style={wrap ? undefined : {
          maskImage: "linear-gradient(to right, black 82%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black 82%, transparent 100%)",
        }}
      >
        {children ?? <span className={cn("text-sm", wrap ? "whitespace-normal break-words" : "whitespace-nowrap")}>{value}</span>}
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

export function FolderLeadsModal({
  folder, open, onOpenChange,
  allIndustries = [], currentIndustryId,
  filterUserId,
  onFolderDeleted, onCategoryChanged,
}: Props) {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [search, setSearch]         = useState("");
  const [debSearch, setDebSearch]   = useState("");
  const [searchField, setSearchField] = useState<SearchField>("business");
  const [sort, setSort]             = useState<SortOption>("newest");
  const [minScore, setMinScore]     = useState<string>("");
  const [maxScore, setMaxScore]     = useState<string>("");
  const [scoreSlider, setScoreSlider] = useState<[number, number]>([0, 100]);
  const [status, setStatus]         = useState<string>("");
  const [stateFilter, setStateFilter] = useState<string>("");
  const [exportStatus, setExportStatus] = useState<"" | "exported" | "not_exported">("");
  const [exportedFrom, setExportedFrom] = useState<string>("");
  const [exportedTo, setExportedTo]     = useState<string>("");
  const [filterEmail,    setFilterEmail]    = useState<FilterValue>(null);
  const [filterWebsite,  setFilterWebsite]  = useState<FilterValue>(null);
  const [filterContact,  setFilterContact]  = useState<FilterValue>(null);
  const [filterPhone,    setFilterPhone]    = useState<FilterValue>(null);
  const [filterBusiness, setFilterBusiness] = useState<FilterValue>(null);
  const [filterScore,    setFilterScore]    = useState<FilterValue>(null);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(20);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<"selected" | "all" | "folder" | null>(null);
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
  const [bulkRegrabbing, setBulkRegrabbing]         = useState(false);
  const [bulkRegrabbingDone, setBulkRegrabbingDone] = useState(0);
  const [bulkRegrabbingTotal, setBulkRegrabbingTotal] = useState(0);
  const [bulkRegrabbingFound, setBulkRegrabbingFound] = useState(0);
  const [bulkRegrabbingNone, setBulkRegrabbingNone]   = useState(0);
  const [bulkRegrabbingDoneState, setBulkRegrabbingDoneState] = useState(false);
  const bulkRegrabbingStop = React.useRef(false);

  // Edit lead state
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Change category
  const { add: addNotif } = useNotifications();
  const { start: startMigration, state: migrationState } = useMigration();

  const [showChangeCategory, setShowChangeCategory] = useState(false);
  const [categorySearch, setCategorySearch]         = useState("");
  const [savingCategory, setSavingCategory]         = useState(false);

  // Rename folder
  const [folderName, setFolderName]         = useState(folder.name);
  const [showRenameFolder, setShowRenameFolder] = useState(false);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [savingRename, setSavingRename]     = useState(false);

  // Two-step category → subcategory flow
  const [changeCatStep, setChangeCatStep]             = useState<"category" | "subcategory">("category");
  const [pendingIndustryId, setPendingIndustryId]     = useState<string | null>(null);
  const [subsForChange, setSubsForChange]             = useState<{ id: string; name: string; color: string }[]>([]);
  const [loadingSubs, setLoadingSubs]                 = useState(false);
  const [subSearch, setSubSearch]                     = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [debSearch, searchField, sort, minScore, maxScore, status, stateFilter, filterEmail, filterWebsite, filterContact, filterPhone, filterBusiness, filterScore, pageSize]);

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
        pageSize,
        minScore: minScore !== "" ? Number(minScore) : undefined,
        maxScore: maxScore !== "" ? Number(maxScore) : undefined,
        status,
        state: stateFilter,
        hasEmail:    filterEmail    === "has" || undefined,
        hasWebsite:  filterWebsite  === "has" || undefined,
        hasContact:  filterContact  === "has" || undefined,
        hasPhone:    filterPhone    === "has" || undefined,
        hasBusiness: filterBusiness === "has" || undefined,
        hasScore:    filterScore    === "has" || undefined,
        noEmail:     filterEmail    === "no"  || undefined,
        noWebsite:   filterWebsite  === "no"  || undefined,
        noContact:   filterContact  === "no"  || undefined,
        noPhone:     filterPhone    === "no"  || undefined,
        noBusiness:  filterBusiness === "no"  || undefined,
        noScore:     filterScore    === "no"  || undefined,
        savedById: filterUserId,
        exportStatus: exportStatus || undefined,
        exportedFrom: exportedFrom || undefined,
        exportedTo:   exportedTo   || undefined,
      });
      setLeads(r.leads as Lead[]);
      setTotal(r.total);
      setTotalPages(r.totalPages);
    } finally {
      setLoading(false);
    }
  }, [open, folder.id, debSearch, searchField, sort, page, pageSize, minScore, maxScore, status, stateFilter, filterEmail, filterWebsite, filterContact, filterPhone, filterBusiness, filterScore, filterUserId, exportStatus, exportedFrom, exportedTo]);

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
          sessionStorage.removeItem(`regrab_folder_${folder.id}`);
          fetchLeads();
          addNotif({
            type: "success",
            title: "Re-grab complete",
            message: job.errorMessage ?? "Email re-grab finished.",
          });
        } else if (job.status === "failed") {
          stopped = true;
          clearInterval(timer);
          setRegrabStopping(false);
          sessionStorage.removeItem(`regrab_folder_${folder.id}`);
          addNotif({ type: "error", title: "Re-grab failed", message: job.errorMessage ?? "Something went wrong during the email re-grab." });
        }
      } catch { /* ignore transient errors */ }
    }

    pollOnce();
    timer = setInterval(pollOnce, 3000);

    return () => { stopped = true; clearInterval(timer); };
  }, [regrabJobId, fetchLeads, addNotif]);

  useEffect(() => {
    if (!open) {
      setSearch(""); setDebSearch(""); setSearchField("business"); setPage(1);
      setSelected(new Set()); setConfirmDelete(null);
      setMinScore(""); setMaxScore(""); setScoreSlider([0, 100]);
      setStatus(""); setStateFilter(""); setPageSize(20);
      setExportStatus(""); setExportedFrom(""); setExportedTo("");
      setFilterEmail(null); setFilterWebsite(null); setFilterContact(null);
      setFilterPhone(null); setFilterBusiness(null); setFilterScore(null);
      // regrab state intentionally NOT cleared — job persists across modal close/reopen
    }
  }, [open]);

  // Restore in-progress regrab job when modal reopens
  useEffect(() => {
    if (open && !regrabJobId && folder.id) {
      const saved = sessionStorage.getItem(`regrab_folder_${folder.id}`);
      if (saved) {
        setRegrabJobId(saved);
        setRegrabStatus("running");
        setRegrabProgress("Resuming…");
      }
    }
  }, [open, folder.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilters = minScore || maxScore || status || stateFilter || filterEmail || filterWebsite || filterContact || filterPhone || filterBusiness || filterScore || exportStatus || exportedFrom || exportedTo;

  function clearFilters() {
    setMinScore(""); setMaxScore(""); setScoreSlider([0, 100]);
    setStatus(""); setStateFilter("");
    setFilterEmail(null); setFilterWebsite(null); setFilterContact(null);
    setFilterPhone(null); setFilterBusiness(null); setFilterScore(null);
    setExportStatus(""); setExportedFrom(""); setExportedTo("");
  }

  const activeFilterParams = {
    folderId: folder.id,
    search: debSearch,
    searchField,
    sort,
    minScore: minScore !== "" ? Number(minScore) : undefined,
    maxScore: maxScore !== "" ? Number(maxScore) : undefined,
    status,
    state: stateFilter,
    hasEmail:    filterEmail    === "has" || undefined,
    hasWebsite:  filterWebsite  === "has" || undefined,
    hasContact:  filterContact  === "has" || undefined,
    hasPhone:    filterPhone    === "has" || undefined,
    hasBusiness: filterBusiness === "has" || undefined,
    hasScore:    filterScore    === "has" || undefined,
    noEmail:     filterEmail    === "no"  || undefined,
    noWebsite:   filterWebsite  === "no"  || undefined,
    noContact:   filterContact  === "no"  || undefined,
    noPhone:     filterPhone    === "no"  || undefined,
    noBusiness:  filterBusiness === "no"  || undefined,
    noScore:     filterScore    === "no"  || undefined,
    savedById: filterUserId,
    exportStatus: exportStatus || undefined,
    exportedFrom: exportedFrom || undefined,
    exportedTo:   exportedTo   || undefined,
  };

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
        const all = await getAllLeadsForExportAction({ folderId: folder.id });
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

  async function handleRenameFolder() {
    if (!renameFolderValue.trim()) return;
    setSavingRename(true);
    try {
      await renameFolderAction(folder.id, renameFolderValue.trim());
      setFolderName(renameFolderValue.trim());
      toast.success(`Folder renamed to "${renameFolderValue.trim()}"`);
      setShowRenameFolder(false);
    } catch {
      toast.error("Failed to rename folder");
    } finally {
      setSavingRename(false);
    }
  }

  async function handleExport(scope: "selected" | "all" | "unexported") {
    setExporting(true);
    try {
      let toExport: Lead[];
      if (scope === "selected") {
        toExport = leads.filter((l) => selected.has(l.id));
      } else if (scope === "unexported") {
        // Force the not-exported filter regardless of the current export-status filter.
        toExport = (await getAllLeadsForExportAction({ ...activeFilterParams, exportStatus: "not_exported" })).leads as Lead[];
      } else {
        toExport = (await getAllLeadsForExportAction(activeFilterParams)).leads as Lead[];
      }

      if (toExport.length === 0) {
        addNotif({
          type: "warning",
          title: "Nothing to export",
          message: scope === "unexported"
            ? "All matching leads have already been exported."
            : "No leads match the current filters.",
        });
        return;
      }

      exportToCSV(toExport, `${folder.name.replace(/\s+/g, "_")}_leads.csv`, exportCols);

      // Mark the exported leads with the current export date, then refresh so the date shows.
      try {
        await markLeadsExportedAction(toExport.map((l) => l.id));
        await fetchLeads();
      } catch (err) {
        console.error("[export] failed to mark leads exported", err);
        addNotif({ type: "warning", title: "Exported, but not marked", message: "The CSV downloaded, but marking the leads as exported failed. Please try again." });
        return;
      }

      addNotif({ type: "success", title: `${toExport.length} lead${toExport.length !== 1 ? "s" : ""} exported`, message: `Saved as CSV from "${folder.name}" and marked as exported.` });
    } catch (err) {
      console.error("[export] failed", err);
      addNotif({ type: "error", title: "Export failed", message: "Something went wrong. Please try again." });
    } finally {
      setExporting(false);
    }
  }

  async function startRegrab() {
    setRegrabStarting(true);
    try {
      const res = await fetch(`/api/leads/folders/${folder.id}/regrab-emails`, { method: "POST" });
      const data = await res.json() as { jobId?: string; alreadyRunning?: boolean; error?: string };
      if (!res.ok) {
        addNotif({ type: "warning", title: "Re-grab not started", message: data.error ?? "No eligible leads found." });
        return;
      }
      setRegrabJobId(data.jobId!);
      setRegrabStatus("pending");
      setRegrabProgress(data.alreadyRunning ? "Already running — monitoring…" : "Starting…");
      sessionStorage.setItem(`regrab_folder_${folder.id}`, data.jobId!);
    } catch {
      addNotif({ type: "error", title: "Re-grab failed", message: "Something went wrong. Please try again." });
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
      const data = await res.json() as { found?: boolean; email?: string; dataQualityScore?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not re-grab email");
      } else if (data.found && data.email) {
        setLeads((prev) => prev.map((l) => l.id === lead.id
          ? { ...l, email: data.email!, ...(data.dataQualityScore !== undefined ? { dataQualityScore: data.dataQualityScore } : {}) }
          : l));
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
    bulkRegrabbingStop.current = false;
    setBulkRegrabbing(true);
    setBulkRegrabbingDoneState(false);
    setBulkRegrabbingTotal(eligible.length);
    setBulkRegrabbingDone(0);
    setBulkRegrabbingFound(0);
    setBulkRegrabbingNone(0);
    let done = 0, found = 0, none = 0;
    for (const lead of eligible) {
      if (bulkRegrabbingStop.current) break;
      try {
        const res = await fetch(`/api/leads/${lead.id}/regrab-email`, { method: "POST" });
        const data = await res.json() as { found?: boolean; email?: string; dataQualityScore?: number };
        if (data.found && data.email) {
          found++;
          setLeads((prev) => prev.map((l) => l.id === lead.id
            ? { ...l, email: data.email!, ...(data.dataQualityScore !== undefined ? { dataQualityScore: data.dataQualityScore } : {}) }
            : l));
        } else {
          none++;
        }
      } catch { none++; }
      done++;
      setBulkRegrabbingDone(done);
      setBulkRegrabbingFound(found);
      setBulkRegrabbingNone(none);
    }
    setBulkRegrabbing(false);
    setBulkRegrabbingDoneState(true);
  }

  async function handleMigrateToGhl(scope: "selected" | "all") {
    if (migrationState.running) {
      addNotif({ type: "warning", title: "Migration already running", message: "Wait for the current migration to finish or stop it first." });
      return;
    }

    const allLeads: Lead[] = scope === "selected"
      ? leads.filter((l) => selected.has(l.id))
      : (await getAllLeadsForExportAction(activeFilterParams)).leads as Lead[];

    const toMigrate = allLeads
      .filter((l) => !l.migratedToGhl)
      .map((l) => ({ id: l.id, name: l.businessName }));

    const skipped = allLeads.length - toMigrate.length;

    if (toMigrate.length === 0) {
      addNotif({
        type: "info",
        title: "Nothing to migrate",
        message: skipped > 0
          ? `All ${skipped} selected lead${skipped !== 1 ? "s are" : " is"} already exported to GHL.`
          : "No leads selected.",
      });
      return;
    }

    if (skipped > 0) {
      addNotif({
        type: "info",
        title: `Skipping ${skipped} already-exported lead${skipped !== 1 ? "s" : ""}`,
        message: `Migrating the remaining ${toMigrate.length} lead${toMigrate.length !== 1 ? "s" : ""}.`,
      });
    }

    startMigration(toMigrate, folder.name);
  }

  function closeCategoryDialog() {
    setShowChangeCategory(false);
    setCategorySearch("");
    setSubSearch("");
    setChangeCatStep("category");
    setPendingIndustryId(null);
    setSubsForChange([]);
  }

  async function handlePickCategory(industryId: string | null) {
    if (industryId === null) {
      // Uncategorized — save immediately, clear subcategory too
      setSavingCategory(true);
      try {
        await updateFolderCategoryAction(folder.id, null);
        await updateFolderSubcategoryAction(folder.id, null);
        addNotif({ type: "info", title: "Category changed", message: `"${folder.name}" moved to Uncategorized.` });
        closeCategoryDialog();
        onOpenChange(false);
        onCategoryChanged?.(folder.id);
      } catch {
        addNotif({ type: "error", title: "Category change failed", message: "Something went wrong." });
      } finally {
        setSavingCategory(false);
      }
      return;
    }
    // Load subcategories then advance to step 2
    setPendingIndustryId(industryId);
    setSubSearch("");
    setLoadingSubs(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subs = await getSubcategoriesByIndustryAction(industryId) as any[];
      setSubsForChange(subs.map((s) => ({ id: s.id, name: s.name, color: s.color })));
    } catch {
      setSubsForChange([]);
    } finally {
      setLoadingSubs(false);
    }
    setChangeCatStep("subcategory");
  }

  async function handlePickSubcategory(subcategoryId: string | null) {
    if (!pendingIndustryId) return;
    setSavingCategory(true);
    try {
      await updateFolderCategoryAction(folder.id, pendingIndustryId);
      await updateFolderSubcategoryAction(folder.id, subcategoryId);
      const catName = allIndustries.find((i) => i.id === pendingIndustryId)?.name ?? "category";
      const subName = subsForChange.find((s) => s.id === subcategoryId)?.name;
      const dest = subName ? `${catName} › ${subName}` : catName;
      addNotif({ type: "info", title: "Category changed", message: `"${folder.name}" moved to ${dest}.` });
      closeCategoryDialog();
      onOpenChange(false);
      onCategoryChanged?.(folder.id);
    } catch {
      addNotif({ type: "error", title: "Category change failed", message: "Something went wrong." });
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleOpenChangeSubcategory() {
    if (!currentIndustryId) return;
    setPendingIndustryId(currentIndustryId);
    setSubSearch("");
    setChangeCatStep("subcategory");
    setLoadingSubs(true);
    setShowChangeCategory(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subs = await getSubcategoriesByIndustryAction(currentIndustryId) as any[];
      setSubsForChange(subs.map((s) => ({ id: s.id, name: s.name, color: s.color })));
    } catch {
      setSubsForChange([]);
    } finally {
      setLoadingSubs(false);
    }
  }

  const filteredCategories = categorySearch.trim()
    ? allIndustries.filter((i) => i.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : allIndustries;

  const filteredSubs = subSearch.trim()
    ? subsForChange.filter((s) => s.name.toLowerCase().includes(subSearch.toLowerCase()))
    : subsForChange;

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
                  <span className="font-medium text-foreground truncate">{folderName}</span>
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
                  <span className="truncate">{folderName}</span>
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
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-xs"
                    onClick={() => { setRenameFolderValue(folderName); setShowRenameFolder(true); }}
                  >
                    <Pencil className="h-3 w-3" />
                    Rename folder
                  </DropdownMenuItem>
                  {allIndustries.length > 0 && (
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-xs"
                      onClick={() => { setCategorySearch(""); setChangeCatStep("category"); setShowChangeCategory(true); }}
                    >
                      <Tags className="h-3 w-3" />
                      Change category
                    </DropdownMenuItem>
                  )}
                  {currentIndustryId && (
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-xs"
                      onClick={handleOpenChangeSubcategory}
                    >
                      <Tags className="h-3 w-3" />
                      Change subcategory
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
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

              <div className="flex items-center shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" className="h-8 gap-1 text-xs rounded-r-none border-r-0" disabled={exporting || total === 0} />}
                  >
                    {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Export CSV
                    <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="text-xs cursor-pointer gap-2" onClick={() => handleExport("all")} disabled={exporting}>
                      <Download className="h-3.5 w-3.5" /> Export all (filtered)
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs cursor-pointer gap-2" onClick={() => handleExport("unexported")} disabled={exporting}>
                      <Download className="h-3.5 w-3.5" /> Export unexported only
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0" disabled={migrationState.running || total === 0} />}
                >
                  🔗 GHL
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem className="text-xs cursor-pointer gap-2" onClick={() => handleMigrateToGhl("all")} disabled={migrationState.running}>
                    🔗 Migrate all to GHL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

            {/* Row 2 — filters */}
            <div className="flex flex-wrap items-end gap-2.5">

              {/* State */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">State</span>
                <Input
                  placeholder="e.g. TX, CA…"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="h-7 w-24 text-xs"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">Status</span>
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

              {/* Exported status */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">Exported</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" className="h-7 gap-1 text-xs w-32 justify-between" />}
                  >
                    <span className={exportStatus ? "" : "text-muted-foreground"}>
                      {exportStatus === "exported" ? "Exported" : exportStatus === "not_exported" ? "Not exported" : "All"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36">
                    <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setExportStatus("")}>
                      All {!exportStatus && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setExportStatus("exported")}>
                      Exported {exportStatus === "exported" && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setExportStatus("not_exported")}>
                      Not exported {exportStatus === "not_exported" && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Export date range */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">Exported from</span>
                <Input
                  type="date"
                  value={exportedFrom}
                  max={exportedTo || undefined}
                  onChange={(e) => setExportedFrom(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground block">Exported to</span>
                <Input
                  type="date"
                  value={exportedTo}
                  min={exportedFrom || undefined}
                  onChange={(e) => setExportedTo(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
              </div>

              {/* Has data dropdown */}
              {(() => {
                const active = [
                  filterEmail    === "has" ? "Email"    : null,
                  filterWebsite  === "has" ? "Website"  : null,
                  filterContact  === "has" ? "Contact"  : null,
                  filterPhone    === "has" ? "Phone"    : null,
                  filterBusiness === "has" ? "Business" : null,
                  filterScore    === "has" ? "Score"    : null,
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
                        ["Email",    filterEmail,    setFilterEmail],
                        ["Website",  filterWebsite,  setFilterWebsite],
                        ["Contact",  filterContact,  setFilterContact],
                        ["Phone",    filterPhone,    setFilterPhone],
                        ["Business", filterBusiness, setFilterBusiness],
                        ["Score",    filterScore,    setFilterScore],
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
                  filterEmail    === "no" ? "Email"    : null,
                  filterWebsite  === "no" ? "Website"  : null,
                  filterContact  === "no" ? "Contact"  : null,
                  filterPhone    === "no" ? "Phone"    : null,
                  filterBusiness === "no" ? "Business" : null,
                  filterScore    === "no" ? "Score"    : null,
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
                        ["Email",    filterEmail,    setFilterEmail],
                        ["Website",  filterWebsite,  setFilterWebsite],
                        ["Contact",  filterContact,  setFilterContact],
                        ["Phone",    filterPhone,    setFilterPhone],
                        ["Business", filterBusiness, setFilterBusiness],
                        ["Score",    filterScore,    setFilterScore],
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

              {/* Score range slider */}
              <div className="space-y-1.5 w-40">
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
                    setMinScore(min > 0 ? String(min) : "");
                    setMaxScore(max < 100 ? String(max) : "");
                  }}
                />
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
                onClick={() => { sessionStorage.removeItem(`regrab_folder_${folder.id}`); setRegrabJobId(null); setRegrabStatus(null); setRegrabProgress(""); }}>
                Dismiss
              </Button>
            </div>
          )}

          {/* ── Bulk re-grab progress banner ── */}
          {(bulkRegrabbing || bulkRegrabbingDoneState) && (
            <div className={`px-4 py-2 border-b flex items-center gap-3 shrink-0 ${bulkRegrabbing ? "bg-primary/5" : "bg-muted/40"}`}>
              {bulkRegrabbing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                : <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              <p className="text-xs flex-1 tabular-nums text-primary">
                {bulkRegrabbing
                  ? <>Re-grabbing… <span className="font-medium">{bulkRegrabbingDone} / {bulkRegrabbingTotal}</span> processed · <span className="text-emerald-600 font-medium">{bulkRegrabbingFound} found</span> · <span className="text-muted-foreground">{bulkRegrabbingNone} no email</span></>
                  : <span className="text-muted-foreground">Re-grab complete — <span className="text-emerald-600 font-medium">{bulkRegrabbingFound} email{bulkRegrabbingFound !== 1 ? "s" : ""} found</span> · {bulkRegrabbingNone} no email · {bulkRegrabbingTotal - bulkRegrabbingDone > 0 ? `${bulkRegrabbingTotal - bulkRegrabbingDone} stopped` : `${bulkRegrabbingTotal} processed`}</span>}
              </p>
              {bulkRegrabbing && (
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive shrink-0"
                  onClick={() => { bulkRegrabbingStop.current = true; }}>
                  <StopCircle className="h-3 w-3" />
                  Stop
                </Button>
              )}
              {!bulkRegrabbing && (
                <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0"
                  onClick={() => setBulkRegrabbingDoneState(false)}>
                  Dismiss
                </Button>
              )}
            </div>
          )}

          {/* ── Bulk action bar ── */}
          {someSelected && (
            <div className="px-4 py-2 border-b bg-primary/5 flex items-center gap-3 shrink-0">
              <span className="text-xs font-medium text-primary">{selected.size} selected</span>
              <div className="flex gap-1.5 ml-auto">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                  onClick={handleBulkRegrab} disabled={bulkRegrabbing}>
                  {bulkRegrabbing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  Re-grab emails
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
                <Button
                  size="sm" variant="outline"
                  className="h-7 gap-1.5 text-xs text-violet-600 hover:text-violet-700 border-violet-300"
                  onClick={() => handleMigrateToGhl("selected")}
                  disabled={migrationState.running}
                >
                  🔗 Migrate to GHL
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
                    <TableHead className="sticky top-0 bg-background w-72">Address</TableHead>
                    <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                    <TableHead className="sticky top-0 bg-background">Email</TableHead>
                    <TableHead className="sticky top-0 bg-background">Website</TableHead>
                    <TableHead className="sticky top-0 bg-background text-center w-20">Score</TableHead>
                    <TableHead className="sticky top-0 bg-background text-center w-24">Exported</TableHead>
                    <TableHead className="sticky top-0 bg-background w-20 text-center">Actions</TableHead>
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
                      <TableCell className="font-medium max-w-[150px] align-top">
                        <div className="flex items-start justify-between gap-1.5 min-w-0">
                          <CopyCell value={lead.businessName} wrap />
                          {lead.migratedToGhl && (
                            <span
                              className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-200/50 dark:border-violet-800/50 whitespace-nowrap"
                              title="Migrated to GoHighLevel"
                            >
                              GHL ✓
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px]">
                        <CopyCell value={lead.contactPerson} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground w-72 max-w-[300px] align-top">
                        <CopyCell value={lead.address ?? ([lead.city, lead.state, lead.country].filter(Boolean).join(", ") || null)} wrap />
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        <CopyCell value={lead.phone}>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />{formatPhone(lead.phone)}
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
                      <TableCell className="text-center whitespace-nowrap">
                        {lead.exportedAt ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"
                            title={`Exported ${new Date(lead.exportedAt).toLocaleString()}`}
                          >
                            <Check className="h-3 w-3 shrink-0" />
                            {new Date(lead.exportedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

      {/* ── Rename folder dialog ── */}
      <Dialog open={showRenameFolder} onOpenChange={(v) => { if (!v) setShowRenameFolder(false); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              placeholder="Folder name"
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(); }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRenameFolder(false)}>Cancel</Button>
            <Button onClick={handleRenameFolder} disabled={savingRename || !renameFolderValue.trim()}>
              {savingRename ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change category / subcategory dialog ── */}
      <Dialog open={showChangeCategory} onOpenChange={(v) => { if (!v) closeCategoryDialog(); }}>
        <DialogContent showCloseButton className="max-w-sm p-0 overflow-hidden">

          {/* Step 1: Pick category */}
          {changeCatStep === "category" && (
            <>
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
                    disabled={savingCategory}
                    onClick={() => handlePickCategory(null)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="flex-1 text-left text-muted-foreground">Uncategorized</span>
                    {currentIndustryId == null && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                    {savingCategory && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </button>
                )}
                {filteredCategories.map((ind) => (
                  <button
                    key={ind.id}
                    disabled={savingCategory}
                    onClick={() => handlePickCategory(ind.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                    <span className="flex-1 text-left">{ind.name}</span>
                    {currentIndustryId === ind.id && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </button>
                ))}
                {filteredCategories.length === 0 && categorySearch && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No categories match &ldquo;{categorySearch}&rdquo;
                  </p>
                )}
              </div>
            </>
          )}

          {/* Step 2: Pick subcategory */}
          {changeCatStep === "subcategory" && (
            <>
              <DialogHeader className="px-4 pt-4 pb-3 border-b">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setChangeCatStep("category"); setPendingIndustryId(null); setSubSearch(""); }}
                    className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-sm font-semibold">
                      Pick subcategory
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {allIndustries.find((i) => i.id === pendingIndustryId)?.name} › {folder.name}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {loadingSubs ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {subsForChange.length > 0 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search subcategories…"
                          value={subSearch}
                          onChange={(e) => setSubSearch(e.target.value)}
                          className="pl-8 h-9 text-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto px-1 pb-2">
                    {/* "No subcategory" option always at top */}
                    {(!subSearch || "none".includes(subSearch.toLowerCase())) && (
                      <button
                        disabled={savingCategory}
                        onClick={() => handlePickSubcategory(null)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                        <span className="flex-1 text-left text-muted-foreground">No subcategory</span>
                        {savingCategory && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      </button>
                    )}

                    {filteredSubs.map((sub) => (
                      <button
                        key={sub.id}
                        disabled={savingCategory}
                        onClick={() => handlePickSubcategory(sub.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                        <span className="flex-1 text-left">{sub.name}</span>
                        {savingCategory && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      </button>
                    ))}

                    {subsForChange.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        No subcategories in this category yet
                      </p>
                    )}
                    {filteredSubs.length === 0 && subSearch && subsForChange.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        No subcategories match &ldquo;{subSearch}&rdquo;
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
