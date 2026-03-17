"use client";

import { useState, useEffect, useCallback } from "react";
import { getLeadsForFolderAction } from "@/actions/leads.actions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Folder, Search, Phone, Globe, Mail, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

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

type FolderInfo = {
  id: string;
  name: string;
  color: string;
};

interface FolderLeadsModalProps {
  folder: FolderInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FolderLeadsModal({ folder, open, onOpenChange }: FolderLeadsModalProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 on new search
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const fetchLeads = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const result = await getLeadsForFolderAction({
        folderId: folder.id,
        search: debouncedSearch,
        page,
      });
      setLeads(result.leads as Lead[]);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } finally {
      setLoading(false);
    }
  }, [open, folder.id, debouncedSearch, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col p-0 gap-0" style={{ width: "calc(100% - 40px)", maxWidth: "calc(100% - 40px)" }}>
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
              style={{ backgroundColor: folder.color + "22" }}
            >
              <Folder className="h-4 w-4" style={{ color: folder.color }} />
            </div>
            <span>{folder.name}</span>
            <Badge
              variant="secondary"
              className="ml-1 text-xs"
              style={{ backgroundColor: folder.color + "18", color: folder.color }}
            >
              {total} lead{total !== 1 ? "s" : ""}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="px-6 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading leads…</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Folder className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm">
                {debouncedSearch ? "No leads match your search" : "No leads in this folder yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-background">#</TableHead>
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
                  <TableRow key={lead.id}>
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
                      {lead.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {lead.phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px]">
                      {lead.email ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[140px]">
                      {lead.website ? (
                        <a
                          href={`https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-500 hover:underline truncate"
                        >
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.website}</span>
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs tabular-nums">
                        {lead.dataQualityScore}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t shrink-0 bg-background">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2 tabular-nums">{page} / {totalPages}</span>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
