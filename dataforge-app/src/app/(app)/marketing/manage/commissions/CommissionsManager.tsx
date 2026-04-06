"use client";

import { useState, useTransition } from "react";
import {
  createCommissionRuleAction,
  updateCommissionRuleAction,
  deleteCommissionRuleAction,
} from "@/actions/commissions.actions";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  amount: number;
  milestoneTarget: number | null;
  period: string;
  active: boolean;
  createdAt: Date;
  _count: { earnings: number };
};

const TYPES = [
  { value: "per_call",      label: "Per Call",        desc: "Earn $X for every call made" },
  { value: "per_lead_saved",label: "Per Lead Saved",  desc: "Earn $X for every lead moved to a folder" },
  { value: "flat_monthly",  label: "Flat Monthly",    desc: "Fixed $X every period regardless of activity" },
  { value: "milestone",     label: "Milestone Bonus", desc: "One-time $X bonus upon reaching X calls" },
];

const PERIODS = [
  { value: "weekly",   label: "Weekly"   },
  { value: "monthly",  label: "Monthly"  },
  { value: "one_time", label: "One-Time" },
];

const EMPTY = { name: "", description: "", type: "per_call", amount: "5", milestoneTarget: "", period: "monthly", active: true };

const fmt = (n: number) => `$${n.toFixed(2)}`;

export function CommissionsManager({ rules: initial }: { rules: Rule[] }) {
  const [rules, setRules]       = useState(initial);
  const [editing, setEditing]   = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true); setError(null); }
  function openEdit(r: Rule) {
    setForm({ name: r.name, description: r.description ?? "", type: r.type,
               amount: String(r.amount), milestoneTarget: r.milestoneTarget ? String(r.milestoneTarget) : "",
               period: r.period, active: r.active });
    setEditing(r); setCreating(false); setError(null);
  }
  function closeForm() { setCreating(false); setEditing(null); setError(null); }

  function f(key: keyof typeof EMPTY, val: unknown) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function buildFd() {
    const fd = new FormData();
    fd.set("name",            form.name);
    fd.set("description",     form.description);
    fd.set("type",            form.type);
    fd.set("amount",          form.amount);
    fd.set("milestoneTarget", form.milestoneTarget);
    fd.set("period",          form.period);
    fd.set("active",          String(form.active));
    return fd;
  }

  function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError("Enter a valid dollar amount."); return; }
    if (form.type === "milestone" && (!form.milestoneTarget || isNaN(parseInt(form.milestoneTarget)))) {
      setError("Milestone type requires a target call count."); return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (editing) {
          await updateCommissionRuleAction(editing.id, buildFd());
          setRules((prev) => prev.map((r) =>
            r.id === editing.id
              ? { ...r, name: form.name, description: form.description || null, type: form.type,
                  amount: parseFloat(form.amount), milestoneTarget: form.milestoneTarget ? parseInt(form.milestoneTarget) : null,
                  period: form.period, active: form.active }
              : r
          ));
          closeForm();
        } else {
          await createCommissionRuleAction(buildFd());
          window.location.reload();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      try {
        await deleteCommissionRuleAction(id);
        setRules((prev) => prev.filter((r) => r.id !== id));
      } finally { setDeleting(null); }
    });
  }

  const showForm = creating || !!editing;
  const isMilestone = form.type === "milestone";

  const typeInfo = TYPES.find((t) => t.value === form.type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Commissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define commission rules for your sales team.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2.5 transition-colors shadow-sm">
          + New Commission Rule
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl bg-card shadow-sm border border-border/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <p className="font-bold text-sm">{editing ? "Edit Commission Rule" : "Create New Rule"}</p>
            <button onClick={closeForm} className="text-xs text-muted-foreground hover:text-foreground">✕ Cancel</button>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rule Name *</label>
                <input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. Monthly Call Bonus" className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={(e) => f("description", e.target.value)} rows={2} placeholder="Describe this commission…" className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => f("type", t.value)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        form.type === t.value
                          ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20"
                          : "border-border/60 hover:border-border"
                      }`}
                    >
                      <p className="text-xs font-bold">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
                    <input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => f("amount", e.target.value)} placeholder="5.00" className="w-full rounded-xl border border-border/60 bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period</label>
                  <select value={form.period} onChange={(e) => f("period", e.target.value)} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40">
                    {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {isMilestone && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Milestone Target (calls)</label>
                  <input type="number" min={1} value={form.milestoneTarget} onChange={(e) => f("milestoneTarget", e.target.value)} placeholder="e.g. 200" className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => f("active", !form.active)} className={`relative h-5 w-9 rounded-full transition-colors ${form.active ? "bg-amber-500" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${form.active ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <p className="text-sm font-medium">{form.active ? "Active" : "Inactive"}</p>
              </div>

              {/* Summary preview */}
              <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                💰 <strong>{typeInfo?.label}</strong>: pay{" "}
                <strong>{form.amount ? `$${parseFloat(form.amount || "0").toFixed(2)}` : "$0.00"}</strong>{" "}
                {form.type === "per_call" && "per call made"}
                {form.type === "per_lead_saved" && "per lead saved to a folder"}
                {form.type === "flat_monthly" && `every ${form.period} period`}
                {form.type === "milestone" && `when agent reaches ${form.milestoneTarget || "?"} calls`}
              </div>
            </div>
          </div>
          {error && <div className="mx-6 mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
          <div className="px-6 pb-6 flex justify-end gap-3">
            <button onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={isPending} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm">
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Rule"}
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showForm ? (
        <div className="rounded-2xl bg-card shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-sm font-bold">No commission rules yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create rules to reward your reps.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-2xl bg-card shadow-sm border border-border/30 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{rule.name}</p>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${rule.active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {rule.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {rule.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rule.description}</p>}
                </div>
                <p className="text-xl font-black text-amber-600 shrink-0">{fmt(rule.amount)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/20 px-2 py-2">
                  <p className="text-xs font-bold capitalize">{TYPES.find((t) => t.value === rule.type)?.label}</p>
                  <p className="text-[10px] text-muted-foreground">type</p>
                </div>
                <div className="rounded-xl bg-muted/20 px-2 py-2">
                  <p className="text-xs font-bold capitalize">{rule.period.replace("_", " ")}</p>
                  <p className="text-[10px] text-muted-foreground">period</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 px-2 py-2">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{rule._count.earnings}</p>
                  <p className="text-[10px] text-muted-foreground">earnings</p>
                </div>
              </div>
              {rule.milestoneTarget && (
                <p className="text-xs text-muted-foreground">🎯 Triggers at {rule.milestoneTarget} calls</p>
              )}
              <div className="flex gap-2 pt-1 border-t border-border/30">
                <button onClick={() => openEdit(rule)} className="flex-1 text-xs font-semibold py-1.5 rounded-lg hover:bg-muted/40 transition-colors text-center">Edit</button>
                <button onClick={() => handleDelete(rule.id)} disabled={deleting === rule.id} className="flex-1 text-xs font-semibold py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 transition-colors text-center disabled:opacity-50">
                  {deleting === rule.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
