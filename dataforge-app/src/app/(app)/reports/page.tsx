import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getAgentReportMatrix } from "@/lib/reports/service";
import { getTeamSummary } from "@/lib/marketing/team.service";
import { AgentHeatmap } from "@/components/reports/AgentHeatmap";
import Link from "next/link";

export default async function ReportsPage() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (role !== "boss" && role !== "admin") redirect("/dashboard");

  const [rows, team] = await withDbRetry(() =>
    Promise.all([getAgentReportMatrix(), getTeamSummary()])
  );

  /* Derive summary stats */
  const totalCallsWeek  = rows.reduce((s, r) => s + r.callsWeek, 0);
  const totalCallsMonth = rows.reduce((s, r) => s + r.callsMonth, 0);
  const avgConnect      = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.connectRate, 0) / rows.length)
    : 0;

  const kpis = [
    { label: "Active Agents",     value: team.agentCount.toString() },
    { label: "Calls Today",       value: team.callsToday.toString() },
    { label: "Calls This Week",   value: totalCallsWeek.toString() },
    { label: "Calls This Month",  value: totalCallsMonth.toString() },
    { label: "Avg Connect Rate",  value: `${avgConnect}%` },
    { label: "Total Agents",      value: rows.length.toString() },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agent performance matrix — darker cells indicate stronger relative performance.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k, i) => {
          const accents = [
            "bg-violet-500",
            "bg-sky-500",
            "bg-indigo-500",
            "bg-teal-500",
            "bg-emerald-500",
            "bg-amber-500",
          ];
          return (
            <div key={k.label} className="rounded-2xl bg-card shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className={`h-1 w-4 rounded-full ${accents[i]}`} />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                  {k.label}
                </p>
              </div>
              <p className="text-2xl font-black tabular-nums leading-none">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Agent Matrix Heatmap */}
      <div className="rounded-2xl bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm">Agent Performance Matrix</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rows.length} agent{rows.length !== 1 ? "s" : ""} · sorted by calls this week
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: "rgba(124,58,237,0.08)" }}
              />
              Low
            </div>
            <div className="h-4 border-r border-border/40" />
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: "rgba(124,58,237,0.80)" }}
              />
              High
            </div>
          </div>
        </div>
        <div className="p-5">
          <AgentHeatmap rows={rows} />
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        Connect rate = completed ÷ total calls · Avg duration excludes missed/voicemail calls
      </p>
    </div>
  );
}
