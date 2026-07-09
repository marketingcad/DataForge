import { notFound } from "next/navigation";
import { Database } from "lucide-react";
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
  const monthLabel = new Date().toLocaleString("en-US", { month: "long", timeZone: "Asia/Manila" });

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
      {/* ── DataForge brand bar ── */}
      <header className="border-b border-border/60">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shrink-0">
            <Database className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-2xl tracking-tight">DataForge</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
            🔗 Shared read-only view
          </span>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto p-4 sm:p-8 space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-base text-muted-foreground mt-1">
            Agent performance matrix — darker cells indicate stronger relative performance.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {kpis.map((k, i) => (
            <div key={k.label} className="rounded-2xl bg-card shadow-sm p-5 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <div className={`h-1 w-5 rounded-full ${accents[i]}`} />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                  {k.label}
                </p>
              </div>
              <p className="text-3xl font-black tabular-nums leading-none">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Leads (read-only) */}
        <div className="rounded-2xl bg-card shadow-sm">
          <div className="px-6 py-5 border-b border-border/60">
            <p className="font-semibold text-lg">Leads</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {rows.length} agent{rows.length !== 1 ? "s" : ""} · sorted by leads assigned
            </p>
          </div>
          <div className="p-6 [&_table]:min-w-[720px] [&_th]:!text-[13px] [&_td]:!text-[15px] [&_td]:!py-3.5">
            <AgentHeatmap rows={rows} variant="leads" interactive={false} />
          </div>
        </div>

        {/* Appointment performance (read-only) */}
        <div className="rounded-2xl bg-card shadow-sm">
          <div className="px-6 py-5 border-b border-border/60">
            <p className="font-semibold text-lg">Appointment Performance</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {rows.length} agent{rows.length !== 1 ? "s" : ""} · sorted by {monthLabel}
            </p>
          </div>
          <div className="p-6 [&_table]:min-w-[720px] [&_th]:!text-[13px] [&_td]:!text-[15px] [&_td]:!py-3.5">
            <AgentHeatmap rows={rows} variant="appts" monthLabel={monthLabel} interactive={false} />
          </div>
        </div>

        {/* Call performance (read-only) */}
        <div className="rounded-2xl bg-card shadow-sm">
          <div className="px-6 py-5 border-b border-border/60">
            <p className="font-semibold text-lg">Call Performance</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {rows.length} agent{rows.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-6 [&_table]:min-w-[720px] [&_th]:!text-[13px] [&_td]:!text-[15px] [&_td]:!py-3.5">
            <AgentHeatmap rows={rows} variant="calls" interactive={false} />
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center pb-6">
          Connect rate = completed ÷ total calls · Avg duration excludes missed/voicemail calls
        </p>
      </div>
    </div>
  );
}
