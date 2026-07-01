"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { CalendarDays, Trash2, Loader2, Search, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getAppointmentsAction, deleteAppointmentAction, deleteAppointmentsAction } from "@/actions/appointments.actions";

type Appointment = Awaited<ReturnType<typeof getAppointmentsAction>>[number];

interface Props {
  /** If provided, only show this agent's appointments (sales_rep view) */
  agentId?: string;
  /** If provided, shown in the dialog title (e.g. "Cristina's Appointments") */
  agentName?: string;
  /** Whether the current user can delete */
  canDelete?: boolean;
  /** Controlled open state — pass your own useState pair */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm) { setConfirm(true); return; }
    startTransition(async () => {
      await deleteAppointmentAction(id);
      onDeleted();
    });
  }

  return (
    <button
      onClick={handleClick}
      onBlur={() => setConfirm(false)}
      disabled={pending}
      title={confirm ? "Click again to confirm delete" : "Delete appointment"}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        confirm
          ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      }`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {confirm && !pending ? "Confirm?" : ""}
    </button>
  );
}

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring";

export function AppointmentsModal({ agentId, agentName, canDelete = false, open, onOpenChange }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(false);

  // Filters
  const [search, setSearch]         = useState("");
  const [sourceFilter, setSource]   = useState<"" | "webhook" | "manual">("");
  const [repFilter, setRepFilter]   = useState<string>("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  // Bulk selection
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkPending, startBulk]    = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppointmentsAction(agentId);
      setAppointments(data);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Reset filters + selection whenever the modal (re)opens or the agent changes.
  useEffect(() => {
    setSearch(""); setSource(""); setRepFilter(""); setDateFrom(""); setDateTo("");
    setSelected(new Set()); setConfirmBulk(false);
  }, [open, agentId]);

  const showRepCol = !agentId;

  // Unique reps present in the data (for the rep filter dropdown).
  const repOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of appointments) {
      if (a.agentId) map.set(a.agentId, a.agent?.name ?? "Unassigned");
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name));
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs   = dateTo   ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return appointments.filter((a) => {
      if (q) {
        const hit = a.clientName?.toLowerCase().includes(q) || a.clientPhone?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (sourceFilter && a.source !== sourceFilter) return false;
      if (repFilter && a.agentId !== repFilter) return false;
      const ts = new Date(a.bookedAt).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [appointments, search, sourceFilter, repFilter, dateFrom, dateTo]);

  const hasFilters = !!(search || sourceFilter || repFilter || dateFrom || dateTo);
  function clearFilters() {
    setSearch(""); setSource(""); setRepFilter(""); setDateFrom(""); setDateTo("");
  }

  // Selection is scoped to the currently-filtered rows.
  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  function toggleAll() {
    setSelected((prev) => {
      const s = new Set(prev);
      if (allFilteredSelected) filtered.forEach((a) => s.delete(a.id));
      else filtered.forEach((a) => s.add(a.id));
      return s;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function bulkDelete() {
    if (!confirmBulk) { setConfirmBulk(true); return; }
    const ids = Array.from(selected);
    startBulk(async () => {
      try {
        await deleteAppointmentsAction(ids);
        setSelected(new Set());
        setConfirmBulk(false);
        await load();
      } catch { setConfirmBulk(false); }
    });
  }

  const colCount = 6 + (showRepCol ? 1 : 0) + (canDelete ? 2 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0"
        style={{ width: "calc(100vw - 100px)", height: "calc(100vh - 120px)", maxWidth: "none" }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {agentName ? `${agentName}'s Appointments` : "Appointments"}
            {!loading && (
              <Badge variant="secondary" className="ml-1 rounded-full text-[11px] px-2 py-0">
                {hasFilters ? `${filtered.length} / ${appointments.length}` : appointments.length}
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
              placeholder="Search client or phone…"
              className="h-8 w-56 rounded-md border border-input bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select value={sourceFilter} onChange={(e) => setSource(e.target.value as "" | "webhook" | "manual")} className={SELECT_CLASS}>
            <option value="">All sources</option>
            <option value="webhook">🔗 GHL</option>
            <option value="manual">✏️ Manual</option>
          </select>

          {showRepCol && repOptions.length > 0 && (
            <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} className={SELECT_CLASS}>
              <option value="">All reps</option>
              {repOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Booked</span>
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={SELECT_CLASS} />
            <span className="text-[10px] text-muted-foreground">–</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={SELECT_CLASS} />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {/* ── Bulk action bar ── */}
        {canDelete && selected.size > 0 && (
          <div className="px-5 py-2 border-b shrink-0 bg-destructive/5 flex items-center gap-3">
            <span className="text-xs font-medium">{selected.size} selected</span>
            <button
              onClick={bulkDelete}
              onBlur={() => setConfirmBulk(false)}
              disabled={bulkPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-40 transition-colors"
            >
              {bulkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {bulkPending ? "Deleting…" : confirmBulk ? `Confirm delete ${selected.size}?` : `Delete ${selected.size}`}
            </button>
            <button onClick={() => { setSelected(new Set()); setConfirmBulk(false); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear selection
            </button>
          </div>
        )}

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <p className="text-4xl">📅</p>
              <p className="text-sm">No appointments recorded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canDelete && (
                    <TableHead className="sticky top-0 bg-background w-10">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                  )}
                  <TableHead className="sticky top-0 bg-background">Client</TableHead>
                  <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                  <TableHead className="sticky top-0 bg-background whitespace-nowrap">Date Booked</TableHead>
                  {showRepCol && (
                    <TableHead className="sticky top-0 bg-background">Sales Rep</TableHead>
                  )}
                  <TableHead className="sticky top-0 bg-background">Source</TableHead>
                  <TableHead className="sticky top-0 bg-background">Added By</TableHead>
                  {canDelete && <TableHead className="sticky top-0 bg-background w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center text-sm text-muted-foreground py-10">
                      No appointments match your filters
                    </TableCell>
                  </TableRow>
                ) : filtered.map((a) => (
                  <TableRow key={a.id} data-state={selected.has(a.id) ? "selected" : undefined}>
                    {canDelete && (
                      <TableCell>
                        <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} aria-label="Select appointment" />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{a.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{a.clientPhone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(a.bookedAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "numeric", minute: "2-digit",
                      })}
                    </TableCell>
                    {showRepCol && (
                      <TableCell className="font-medium">{a.agent.name ?? "—"}</TableCell>
                    )}
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.source === "webhook"
                          ? "bg-sky-500/10 text-sky-600"
                          : "bg-violet-500/10 text-violet-600"
                      }`}>
                        {a.source === "webhook" ? "🔗 GHL" : "✏️ Manual"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {a.source === "webhook" ? "GHL Automation" : (a.createdBy?.name ?? "—")}
                    </TableCell>
                    {canDelete && (
                      <TableCell className="text-right">
                        <DeleteButton id={a.id} onDeleted={load} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ── Footer count ── */}
        {!loading && appointments.length > 0 && (
          <div className="px-5 py-2.5 border-t shrink-0 bg-background flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}
            </p>
            {canDelete && selected.size > 0 && (
              <p className="text-xs text-muted-foreground">{selected.size} selected</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Self-contained trigger button + modal — drop into any server component header */
export function AppointmentsModalButton({
  agentId,
  canDelete = false,
}: {
  agentId?: string;
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-colors"
      >
        📋 View Appointments
      </button>
      <AppointmentsModal
        agentId={agentId}
        canDelete={canDelete}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
