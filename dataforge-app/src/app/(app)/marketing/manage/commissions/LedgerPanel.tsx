"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  markLeadCommissionPaidAction,
  removeLeadCommissionAction,
} from "@/actions/lead-commissions.actions";

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

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-500/10 text-amber-600",
  paid:      "bg-sky-500/10 text-sky-600",
  confirmed: "bg-emerald-500/10 text-emerald-600",
};

export function LedgerPanel({ entries: initial }: { entries: LedgerRow[] }) {
  const [entries, setEntries] = useState(initial);
  const [filterAgent, setFilterAgent]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [pending, startTransition]      = useTransition();
  const [actingId, setActingId]         = useState<string | null>(null);

  const agents = Array.from(
    new Map(initial.map((e) => [e.agent.id, e.agent])).values()
  );

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
        setEntries((prev) =>
          prev.map((e) => e.id === id ? { ...e, status: "paid", paidAt: new Date() } : e)
        );
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
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending",   value: totalPending,   style: "text-amber-600",   bg: "bg-amber-500/10" },
          { label: "Paid",      value: totalPaid,      style: "text-sky-600",     bg: "bg-sky-500/10" },
          { label: "Confirmed", value: totalConfirmed, style: "text-emerald-600", bg: "bg-emerald-500/10" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl ${s.bg} px-5 py-4 text-center`}>
            <p className={`text-2xl font-black tabular-nums ${s.style}`}>₱{s.value.toLocaleString()}</p>
            <p className="text-xs font-semibold text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          <option value="all">All Reps</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name ?? a.email}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="confirmed">Confirmed</option>
        </select>
        <span className="text-xs text-muted-foreground self-center ml-auto">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-sm p-12 text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm font-bold">No commissions here yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Assign leads to reps from the{" "}
            <Link href="/leads" className="underline text-primary">Leads</Link> section.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60">
                <tr>
                  {["Lead / Client", "Rep", "Rule", "Amount", "Status", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${e.lead.id}`} className="font-semibold hover:underline text-primary">
                        {e.lead.businessName}
                      </Link>
                      {(e.lead.city || e.lead.category) && (
                        <p className="text-[11px] text-muted-foreground">
                          {[e.lead.category, e.lead.city].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {e.note && <p className="text-[11px] text-muted-foreground italic mt-0.5">{e.note}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium">{e.agent.name ?? e.agent.email}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {e.rule?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-black text-amber-600">₱{e.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[e.status]}`}>
                        {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                      </span>
                      {e.status === "confirmed" && e.confirmedAt && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Confirmed {new Date(e.confirmedAt).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                      {e.paidAt && (
                        <p className="text-[10px]">
                          Paid {new Date(e.paidAt).toLocaleDateString()}
                          {e.paidBy && ` by ${e.paidBy.name ?? e.paidBy.email}`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        {e.status === "pending" && (
                          <button
                            onClick={() => handleMarkPaid(e.id)}
                            disabled={actingId === e.id || pending}
                            className="rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold px-3 py-1.5 transition-colors disabled:opacity-50"
                          >
                            {actingId === e.id ? "…" : "Mark Paid"}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(e.id)}
                          disabled={actingId === e.id || pending}
                          className="rounded-lg bg-muted/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 text-[11px] font-bold px-2.5 py-1.5 transition-colors disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
