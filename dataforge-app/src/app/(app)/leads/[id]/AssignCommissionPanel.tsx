"use client";

import { useState, useTransition } from "react";
import { assignLeadCommissionAction } from "@/actions/lead-commissions.actions";

type Rep = { id: string; name: string | null; email: string };
type Rule = { id: string; name: string; amount: number };
type Existing = {
  id: string;
  agentId: string;
  amount: number;
  note: string | null;
  status: string;
  ruleId: string | null;
  agent: { id: string; name: string | null; email: string };
  rule: { id: string; name: string; amount: number } | null;
} | null;

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-500/10 text-amber-600",
  paid:      "bg-sky-500/10 text-sky-600",
  confirmed: "bg-emerald-500/10 text-emerald-600",
};
const STATUS_LABEL: Record<string, string> = {
  pending:   "⏳ Pending",
  paid:      "💳 Paid",
  confirmed: "✅ Confirmed",
};

export function AssignCommissionPanel({
  leadId,
  salesReps,
  rules,
  existing,
}: {
  leadId: string;
  salesReps: Rep[];
  rules: Rule[];
  existing: Existing;
}) {
  const [open, setOpen] = useState(!existing);
  const [agentId, setAgentId] = useState(existing?.agentId ?? "");
  const [ruleId, setRuleId]   = useState(existing?.ruleId ?? "");
  const [amount, setAmount]   = useState(existing ? String(existing.amount) : "");
  const [note, setNote]       = useState(existing?.note ?? "");
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onRuleChange(id: string) {
    setRuleId(id);
    if (id) {
      const rule = rules.find((r) => r.id === id);
      if (rule) setAmount(String(rule.amount));
    }
  }

  function handleSave() {
    if (!agentId) { setError("Select a sales rep."); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
      setError("Enter a valid commission amount."); return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("leadId",  leadId);
    fd.set("agentId", agentId);
    fd.set("ruleId",  ruleId);
    fd.set("amount",  amount);
    fd.set("note",    note);
    startTransition(async () => {
      try {
        await assignLeadCommissionAction(fd);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-card shadow-sm border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <p className="font-semibold text-sm">Sales Rep Assignment &amp; Commission</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assign this lead to a rep and set their commission.
          </p>
        </div>
        <button
          onClick={() => setOpen((p) => !p)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          {open ? "Cancel" : existing ? "Edit" : "Assign"}
        </button>
      </div>

      {/* Current assignment summary (when not editing) */}
      {!open && existing && (
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center text-sm font-bold text-violet-600">
                {(existing.agent.name ?? existing.agent.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{existing.agent.name ?? existing.agent.email}</p>
                {existing.rule && (
                  <p className="text-xs text-muted-foreground">Rule: {existing.rule.name}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-amber-600">₱{existing.amount.toLocaleString()}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[existing.status]}`}>
                {STATUS_LABEL[existing.status] ?? existing.status}
              </span>
            </div>
          </div>
          {existing.note && (
            <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">{existing.note}</p>
          )}
        </div>
      )}

      {!open && !existing && (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
          Not yet assigned.{" "}
          <button onClick={() => setOpen(true)} className="underline text-primary font-medium">
            Assign now →
          </button>
        </div>
      )}

      {/* Edit / Create form */}
      {open && (
        <div className="p-5 space-y-4">
          {/* Rep selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sales Rep *
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">— Select rep —</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ?? r.email}
                </option>
              ))}
            </select>
          </div>

          {/* Commission rule preset */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Commission Rule (preset)
            </label>
            <select
              value={ruleId}
              onChange={(e) => onRuleChange(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">— No rule / manual amount —</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — ₱{r.amount.toLocaleString()}
                </option>
              ))}
            </select>
            {ruleId && (
              <p className="text-[11px] text-muted-foreground">
                Amount pre-filled from rule. You can override it below.
              </p>
            )}
          </div>

          {/* Amount override */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Commission Amount (₱) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₱
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                className="w-full rounded-xl border border-border/60 bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Standard client deal"
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-border/50 py-2 text-sm font-semibold hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : existing ? "Update Assignment" : "Assign & Set Commission"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
