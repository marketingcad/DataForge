"use client";
import { useState, useTransition } from "react";
import { createManualLeadAction } from "@/actions/leads.actions";

type Rep = { id: string; name: string | null; email: string };

export function AddLeadModal({ reps }: { reps: Rep[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [agentId, setAgentId]           = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone]               = useState("");
  const [email, setEmail]               = useState("");
  const [website, setWebsite]           = useState("");
  const [city, setCity]                 = useState("");
  const [state, setState]               = useState("");
  const [category, setCategory]         = useState("");

  function reset() {
    setAgentId(""); setBusinessName(""); setPhone(""); setEmail("");
    setWebsite(""); setCity(""); setState(""); setCategory("");
    setError(null); setSuccess(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agentId || !businessName.trim()) {
      setError("Please select a rep and enter a business name.");
      return;
    }
    startTransition(async () => {
      try {
        await createManualLeadAction({ agentId, businessName, phone, email, website, city, state, category });
        setSuccess(true);
        setTimeout(() => { setOpen(false); reset(); }, 1200);
      } catch (err) {
        setError((err as Error).message || "Failed to save. Please try again.");
      }
    });
  }

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelClass = "text-xs font-semibold text-foreground/70 uppercase tracking-wide";

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
      >
        ➕ Add Lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl max-h-[calc(100vh-80px)] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 bg-card">
              <div>
                <p className="font-bold text-sm">Add Lead</p>
                <p className="text-xs text-muted-foreground mt-0.5">Manually register a lead tied to a rep</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Sales Rep *</label>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputClass}>
                  <option value="">Select a rep…</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>{r.name ?? r.email}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Business Name *</label>
                <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Acme Roofing" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={inputClass} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Website</label>
                <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="company.com" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>State</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Category</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Roofing" className={inputClass} />
              </div>

              {error   && <p className="text-xs text-red-500">{error}</p>}
              {success && <p className="text-xs text-emerald-500 font-semibold">✓ Lead saved!</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 text-sm font-bold transition-colors">
                  {pending ? "Saving…" : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
