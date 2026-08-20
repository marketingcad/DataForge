"use client";
import { useState, useTransition } from "react";
import { addManualAppointment } from "@/actions/appointments.actions";

type Rep = { id: string; name: string | null; email: string };

export function AddAppointmentModal({ reps }: { reps: Rep[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [agentId, setAgentId]         = useState("");
  const [clientName, setClientName]   = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookedAt, setBookedAt]       = useState("");
  const [notes, setNotes]             = useState("");

  function reset() {
    setAgentId(""); setClientName(""); setClientPhone(""); setBookedAt(""); setNotes("");
    setError(null); setSuccess(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agentId || !clientName.trim() || !bookedAt) {
      setError("Please fill in all required fields.");
      return;
    }
    startTransition(async () => {
      try {
        await addManualAppointment({ agentId, clientName, clientPhone, bookedAt, notes });
        setSuccess(true);
        setTimeout(() => { setOpen(false); reset(); }, 1200);
      } catch {
        setError("Failed to save. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors"
      >
        📅 Add Appointment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <p className="font-bold text-sm">Add Appointment</p>
                <p className="text-xs text-muted-foreground mt-0.5">Manually register a booked appointment</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Sales rep */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Sales Rep *</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Select a rep…</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>{r.name ?? r.email}</option>
                  ))}
                </select>
              </div>

              {/* Client name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Client Name *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Chad Aitken"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Client Phone</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="e.g. +13172893647"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Date booked */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Date Booked *</label>
                <input
                  type="datetime-local"
                  value={bookedAt}
                  onChange={(e) => setBookedAt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Notes (optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {error   && <p className="text-xs text-red-500">{error}</p>}
              {success && <p className="text-xs text-emerald-500 font-semibold">✓ Appointment saved!</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white py-2 text-sm font-bold transition-colors"
                >
                  {pending ? "Saving…" : "Save Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
