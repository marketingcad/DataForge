"use client";

import { useState, useTransition } from "react";
import {
  createCommissionRuleAction,
  updateCommissionRuleAction,
  deleteCommissionRuleAction,
} from "@/actions/commissions.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Plus,
  DollarSign,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Zap,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  {
    value: "per_lead_saved",
    label: "Per Lead Saved",
    desc: "Paid when a rep keeps a lead ready for a scheduled meeting",
    icon: UserCheck,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    activeBorder: "border-blue-400",
    activeBg: "bg-blue-50/80 dark:bg-blue-950/20",
  },
  {
    value: "per_client_signup",
    label: "Per Client Signup",
    desc: "Paid when the client successfully signs up",
    icon: Zap,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    activeBorder: "border-violet-400",
    activeBg: "bg-violet-50/80 dark:bg-violet-950/20",
  },
];

const PERIODS = [
  { value: "weekly",   label: "Weekly"   },
  { value: "monthly",  label: "Monthly"  },
  { value: "one_time", label: "One-Time" },
];

const EMPTY = {
  name: "", description: "", type: "per_lead_saved",
  amount: "5", period: "one_time", active: true,
};

export function CommissionsManager({ rules: initial, currency }: { rules: Rule[]; currency: string }) {
  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;

  const [rules, setRules]       = useState(initial);
  const [editing, setEditing]   = useState<Rule | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setForm(EMPTY); setEditing(null); setError(null); setDrawerOpen(true);
  }
  function openEdit(r: Rule) {
    setForm({
      name: r.name, description: r.description ?? "", type: r.type,
      amount: String(r.amount), period: r.period, active: r.active,
    });
    setEditing(r); setError(null); setDrawerOpen(true);
  }
  function closeDrawer() { setDrawerOpen(false); setEditing(null); setError(null); }

  function f<K extends keyof typeof EMPTY>(key: K, val: (typeof EMPTY)[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function buildFd() {
    const fd = new FormData();
    fd.set("name", form.name); fd.set("description", form.description);
    fd.set("type", form.type); fd.set("amount", form.amount);
    fd.set("period", form.period); fd.set("active", String(form.active));
    return fd;
  }

  function handleSave() {
    if (!form.name.trim()) { setError("Rule name is required."); return; }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError("Enter a valid amount."); return; }
    setError(null);
    startTransition(async () => {
      try {
        if (editing) {
          await updateCommissionRuleAction(editing.id, buildFd());
          setRules((prev) => prev.map((r) =>
            r.id === editing.id
              ? { ...r, name: form.name, description: form.description || null, type: form.type,
                  amount: parseFloat(form.amount), milestoneTarget: null, period: form.period, active: form.active }
              : r
          ));
          closeDrawer();
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
    if (!confirm("Delete this commission rule?")) return;
    setDeleting(id);
    startTransition(async () => {
      try {
        await deleteCommissionRuleAction(id);
        setRules((prev) => prev.filter((r) => r.id !== id));
      } finally { setDeleting(null); }
    });
  }

  const typeInfo = TYPES.find((t) => t.value === form.type);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Commission Rules</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Define payout rules that can be applied to your sales team.</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shrink-0">
          <Plus className="h-4 w-4" /> New Rule
        </Button>
      </div>

      {/* ── Create / Edit Drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) closeDrawer(); }}>
        <SheetContent side="right" className="w-full max-w-[460px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <SheetTitle className="text-base">{editing ? "Edit Rule" : "New Commission Rule"}</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  {editing ? "Update this commission rule." : "Create a reusable commission rule for your team."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rule Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => f("name", e.target.value)}
                placeholder="e.g. Lead Booking Bonus"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => f("description", e.target.value)}
                rows={2}
                className="resize-none text-sm"
                placeholder="Describe when this commission applies…"
              />
            </div>

            <Separator />

            {/* Type */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commission Type</Label>
              <div className="grid grid-cols-1 gap-2">
                {TYPES.map((t) => {
                  const active = form.type === t.value;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => f("type", t.value)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all",
                        active ? `${t.activeBorder} ${t.activeBg}` : "border-border/60 hover:border-border"
                      )}
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", t.bg)}>
                        <Icon className={cn("h-4 w-4", t.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Amount + Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Amount ({currency}) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">
                    {currency}
                  </span>
                  <Input
                    type="number" min={0} step={0.01}
                    value={form.amount} onChange={(e) => f("amount", e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Period</Label>
                <Select value={form.period ?? ""} onValueChange={(v) => f("period", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => f("active", v)}
              />
              <div>
                <p className="text-sm font-semibold">{form.active ? "Active" : "Inactive"}</p>
                <p className="text-xs text-muted-foreground">{form.active ? "This rule is visible and assignable." : "This rule is hidden from assignment."}</p>
              </div>
            </div>

            {/* Preview */}
            {form.name && form.amount && !isNaN(parseFloat(form.amount)) && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Preview</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>{typeInfo?.label}</strong>: pay{" "}
                  <strong>{currency}{parseFloat(form.amount || "0").toFixed(2)}</strong>{" "}
                  {form.type === "per_lead_saved" && "per lead kept for a scheduled meeting"}
                  {form.type === "per_client_signup" && "per client signup"}
                  {" "}({form.period.replace("_", "-")})
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t flex-row gap-2 justify-end">
            <Button variant="outline" onClick={closeDrawer} disabled={isPending}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 min-w-[130px]"
            >
              {isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              ) : editing ? (
                "Save Changes"
              ) : (
                <><Plus className="h-3.5 w-3.5" /> Create Rule</>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Rules grid ── */}
      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-semibold">No commission rules yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create rules to reward your sales team.</p>
          </div>
          <Button size="sm" onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 mt-1">
            <Plus className="h-3.5 w-3.5" /> New Rule
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rules.map((rule) => {
            const t = TYPES.find((t) => t.value === rule.type);
            const Icon = t?.icon ?? DollarSign;
            return (
              <div key={rule.id} className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", t?.bg ?? "bg-muted")}>
                      <Icon className={cn("h-4.5 w-4.5", t?.color ?? "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate">{rule.name}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold shrink-0",
                            rule.active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {rule.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xl font-black text-amber-600 tabular-nums shrink-0">{fmt(rule.amount)}</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "type",    value: t?.label ?? rule.type.replace(/_/g, " ") },
                    { label: "period",  value: rule.period.replace("_", " ") },
                    { label: "applied", value: `${rule._count.earnings}x` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-muted/30 border border-border/30 px-3 py-2 text-center">
                      <p className="text-xs font-semibold capitalize truncate">{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-border/30 mt-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(rule)}
                    className="flex-1 gap-1.5 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rule.id)}
                    disabled={deleting === rule.id}
                    className="flex-1 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {deleting === rule.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
