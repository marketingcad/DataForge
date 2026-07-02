import { notFound } from "next/navigation";
import { getSharedReportAction } from "@/actions/reports.actions";
import { getTeamSummary } from "@/lib/marketing/team.service";
import { AgentHeatmap } from "@/components/reports/AgentHeatmap";

export const dynamic = "force-dynamic";

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getSharedReportAction(token);
  if (!result) notFound();

  const { rows } = result;
  const team = await getTeamSummary();

  const totalCallsWeek  = rows.reduce((s, r) => s + r.callsWeek, 0);
  const totalCallsMonth = rows.reduce((s, r) => s + r.callsMonth, 0);
  const totalApptsMonth = rows.reduce((s, r) => s + r.apptsMonth, 0);
  const avgConnect      = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.connectRate, 0) / rows.length)
    : 0;

  const kpis = [
    { label: "Active Agents",    value: team.agentCount.toString() },
    { label: "Appts This Month", value: totalApptsMonth.toString() },
    { label: "Calls (24h)",      value: team.callsToday.toString() },
    { label: "Calls This Week",  value: totalCallsWeek.toString() },
    { label: "Calls This Month", value: totalCallsMonth.toString() },
    { label: "Avg Connect Rate", value: `${avgConnect}%` },
    { label: "Total Agents",     value: rows.length.toString() },
  ];
  const accents = [
    "bg-violet-500", "bg-sky-500", "bg-indigo-500", "bg-teal-500",
    "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Agent performance matrix — darker cells indicate stronger relative performance.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            🔗 Shared read-only view
          </span>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {kpis.map((k, i) => (
            <div key={k.label} className="rounded-2xl bg-card shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className={`h-1 w-4 rounded-full ${accents[i]}`} />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                  {k.label}
                </p>
              </div>
              <p className="text-2xl font-black tabular-nums leading-none">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Agent Matrix Heatmap (read-only — no popups) */}
        <div className="rounded-2xl bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-wrap gap-3">
            <div>
              <p className="font-semibold text-sm">Agent Performance Matrix</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rows.length} agent{rows.length !== 1 ? "s" : ""} · sorted by leads assigned
              </p>
            </div>
          </div>
          <div className="p-5">
            <AgentHeatmap rows={rows} interactive={false} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pb-2">
          Connect rate = completed ÷ total calls · Avg duration excludes missed/voicemail calls
        </p>
      </div>
    </div>
  );
}
