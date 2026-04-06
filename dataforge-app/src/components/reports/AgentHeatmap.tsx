"use client";

import type { AgentReportRow } from "@/lib/reports/service";

type Column = {
  key: keyof AgentReportRow;
  label: string;
  format: (v: number) => string;
};

const COLUMNS: Column[] = [
  { key: "callsWeek",   label: "Calls/Wk",  format: (v) => v.toString() },
  { key: "callsMonth",  label: "Calls/Mo",  format: (v) => v.toString() },
  { key: "totalCalls",  label: "All-Time",  format: (v) => v.toString() },
  {
    key: "avgDuration",
    label: "Avg Dur",
    format: (v) =>
      v > 0
        ? `${Math.floor(v / 60)}m${v % 60 > 0 ? ` ${v % 60}s` : ""}`
        : "—",
  },
  { key: "connectRate", label: "Connect%",  format: (v) => `${v}%` },
  { key: "points",      label: "Points",    format: (v) => v.toLocaleString() },
  { key: "badges",      label: "Badges",    format: (v) => v.toString() },
];

function cellStyle(value: number, max: number) {
  if (max === 0 || value === 0)
    return { backgroundColor: "transparent" } as React.CSSProperties;
  const intensity = value / max; // 0 → 1
  const alpha = 0.08 + intensity * 0.72; // 0.08 → 0.80
  return {
    backgroundColor: `rgba(124, 58, 237, ${alpha})`,
    color: intensity > 0.52 ? "white" : undefined,
    fontWeight: 600,
  } as React.CSSProperties;
}

export function AgentHeatmap({ rows }: { rows: AgentReportRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        No sales agents found.
      </div>
    );
  }

  const maxes = Object.fromEntries(
    COLUMNS.map((col) => [
      col.key,
      Math.max(...rows.map((r) => Number(r[col.key]))),
    ])
  );

  // Sort rows by callsWeek desc
  const sorted = [...rows].sort((a, b) => b.callsWeek - a.callsWeek);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-border/60">
            <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">
              Agent
            </th>
            {COLUMNS.map((col) => (
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
              className={`border-b border-border/30 last:border-0 ${
                i % 2 === 1 ? "bg-muted/10" : ""
              }`}
            >
              <td className="py-2.5 px-4 font-medium text-sm whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-600 shrink-0">
                    {(row.name ?? "?")[0].toUpperCase()}
                  </div>
                  <span className="truncate max-w-[100px]">{row.name}</span>
                </div>
              </td>
              {COLUMNS.map((col) => {
                const val = Number(row[col.key]);
                return (
                  <td
                    key={String(col.key)}
                    className="py-2 px-2 text-center text-sm rounded-md transition-colors"
                    style={cellStyle(val, maxes[col.key])}
                  >
                    {col.format(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
