"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getFoldersAction } from "@/actions/folders.actions";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search, Phone, Globe, Mail, Loader2,
  ChevronRight, ChevronLeft, Download, Check, ChevronDown,
  Copy, MapPin, FolderOpen, Save, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/notifications";
import { formatPhone } from "@/lib/utils/normalize";

type PendingLead = {
  businessName: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
};

type Folder = { id: string; name: string; color: string };
type SortOption = "name_asc" | "name_desc";
type SearchField = "business" | "location" | "phone" | "email" | "website";

const PAGE_SIZE = 20;

const SORT_LABELS: Record<SortOption, string> = {
  name_asc:  "Name A→Z",
  name_desc: "Name Z→A",
};

const SEARCH_FIELDS: { value: SearchField; label: string; placeholder: string }[] = [
  { value: "business",  label: "Business",  placeholder: "Search by business name…" },
  { value: "location",  label: "Location",  placeholder: "Search by city or state…" },
  { value: "phone",     label: "Phone",     placeholder: "Search by phone number…" },
  { value: "email",     label: "Email",     placeholder: "Search by email address…" },
  { value: "website",   label: "Website",   placeholder: "Search by website…" },
];

interface Props {
  jobId: string;
  pendingLeads: PendingLead[];
  keyword: string;
  location: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: number) => void;
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

function exportToCSV(leads: PendingLead[], filename: string) {
  const headers = ["Business Name", "Phone", "Email", "Website", "Address", "City", "State"];
  const rows = leads.map((l) => [
    l.businessName, l.phone ?? "", l.email ?? "",
    l.website ?? "", l.address ?? "", l.city ?? "", l.state ?? "",
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

export function KeywordLeadsModal({ jobId, pendingLeads, keyword, location, open, onOpenChange, onSaved }: Props) {
  const [search, setSearch]               = useState("");
  const [searchField, setSearchField]     = useState<SearchField>("business");
  const [sort, setSort]                   = useState<SortOption>("name_asc");
  const [page, setPage]                   = useState(1);
  const [selected, setSelected]           = useState<Set<number>>(new Set());
  const [folders, setFolders]             = useState<Folder[]>([]);
  const [folderId, setFolderId]           = useState<string>("");
  const [saving, setSaving]               = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [saved, setSaved]                 = useState<{ saved: number; duplicates: number } | null>(null);

  const { add: addNotif } = useNotifications();

  // Load folders on open
  useEffect(() => {
    if (!open) return;
    getFoldersAction().then((f) => setFolders(f as Folder[])).catch(() => {});
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch(""); setSearchField("business"); setPage(1);
      setSelected(new Set()); setSaved(null); setFolderId("");
    }
  }, [open]);

  // Reset page when search/sort changes
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, searchField, sort]);

  // Client-side filter + sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = pendingLeads;
    if (q) {
      list = list.filter((l) => {
        switch (searchField) {
          case "location": return [l.city, l.state].some((v) => v?.toLowerCase().includes(q));
          case "phone":    return l.phone?.toLowerCase().includes(q);
          case "email":    return l.email?.toLowerCase().includes(q);
          case "website":  return l.website?.toLowerCase().includes(q);
          default:         return l.businessName.toLowerCase().includes(q);
        }
      });
    }
    if (sort === "name_asc")  list = [...list].sort((a, b) => a.businessName.localeCompare(b.businessName));
    if (sort === "name_desc") list = [...list].sort((a, b) => b.businessName.localeCompare(a.businessName));
    return list;
  }, [pendingLeads, search, searchField, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Selection uses original-array index for stable identity
  const pageIndices = paginated.map((l) => pendingLeads.indexOf(l));
  const allOnPageSelected = pageIndices.length > 0 && pageIndices.every((i) => selected.has(i));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => { const s = new Set(prev); pageIndices.forEach((i) => s.delete(i)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); pageIndices.forEach((i) => s.add(i)); return s; });
    }
  }

  function toggleOne(idx: number) {
    setSelected((prev) => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s; });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((l) => pendingLeads.indexOf(l))));
  }

  async function handleSave() {
    const leadsToSave = Array.from(selected).map((i) => pendingLeads[i]);
    if (!leadsToSave.length) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scraping/jobs/${jobId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderId || undefined, leads: leadsToSave }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setSaved({ saved: data.saved, duplicates: data.duplicates });
      addNotif({
        type: "success",
        title: `${data.saved} lead${data.saved !== 1 ? "s" : ""} saved`,
        message: `Saved to${folderId ? ` folder` : " All Leads"}${data.duplicates > 0 ? ` (${data.duplicates} duplicate${data.duplicates !== 1 ? "s" : ""} skipped)` : ""}.`,
      });
      onSaved(data.saved);
    } catch {
      addNotif({ type: "error", title: "Save failed", message: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    setExporting(true);
    try {
      const toExport = someSelected
        ? Array.from(selected).map((i) => pendingLeads[i])
        : filtered;
      exportToCSV(toExport, `${keyword.replace(/\s+/g, "_")}_${location.replace(/\s+/g, "_")}_leads.csv`);
      addNotif({ type: "success", title: `${toExport.length} lead${toExport.length !== 1 ? "s" : ""} exported`, message: "Saved as CSV." });
    } finally {
      setExporting(false);
    }
  }

  const activeField = SEARCH_FIELDS.find((f) => f.value === searchField) ?? SEARCH_FIELDS[0];

  return (
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
                <span className="truncate">Review &amp; save scraped leads</span>
                <Badge className="shrink-0 text-[10px] font-medium px-1.5 py-0 bg-primary/10 text-primary border-none">
                  {pendingLeads.length} pending
                </Badge>
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* ── Success state ── */}
        {saved && (
          <div className="px-5 py-4 border-b bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-3 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {saved.saved} lead{saved.saved !== 1 ? "s" : ""} saved successfully
                {saved.duplicates > 0 && ` · ${saved.duplicates} duplicate${saved.duplicates !== 1 ? "s" : ""} skipped`}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">You can close this window now.</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 dark:border-emerald-700"
              onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}

        {/* ── Toolbar ── */}
        {!saved && (
          <div className="px-4 pt-2.5 pb-2 border-b shrink-0 space-y-2">
            {/* Row 1 — search + sort + export */}
            <div className="flex items-center gap-2">
              {/* Search field selector + input */}
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
                onClick={handleExport} disabled={exporting || pendingLeads.length === 0}>
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Export {someSelected ? `(${selected.size})` : "all"}
              </Button>
            </div>

            {/* Row 2 — folder selector + save button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">Save to:</span>
                <Select value={folderId} onValueChange={(v) => setFolderId(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs flex-1 max-w-[220px]">
                    <SelectValue placeholder="All Leads (no folder)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">All Leads (no folder)</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: f.color }} />
                          {f.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filtered.length > 0 && selected.size < filtered.length && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={selectAll}>
                  Select all {filtered.length}
                </Button>
              )}
              {someSelected && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              )}

              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs shrink-0"
                onClick={handleSave}
                disabled={saving || selected.size === 0}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save {selected.size > 0 ? `${selected.size} selected` : "selected"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Bulk selection bar ── */}
        {!saved && someSelected && (
          <div className="px-4 py-1.5 border-b bg-primary/5 flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-primary">{selected.size} selected</span>
            <span className="text-xs text-muted-foreground">· ready to save to {folderId ? folders.find(f => f.id === folderId)?.name ?? "folder" : "All Leads"}</span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto relative">
          {pendingLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <MapPin className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm">No pending leads</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Search className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm">No leads match your search</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-background w-10">
                    <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} aria-label="Select all on page" />
                  </TableHead>
                  <TableHead className="sticky top-0 bg-background w-8 text-center">#</TableHead>
                  <TableHead className="sticky top-0 bg-background">Business</TableHead>
                  <TableHead className="sticky top-0 bg-background w-36">Address</TableHead>
                  <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                  <TableHead className="sticky top-0 bg-background">Email</TableHead>
                  <TableHead className="sticky top-0 bg-background">Website</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((lead, idx) => {
                  const origIdx = pendingLeads.indexOf(lead);
                  const isSelected = selected.has(origIdx);
                  return (
                    <TableRow
                      key={origIdx}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => toggleOne(origIdx)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(origIdx)} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono text-center">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium max-w-[180px]">
                        <CopyCell value={lead.businessName} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground w-36">
                        <CopyCell value={lead.address ?? ([lead.city, lead.state].filter(Boolean).join(", ") || null)} />
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        <CopyCell value={lead.phone ?? null}>
                          {lead.phone && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />{formatPhone(lead.phone)}
                            </span>
                          )}
                        </CopyCell>
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px]">
                        <CopyCell value={lead.email ?? null}>
                          {lead.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="whitespace-nowrap">{lead.email}</span>
                            </span>
                          )}
                        </CopyCell>
                      </TableCell>
                      <TableCell className="text-sm max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                        <CopyCell value={lead.website ?? null}>
                          {lead.website && (
                            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-500 hover:underline whitespace-nowrap">
                              <Globe className="h-3 w-3 shrink-0" />{lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                            </a>
                          )}
                        </CopyCell>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t shrink-0 bg-background">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
