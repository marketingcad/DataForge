"use client";

import { useState, useTransition } from "react";
import { confirmLeadCommissionAction } from "@/actions/lead-commissions.actions";

type Commission = {
  id: string;
  amount: number;
  status: string;
  note: string | null;
  createdAt: Date;
  paidAt: Date | null;
  confirmedAt: Date | null;
  lead: { id: string; businessName: string; city: string | null; category: string | null };
  rule: { name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-500/10 text-amber-600",
  paid:      "bg-sky-500/10 text-sky-600",
  confirmed: "bg-emerald-500/10 text-emerald-600",
};

const STATUS_ICON: Record<string, string> = {
  pending:   "⏳",
  paid:      "💳",
  confirmed: "✅",
};

export function MyLeadsClient({ commissions: initial }: { commissions: Commission[] }) {
  const [commissions, setCommissions] = useState(initial);
  const [actingId, setActingId]       = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  function handleConfirm(id: string) {
    setActingId(id);
    startTransition(async () => {
      try {
        await confirmLeadCommissionAction(id);
        setCommissions((prev) =>
          prev.map((c) => c.id === id ? { ...c, status: "confirmed", confirmedAt: new Date() } : c)
        );
      } finally { setActingId(null); }
    });
  }

  if (commissions.length === 0) {
    return (
      <div className="rounded-2xl bg-card shadow-sm p-14 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-bold text-sm">No leads assigned yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your manager will assign leads to you here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {commissions.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl bg-card shadow-sm border border-border/30 p-5"
        >
          <div className="flex items-start justify-between gap-4">
            {/* Lead info */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-bold text-base leading-tight">{c.lead.businessName}</p>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                {c.lead.category && <span>📁 {c.lead.category}</span>}
                {c.lead.city && <span>📍 {c.lead.city}</span>}
                {c.rule && <span>📋 {c.rule.name}</span>}
              </div>
              {c.note && (
                <p className="text-xs text-muted-foreground italic">{c.note}</p>
              )}
            </div>

            {/* Commission + status */}
            <div className="shrink-0 text-right space-y-1.5">
              <p className="text-2xl font-black text-amber-600 tabular-nums">
                ₱{c.amount.toLocaleString()}
              </p>
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[c.status]}`}>
                {STATUS_ICON[c.status]} {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span>Assigned {new Date(c.createdAt).toLocaleDateString()}</span>
              {c.paidAt && (
                <span className="text-sky-600 font-medium">
                  💳 Paid {new Date(c.paidAt).toLocaleDateString()}
                </span>
              )}
              {c.confirmedAt && (
                <span className="text-emerald-600 font-medium">
                  ✅ Confirmed {new Date(c.confirmedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Confirm button — only for "paid" status */}
            {c.status === "paid" && (
              <button
                onClick={() => handleConfirm(c.id)}
                disabled={actingId === c.id || isPending}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 transition-colors disabled:opacity-50"
              >
                {actingId === c.id ? "Confirming…" : "Confirm Receipt ✓"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
