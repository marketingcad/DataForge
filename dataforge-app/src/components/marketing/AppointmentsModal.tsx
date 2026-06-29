"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { CalendarDays, Trash2, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getAppointmentsAction, deleteAppointmentAction } from "@/actions/appointments.actions";

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

export function AppointmentsModal({ agentId, agentName, canDelete = false, open, onOpenChange }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(false);

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

  const showRepCol = !agentId;

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
                {appointments.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

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
                {appointments.map((a) => (
                  <TableRow key={a.id}>
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
          <div className="px-5 py-2.5 border-t shrink-0 bg-background">
            <p className="text-xs text-muted-foreground">
              {appointments.length} appointment{appointments.length !== 1 ? "s" : ""} total
            </p>
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
