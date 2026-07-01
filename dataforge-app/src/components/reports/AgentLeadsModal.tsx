"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Users, Loader2, Search, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getAgentLeadsAction } from "@/actions/leads.actions";

type Lead = Awaited<ReturnType<typeof getAgentLeadsAction>>[number];

interface Props {
  agentId: string;
  agentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring";

/** Nicely label a lead source (e.g. "GoogleMaps:keyword_123" → "Google Maps"). */
function sourceLabel(source: string): string {
  if (source === "GHL") return "🔗 GHL";
  if (source.startsWith("GoogleMaps")) return "🔍 Google Maps";
  if (source.toLowerCase().includes("csv")) return "📄 CSV Import";
  return source;
}

export function AgentLeadsModal({ agentId, agentName, open, onOpenChange }: Props) {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");
  const [source, setSource]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLeads(await getAgentLeadsAction(agentId));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { setSearch(""); setSource(""); }, [open, agentId]);

  // Distinct sources present, for the filter dropdown.
  const sourceOptions = useMemo(
    () => [...new Set(leads.map((l) => l.source))].sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (source && l.source !== source) return false;
      if (q) {
        const hit =
          l.businessName?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [leads, search, source]);

  const hasFilters = !!(search || source);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0"
        style={{ width: "calc(100vw - 100px)", height: "calc(100vh - 120px)", maxWidth: "none" }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            {agentName ? `${agentName}'s Leads` : "Leads"}
            {!loading && (
              <Badge variant="secondary" className="ml-1 rounded-full text-[11px] px-2 py-0">
                {hasFilters ? `${filtered.length} / ${leads.length}` : leads.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Filter bar ── */}
        <div className="px-5 py-2.5 border-b shrink-0 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search business, phone, or email…"
              className="h-8 w-64 rounded-md border border-input bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {sourceOptions.length > 1 && (
            <select value={source} onChange={(e) => setSource(e.target.value)} className={SELECT_CLASS}>
              <option value="">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>{sourceLabel(s)}</option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button onClick={() => { setSearch(""); setSource(""); }} className="inline-flex items-center gap-1 h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <p className="text-4xl">📇</p>
              <p className="text-sm">No leads saved by this agent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-background">Business</TableHead>
                  <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                  <TableHead className="sticky top-0 bg-background">Email</TableHead>
                  <TableHead className="sticky top-0 bg-background">Location</TableHead>
                  <TableHead className="sticky top-0 bg-background">Category</TableHead>
                  <TableHead className="sticky top-0 bg-background text-center">Score</TableHead>
                  <TableHead className="sticky top-0 bg-background">Source</TableHead>
                  <TableHead className="sticky top-0 bg-background whitespace-nowrap">Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                      No leads match your filters
                    </TableCell>
                  </TableRow>
                ) : filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.businessName}</TableCell>
                    <TableCell className="text-muted-foreground">{l.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.category || "—"}</TableCell>
                    <TableCell className="text-center tabular-nums font-semibold">{l.dataQualityScore}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{sourceLabel(l.source)}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(l.dateCollected).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ── Footer count ── */}
        {!loading && leads.length > 0 && (
          <div className="px-5 py-2.5 border-t shrink-0 bg-background">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
