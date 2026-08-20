"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  markLeadCommissionPaidAction,
  removeLeadCommissionAction,
} from "@/actions/lead-commissions.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Clock,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Loader2,
  Trash2,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LedgerRow = {
  id: string;
  amount: number;
  status: string;
  note: string | null;
  createdAt: Date;
  paidAt: Date | null;
  confirmedAt: Date | null;
  lead:   { id: string; businessName: string; city: string | null; category: string | null };
  agent:  { id: string; name: string | null; email: string };
  rule:   { id: string; name: string } | null;
  paidBy: { id: string; name: string | null; email: string } | null;
};

const STATUS_CFG: Record<string, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  pending:   { label: "Pending",   icon: Clock,        className: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" },
  paid:      { label: "Paid",      icon: CreditCard,   className: "border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" },
};

function AgentAvatar({ name, email }: { name: string | null; email: string }) {
  const initials = ((name ?? email)[0] ?? "?").toUpperCase();
  return (
    <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-[11px] font-bold text-blue-600 shrink-0">
      {initials}
    </div>
  );
}

export function LedgerPanel({ entries: initial, currency }: { entries: LedgerRow[]; currency: string }) {
  const [entries, setEntries]           = useState(initial);
  const [filterAgent, setFilterAgent]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isPending, startTransition]    = useTransition();
  const [actingId, setActingId]         = useState<string | null>(null);

  const agents = Array.from(new Map(initial.map((e) => [e.agent.id, e.agent])).values());

  const filtered = entries.filter((e) => {
    if (filterAgent  !== "all" && e.agent.id !== filterAgent)  return false;
    if (filterStatus !== "all" && e.status   !== filterStatus) return false;
    return true;
  });

  const totalPending   = entries.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const totalPaid      = entries.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalConfirmed = entries.filter((e) => e.status === "confirmed").reduce((s, e) => s + e.amount, 0);

  function handleMarkPaid(id: string) {
    setActingId(id);
    startTransition(async () => {
      try {
        await markLeadCommissionPaidAction(id);
        setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status: "paid", paidAt: new Date() } : e));
      } finally { setActingId(null); }
    });
  }

  function handleRemove(id: string) {
    if (!confirm("Remove this commission assignment?")) return;
    setActingId(id);
    startTransition(async () => {
      try {
        await removeLeadCommissionAction(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } finally { setActingId(null); }
    });
  }

  return (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Clock,        label: "Pending",   value: totalPending,   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30",    ring: "ring-amber-100 dark:ring-amber-900" },
          { icon: CreditCard,   label: "Paid",      value: totalPaid,      color: "text-sky-600",     bg: "bg-sky-50 dark:bg-sky-950/30",        ring: "ring-sky-100 dark:ring-sky-900" },
          { icon: CheckCircle2, label: "Confirmed", value: totalConfirmed, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", ring: "ring-emerald-100 dark:ring-emerald-900" },
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
        <Select value={filterAgent} onValueChange={(v) => v != null && setFilterAgent(v)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reps</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name ?? a.email}</SelectItem>
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
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto self-center">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-semibold">No ledger entries</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {entries.length > 0 ? "No entries match the current filters." : (
                <>Assign commissions to leads from the{" "}
                  <Link href="/leads" className="underline text-primary font-medium">Leads</Link> section.
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="pl-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead / Client</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rule</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</TableHead>
                <TableHead className="pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const cfg = STATUS_CFG[e.status];
                const StatusIcon = cfg?.icon ?? Clock;
                return (
                  <TableRow key={e.id} className="border-b border-border/30">
                    <TableCell className="pl-4 py-3">
                      <Link
                        href={`/leads/${e.lead.id}`}
                        className="group flex items-center gap-1 font-semibold text-sm hover:text-primary transition-colors"
                      >
                        {e.lead.businessName}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </Link>
                      {(e.lead.city || e.lead.category) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {[e.lead.category, e.lead.city].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {e.note && (
                        <p className="text-[11px] text-muted-foreground italic mt-0.5">{e.note}</p>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <AgentAvatar name={e.agent.name} email={e.agent.email} />
                        <span className="text-sm font-medium">{e.agent.name ?? e.agent.email.split("@")[0]}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {e.rule
                        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">{e.rule.name}</span>
                        : <span className="text-xs text-muted-foreground italic">Manual</span>
                      }
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-base font-black text-amber-600 tabular-nums">{currency}{e.amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        {cfg && (
                          <Badge variant="outline" className={cn("text-[11px] font-semibold gap-1", cfg.className)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {cfg.label}
                          </Badge>
                        )}
                        {e.status === "confirmed" && e.confirmedAt && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(e.confirmedAt).toLocaleDateString()}
                          </p>
                        )}
                        {e.status === "paid" && e.paidAt && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(e.paidAt).toLocaleDateString()}
                            {e.paidBy && ` · ${e.paidBy.name ?? e.paidBy.email.split("@")[0]}`}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell className="pr-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {e.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(e.id)}
                            disabled={actingId === e.id || isPending}
                            className="h-7 text-[11px] gap-1 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800"
                          >
                            {actingId === e.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <BadgeCheck className="h-3 w-3" />
                            }
                            Mark Paid
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemove(e.id)}
                          disabled={actingId === e.id || isPending}
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
