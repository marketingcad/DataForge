"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLeadsForFolderAction,
  getAllLeadsForExportAction,
  bulkDeleteLeadsAction,
} from "@/actions/leads.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Folder, Search, Phone, Globe, Mail, Loader2,
  ChevronLeft, ChevronRight, Trash2, Download,
  ArrowUpAZ, ArrowDownAZ, ArrowUpNarrowWide, ArrowDownNarrowWide,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Lead = {
  id: string;
  businessName: string;
  phone: string;
  email: string | null;
  website: string | null;
  contactPerson: string | null;
  city: string | null;
  state: string | null;
  dataQualityScore: number;
};

type SortOption = "name_asc" | "name_desc" | "newest" | "oldest";

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: "name_asc",  label: "A → Z", icon: <ArrowUpAZ className="h-3.5 w-3.5" /> },
  { value: "name_desc", label: "Z → A", icon: <ArrowDownAZ className="h-3.5 w-3.5" /> },
  { value: "newest",    label: "Newest", icon: <ArrowDownNarrowWide className="h-3.5 w-3.5" /> },
  { value: "oldest",    label: "Oldest", icon: <ArrowUpNarrowWide className="h-3.5 w-3.5" /> },
];

type FolderInfo = { id: string; name: string; color: string };

interface Props {
  folder: FolderInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function FolderLeadsModal({ folder, open, onOpenChange }: Props) {
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [search, setSearch]           = useState("");
  const [debSearch, setDebSearch]     = useState("");
  const [sort, setSort]               = useState<SortOption>("newest");
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<"selected" | "all" | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [exporting, setExporting]     = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [debSearch, sort]);

  const fetchLeads = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const r = await getLeadsForFolderAction({ folderId: folder.id, search: debSearch, sort, page });
      setLeads(r.leads as Lead[]);
      setTotal(r.total);
      setTotalPages(r.totalPages);
    } finally {
      setLoading(false);
    }
  }, [open, folder.id, debSearch, sort, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (!open) { setSearch(""); setDebSearch(""); setPage(1); setSelected(new Set()); setConfirmDelete(null); }
  }, [open]);

  // Selection helpers
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

  // Delete
  async function handleDelete() {
    setDeleting(true);
    try {
      if (confirmDelete === "all") {
        // Fetch all IDs then delete
        const all = await getAllLeadsForExportAction(folder.id);
        await bulkDeleteLeadsAction((all.leads as Lead[]).map((l) => l.id));
        toast.success(`Deleted all leads from "${folder.name}"`);
        setTotal(0);
        setLeads([]);
      } else {
        const ids = Array.from(selected);
        await bulkDeleteLeadsAction(ids);
        toast.success(`Deleted ${ids.length} lead${ids.length !== 1 ? "s" : ""}`);
        setSelected(new Set());
        await fetchLeads();
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  // Export
  async function handleExport(scope: "selected" | "all") {
    setExporting(true);
    try {
      let toExport: Lead[];
      if (scope === "selected") {
        toExport = leads.filter((l) => selected.has(l.id));
      } else {
        const all = await getAllLeadsForExportAction(folder.id);
        toExport = all.leads as Lead[];
      }
      exportToCSV(toExport, `${folder.name.replace(/\s+/g, "_")}_leads.csv`);
      toast.success(`Exported ${toExport.length} leads`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0"
        style={{ width: "calc(100vw - 40px)", maxWidth: "calc(100vw - 40px)", height: "calc(100vh - 60px)" }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
              style={{ backgroundColor: folder.color + "22" }}>
              <Folder className="h-4 w-4" style={{ color: folder.color }} />
            </div>
            <span>{folder.name}</span>
            <Badge variant="secondary" className="ml-1 text-xs"
              style={{ backgroundColor: folder.color + "18", color: folder.color }}>
              {total} lead{total !== 1 ? "s" : ""}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* ── Toolbar: search + sort + actions ── */}
        <div className="px-4 py-2.5 border-b shrink-0 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search name, phone, email…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setSort(o.value)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
                  sort === o.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                {o.icon}{o.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Export all */}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => handleExport("all")} disabled={exporting || total === 0}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export all
            </Button>
            {/* Delete all */}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete("all")} disabled={total === 0}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete all
            </Button>
          </div>
        </div>

        {/* ── Bulk action bar (shown when rows are selected) ── */}
        {someSelected && (
          <div className="px-4 py-2 border-b bg-primary/5 flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-primary">
              {selected.size} selected
            </span>
            <div className="flex gap-1.5 ml-auto">
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                onClick={() => handleExport("selected")} disabled={exporting}>
                <Download className="h-3.5 w-3.5" />
                Export selected
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete("selected")}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected
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
              {confirmDelete === "all"
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
          {/* Full-area loading overlay */}
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
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all on page"
                    />
                  </TableHead>
                  <TableHead className="sticky top-0 bg-background w-8">#</TableHead>
                  <TableHead className="sticky top-0 bg-background">Business Name</TableHead>
                  <TableHead className="sticky top-0 bg-background">Contact</TableHead>
                  <TableHead className="sticky top-0 bg-background">Location</TableHead>
                  <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                  <TableHead className="sticky top-0 bg-background">Email</TableHead>
                  <TableHead className="sticky top-0 bg-background">Website</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Score</TableHead>
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
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={() => toggleOne(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {(page - 1) * 20 + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px]">
                      <span className="truncate block">{lead.businessName}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px]">
                      <span className="truncate block">{lead.contactPerson ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono whitespace-nowrap">
                      {lead.phone
                        ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{lead.phone}</span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px]">
                      {lead.email
                        ? <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate">{lead.email}</span></span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                      {lead.website
                        ? <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-500 hover:underline truncate">
                            <Globe className="h-3 w-3 shrink-0" /><span className="truncate">{lead.website}</span>
                          </a>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs tabular-nums">{lead.dataQualityScore}</Badge>
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
  );
}
