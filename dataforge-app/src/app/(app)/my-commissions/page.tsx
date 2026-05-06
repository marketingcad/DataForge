import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyRepCommissions } from "@/lib/marketing/rep-commissions.service";
import { getSettings } from "@/lib/settings/service";
import { DollarSign, Clock, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function MyCommissionsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "sales_rep" && role !== "team_lead") redirect("/unauthorized");

  const userId = session!.user!.id!;
  const [records, settings] = await Promise.all([
    getMyRepCommissions(userId),
    getSettings(),
  ]);

  const currency = settings.commissionCurrency ?? "₱";

  const totalEarned  = records.filter((r) => r.status === "earned").reduce((s, r) => s + r.amount, 0);
  const totalPending = records.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
            <h1 className="text-xl font-black tracking-tight">My Commissions</h1>
          </div>
          <p className="text-sm text-muted-foreground">Your commission history and earnings.</p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
              {currency}{totalPending.toLocaleString()} pending
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {currency}{totalEarned.toLocaleString()} earned
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {records.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-3xl">💸</p>
            <p className="text-sm font-semibold">No commissions yet.</p>
            <p className="text-xs text-muted-foreground">Keep closing deals — your earnings will show up here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Rule</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Note</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                <th className="text-center px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 font-medium">{r.rule?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.note ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-black tabular-nums">
                    {currency}{r.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                      r.status === "earned"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    )}>
                      {r.status === "earned"
                        ? <CheckCircle2 className="h-3 w-3" />
                        : <Circle className="h-3 w-3" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground tabular-nums text-xs">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
