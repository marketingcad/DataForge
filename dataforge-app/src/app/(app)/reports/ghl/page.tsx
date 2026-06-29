import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { withDbRetry } from "@/lib/prisma";
import {
  getGhlApptMonthly,
  getGhlApptTotal,
  getGhlMonthDetail,
} from "@/lib/reports/ghl-appointments.service";
import { GhlApptMonthlyChart } from "@/components/reports/GhlApptMonthlyChart";
import { MonthSelect } from "@/components/reports/MonthSelect";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function GhlReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (role !== "boss" && role !== "admin") redirect("/dashboard");

  const { month } = await searchParams;

  const [monthly, allTimeTotal] = await withDbRetry(() =>
    Promise.all([getGhlApptMonthly(12), getGhlApptTotal()]),
  );

  // Default to the most recent month if none (or an unknown one) was requested.
  const selectedKey =
    month && monthly.some((m) => m.key === month)
      ? month
      : monthly[monthly.length - 1]?.key;

  const detail = await withDbRetry(() => getGhlMonthDetail(selectedKey));

  const thisMonth = monthly[monthly.length - 1]?.count ?? 0;
  const lastMonth = monthly[monthly.length - 2]?.count ?? 0;
  const last12 = monthly.reduce((s, m) => s + m.count, 0);
  const delta = thisMonth - lastMonth;

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  const kpis = [
    { label: "Set This Month", value: thisMonth.toString(), accent: "bg-sky-500" },
    {
      label: "Set Last Month",
      value: lastMonth.toString(),
      accent: "bg-indigo-500",
      sub:
        delta === 0
          ? "no change"
          : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)} vs last month`,
      subColor: delta >= 0 ? "text-emerald-600" : "text-rose-600",
    },
    { label: "Last 12 Months", value: last12.toString(), accent: "bg-violet-500" },
    { label: "All Time (GHL)", value: allTimeTotal.toString(), accent: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">GHL Monthly Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Appointments set from GoHighLevel, by month. Sourced from the GHL booking webhook.
          </p>
        </div>
        <Link
          href="/reports"
          className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          ← Reports
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-card shadow-sm p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className={`h-1 w-4 rounded-full ${k.accent}`} />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                {k.label}
              </p>
            </div>
            <p className="text-2xl font-black tabular-nums leading-none">{k.value}</p>
            {k.sub && (
              <p className={`text-[11px] font-semibold ${k.subColor ?? "text-muted-foreground"}`}>
                {k.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Monthly trend */}
      <div className="rounded-2xl bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm">Appointments Set — Last 12 Months</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each bar is the number of GHL appointments booked that month
            </p>
          </div>
        </div>
        <div className="p-5">
          <GhlApptMonthlyChart data={monthly} selectedKey={selectedKey} />
        </div>
      </div>

      {/* Selected-month detail */}
      <div className="rounded-2xl bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm">{detail.label} — Breakdown</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detail.total} appointment{detail.total !== 1 ? "s" : ""} set · {detail.reps.length} rep
              {detail.reps.length !== 1 ? "s" : ""}
            </p>
          </div>
          <MonthSelect months={monthly} selectedKey={selectedKey} />
        </div>

        {detail.total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <p className="text-4xl">📅</p>
            <p className="text-sm">No GHL appointments set in {detail.label}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-border/60">
            {/* Per-rep summary */}
            <div className="p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                By Sales Rep
              </p>
              <ul className="space-y-1.5">
                {detail.reps.map((r) => {
                  const pct = detail.total ? Math.round((r.count / detail.total) * 100) : 0;
                  return (
                    <li key={r.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{r.name}</span>
                        <span className="tabular-nums font-semibold">{r.count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Appointment list */}
            <div className="lg:col-span-2 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-card">Client</TableHead>
                    <TableHead className="sticky top-0 bg-card">Phone</TableHead>
                    <TableHead className="sticky top-0 bg-card">Sales Rep</TableHead>
                    <TableHead className="sticky top-0 bg-card whitespace-nowrap">Set On</TableHead>
                    <TableHead className="sticky top-0 bg-card whitespace-nowrap">Appointment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.appointments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.clientName}</TableCell>
                      <TableCell className="text-muted-foreground">{a.clientPhone ?? "—"}</TableCell>
                      <TableCell className="font-medium">{a.repName}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        {fmtDate(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        {fmtDate(a.bookedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Leads — pending webhook */}
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-5 py-4">
        <p className="text-sm font-semibold">Leads generated from GHL — coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          A monthly count of leads generated from GHL will appear here once a GHL
          <span className="font-medium"> lead webhook</span> is connected. Today only the appointment
          booking webhook feeds DataForge, so lead totals aren&apos;t available yet.
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2">
        &ldquo;Set on&rdquo; is when the appointment was booked (webhook received) · &ldquo;Appointment&rdquo; is the scheduled meeting time · Months are in Philippine time (UTC+8)
      </p>
    </div>
  );
}
