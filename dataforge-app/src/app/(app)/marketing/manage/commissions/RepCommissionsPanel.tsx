"use client";

import { useState, useTransition } from "react";
import {
  createRepCommissionAction,
  markRepCommissionEarnedAction,
  deleteRepCommissionAction,
} from "@/actions/rep-commissions.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Clock,
  CheckCircle2,
  DollarSign,
  Loader2,
  AlertCircle,
  Trash2,
  BadgeCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Rep  = { id: string; name: string | null; email: string };
type Rule = { id: string; name: string; amount: number };

type Record_ = {
  id: string;
  amount: number;
  note: string | null;
  status: string;
  createdAt: Date;
  earnedAt: Date | null;
  rep:      { id: string; name: string | null; email: string };
  rule:     { id: string; name: string } | null;
  earnedBy: { id: string; name: string | null; email: string } | null;
};

function RepAvatar({ name, email }: { name: string | null; email: string }) {
  const initials = ((name ?? email)[0] ?? "?").toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-xs font-bold text-violet-600 shrink-0">
      {initials}
    </div>
  );
}

const STATUS_CFG: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className: string }> = {
  pending: { label: "Pending", variant: "outline", className: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" },
  earned:  { label: "Earned",  variant: "outline", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" },
};

export function RepCommissionsPanel({
  records: initial,
  reps,
  rules,
  currency,
}: {
  records: Record_[];
  reps: Rep[];
  rules: Rule[];
  currency: string;
}) {
  const [records, setRecords]             = useState(initial);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [filterRep, setFilterRep]         = useState("all");
  const [filterStatus, setFilterStatus]   = useState("all");
  const [actingId, setActingId]           = useState<string | null>(null);
  const [isPending, startTransition]      = useTransition();

  // Form state
  const [repId, setRepId]       = useState("");
  const [ruleId, setRuleId]     = useState("");
  const [amount, setAmount]     = useState("");
  const [note, setNote]         = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function onRuleChange(id: string | null) {
    if (id == null) return;
    setRuleId(id);
    const rule = rules.find((r) => r.id === id);
    if (rule) setAmount(String(rule.amount));
  }

  function resetForm() {
    setRepId(""); setRuleId(""); setAmount(""); setNote(""); setFormError(null);
  }

  function openDrawer() { resetForm(); setDrawerOpen(true); }

  function handleCreate() {
    if (!repId)   { setFormError("Please select a sales rep."); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
      setFormError("Please enter a valid amount."); return;
    }
    setFormError(null);
    const fd = new FormData();
    fd.set("repId", repId); fd.set("ruleId", ruleId);
    fd.set("amount", amount); fd.set("note", note);
    startTransition(async () => {
      try {
        await createRepCommissionAction(fd);
        window.location.reload();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Failed to assign commission.");
      }
    });
  }

  function handleMarkEarned(id: string) {
    setActingId(id);
    startTransition(async () => {
      try {
        await markRepCommissionEarnedAction(id);
        setRecords((prev) =>
          prev.map((r) => r.id === id ? { ...r, status: "earned", earnedAt: new Date() } : r)
        );
      } finally { setActingId(null); }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this commission record?")) return;
    setActingId(id);
    startTransition(async () => {
      try {
        await deleteRepCommissionAction(id);
        setRecords((prev) => prev.filter((r) => r.id !== id));
      } finally { setActingId(null); }
    });
  }

  const filtered = records.filter((r) => {
    if (filterRep    !== "all" && r.rep.id !== filterRep)    return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const totalAll     = records.reduce((s, r) => s + r.amount, 0);
  const totalPending = records.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const totalEarned  = records.filter((r) => r.status === "earned").reduce((s, r) => s + r.amount, 0);

  const allReps = Array.from(new Map(initial.map((r) => [r.rep.id, r.rep])).values());

  return (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: DollarSign,  label: "Total Assigned", value: totalAll,     color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30",    ring: "ring-blue-100 dark:ring-blue-900" },
          { icon: Clock,       label: "Pending",        value: totalPending, color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30",  ring: "ring-amber-100 dark:ring-amber-900" },
          { icon: CheckCircle2, label: "Earned",        value: totalEarned,  color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", ring: "ring-emerald-100 dark:ring-emerald-900" },
        ].map(({ icon: Icon, label, value, color, bg, ring }) => (
          <div key={label} className="rounded-2xl border border-border/40 bg-card shadow-sm px-5 py-4 flex items-center gap-4">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-4", bg, ring)}>
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{label}</p>
              <p className={cn("text-2xl font-black tabular-nums", color)}>{currency}{value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterRep} onValueChange={(v) => v != null && setFilterRep(v)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reps</SelectItem>
            {allReps.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name ?? r.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => v != null && setFilterStatus(v)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="earned">Earned</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto self-center">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>

        <Button onClick={openDrawer} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="h-4 w-4" />
          Assign Commission
        </Button>
      </div>

      {/* ── Assign Commission Drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) setDrawerOpen(false); }}>
        <SheetContent side="right" className="w-full max-w-[440px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <SheetTitle className="text-base">Assign Commission</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">Add a commission record for a sales rep.</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {/* Sales Rep */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sales Rep <span className="text-red-500">*</span>
              </Label>
              <Select value={repId} onValueChange={(v) => v != null && setRepId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a rep…" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.name ?? r.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rule preset */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Commission Rule <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">(optional preset)</span>
              </Label>
              <Select value={ruleId} onValueChange={onRuleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="No rule — manual amount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No rule — manual amount</SelectItem>
                  {rules.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — {currency}{r.amount.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
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
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Note <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">(optional)</span>
              </Label>
              <Input
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Client signup — Acme Corp"
              />
            </div>

            {/* Preview */}
            {repId && amount && !isNaN(parseFloat(amount)) && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Preview</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Assigning <strong>{currency}{parseFloat(amount).toLocaleString()}</strong> to{" "}
                  <strong>{reps.find((r) => r.id === repId)?.name ?? "rep"}</strong>
                  {ruleId && ` for "${rules.find((r) => r.id === ruleId)?.name}"`}.
                </p>
              </div>
            )}

            {/* Error */}
            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">{formError}</p>
              </div>
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 min-w-[140px]"
            >
              {isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              ) : (
                <><DollarSign className="h-3.5 w-3.5" /> Assign Commission</>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Records table ── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-semibold">No commission records</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {records.length > 0 ? "No records match the current filters." : "Use the button above to assign a commission."}
            </p>
          </div>
          {records.length === 0 && (
            <Button size="sm" onClick={openDrawer} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 mt-1">
              <Plus className="h-3.5 w-3.5" /> Assign Commission
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="pl-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rule</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</TableHead>
                <TableHead className="pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const cfg = STATUS_CFG[r.status];
                return (
                  <TableRow key={r.id} className="border-b border-border/30">
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <RepAvatar name={r.rep.name} email={r.rep.email} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{r.rep.name ?? r.rep.email.split("@")[0]}</p>
                          {r.rep.name && <p className="text-[11px] text-muted-foreground truncate">{r.rep.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {r.rule
                        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">{r.rule.name}</span>
                        : <span className="text-xs text-muted-foreground">Manual</span>
                      }
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-base font-black text-amber-600 tabular-nums">{currency}{r.amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="py-3 max-w-[160px]">
                      <p className="text-xs text-muted-foreground truncate">{r.note ?? <span className="italic opacity-50">—</span>}</p>
                    </TableCell>
                    <TableCell className="py-3">
                      {cfg && (
                        <div className="space-y-0.5">
                          <Badge variant="outline" className={cn("text-[11px] font-semibold", cfg.className)}>
                            {cfg.label}
                          </Badge>
                          {r.status === "earned" && r.earnedAt && (
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(r.earnedAt).toLocaleDateString()}
                              {r.earnedBy && ` · ${r.earnedBy.name ?? r.earnedBy.email.split("@")[0]}`}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell className="pr-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkEarned(r.id)}
                            disabled={actingId === r.id || isPending}
                            className="h-7 text-[11px] gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                          >
                            {actingId === r.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <BadgeCheck className="h-3 w-3" />
                            }
                            Mark Earned
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(r.id)}
                          disabled={actingId === r.id || isPending}
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
