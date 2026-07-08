"use client";

import { useState } from "react";
import type { AgentReportRow } from "@/lib/reports/service";
import { AppointmentsModal } from "@/components/marketing/AppointmentsModal";
import { AgentLeadsModal } from "@/components/reports/AgentLeadsModal";

type ClickKind = "leads" | "appts-today" | "appts-month" | "appts-all";

type Column = {
  key: keyof AgentReportRow;
  label: string;
  format: (v: number) => string;
  click?: ClickKind;
};

const durationFormat = (v: number) =>
  v > 0 ? `${Math.floor(v / 60)}m${v % 60 > 0 ? ` ${v % 60}s` : ""}` : "—";

// Appointment-performance columns. The apptsMonth label is replaced with the
// live month name (e.g. "July") passed via `monthLabel`.
const APPT_COLUMNS: Column[] = [
  { key: "leadsCount", label: "Leads",    format: (v) => v.toString(), click: "leads" },
  { key: "apptsToday", label: "Today",    format: (v) => v.toString(), click: "appts-today" },
  { key: "apptsMonth", label: "Appts/Mo", format: (v) => v.toString(), click: "appts-month" },
  { key: "apptsTotal", label: "All-Time", format: (v) => v.toString(), click: "appts-all" },
  { key: "points",     label: "Points",   format: (v) => v.toLocaleString() },
  { key: "badges",     label: "Badges",   format: (v) => v.toString() },
];

// Call-performance columns.
const CALL_COLUMNS: Column[] = [
  { key: "callsToday",  label: "Today",    format: (v) => v.toString() },
  { key: "callsWeek",   label: "Calls/Wk", format: (v) => v.toString() },
  { key: "callsMonth",  label: "Calls/Mo", format: (v) => v.toString() },
  { key: "totalCalls",  label: "All-Time", format: (v) => v.toString() },
  { key: "avgDuration", label: "Avg Dur",  format: durationFormat },
  { key: "connectRate", label: "Connect%", format: (v) => `${v}%` },
];

function cellStyle(value: number, max: number) {
  if (max === 0 || value === 0)
    return { backgroundColor: "transparent" } as React.CSSProperties;
  const intensity = value / max;
  const alpha = (0.08 + intensity * 0.72).toFixed(2);
  return {
    backgroundColor: `oklch(var(--heatmap-accent) / ${alpha})`,
    color: intensity > 0.52 ? "white" : undefined,
    fontWeight: 600,
  } as React.CSSProperties;
}

export function AgentHeatmap({
  rows,
  variant,
  monthLabel,
  canDelete = false,
  interactive = true,
}: {
  rows: AgentReportRow[];
  /** Which table to render: appointment metrics or call metrics. */
  variant: "appts" | "calls";
  /** Live month name (e.g. "July") for the "Appts this month" column header. */
  monthLabel?: string;
  canDelete?: boolean;
  /** When false (public shared view), cells aren't clickable. */
  interactive?: boolean;
}) {
  const [appt, setAppt] = useState<{ id: string; name: string; scope: "all" | "month" | "today" } | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<{ id: string; name: string } | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No sales agents found.
      </div>
    );
  }

  const columns = (variant === "appts" ? APPT_COLUMNS : CALL_COLUMNS).map((c) =>
    c.key === "apptsMonth" && monthLabel ? { ...c, label: monthLabel } : c
  );

  const maxes = Object.fromEntries(
    columns.map((col) => [col.key, Math.max(...rows.map((r) => Number(r[col.key])))])
  );

  // Sort by the table's headline metric (this-month appts / this-month calls).
  const primary: keyof AgentReportRow = variant === "appts" ? "apptsMonth" : "callsMonth";
  const sorted = [...rows].sort((a, b) => Number(b[primary]) - Number(a[primary]));

  function handleClick(row: { id: string; name: string }, click: ClickKind) {
    if (click === "leads") { setSelectedLeads({ id: row.id, name: row.name }); return; }
    const scope = click === "appts-today" ? "today" : click === "appts-month" ? "month" : "all";
    setAppt({ id: row.id, name: row.name, scope });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-border/60">
            <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">
              Agent
            </th>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="py-3 px-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id}
              className={`border-b border-border/30 last:border-0 ${i % 2 === 1 ? "bg-muted/10" : ""}`}
            >
              <td className="py-2.5 px-4 font-medium text-sm whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-600 shrink-0">
                    {(row.name ?? "?")[0].toUpperCase()}
                  </div>
                  <span className="truncate max-w-[100px]">{row.name}</span>
                </div>
              </td>
              {columns.map((col) => {
                const val = Number(row[col.key]);
                const clickable = interactive && !!col.click && val > 0;
                return (
                  <td
                    key={String(col.key)}
                    className="py-2 px-2 text-center text-sm rounded-md transition-colors"
                    style={cellStyle(val, maxes[col.key])}
                  >
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => handleClick(row, col.click!)}
                        title={col.click === "leads" ? `View ${row.name}'s leads` : `View ${row.name}'s appointments`}
                        className="w-full cursor-pointer underline decoration-dotted underline-offset-4 hover:decoration-solid focus:outline-none"
                      >
                        {col.format(val)}
                      </button>
                    ) : (
                      col.format(val)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {appt && (
        <AppointmentsModal
          agentId={appt.id}
          agentName={appt.name}
          scope={appt.scope}
          canDelete={canDelete}
          open={!!appt}
          onOpenChange={(o) => { if (!o) setAppt(null); }}
        />
      )}

      {selectedLeads && (
        <AgentLeadsModal
          agentId={selectedLeads.id}
          agentName={selectedLeads.name}
          canDelete={canDelete}
          open={!!selectedLeads}
          onOpenChange={(o) => { if (!o) setSelectedLeads(null); }}
        />
      )}
    </div>
  );
}
