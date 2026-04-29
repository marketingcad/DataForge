import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllCommissionRules } from "@/lib/marketing/commissions.service";
import { getLedger } from "@/lib/marketing/lead-commissions.service";
import { getAllRepCommissions } from "@/lib/marketing/rep-commissions.service";
import { getSettings } from "@/lib/settings/service";
import { CommissionsManager } from "./CommissionsManager";
import { LedgerPanel } from "./LedgerPanel";
import { RepCommissionsPanel } from "./RepCommissionsPanel";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function ManageCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "boss" && role !== "admin") redirect("/unauthorized");

  const { tab } = await searchParams;
  const activeTab = tab === "ledger" ? "ledger" : tab === "rep" ? "rep" : "rules";

  const [rules, ledger, repRecords, settings, salesReps] = await Promise.all([
    getAllCommissionRules(),
    getLedger(),
    getAllRepCommissions(),
    getSettings(),
    prisma.user.findMany({
      where: { role: "sales_rep" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const currency = settings.commissionCurrency ?? "₱";

  // Page-level summary
  const totalPending = repRecords.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const totalEarned  = repRecords.filter((r) => r.status === "earned").reduce((s, r) => s + r.amount, 0);

  const TABS = [
    { key: "rules",  label: "Commission Rules",           count: rules.length },
    { key: "rep",    label: "Rep Commissions",            count: repRecords.length },
    { key: "ledger", label: "Lead Ledger",                count: ledger.length },
  ];

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
            <h1 className="text-xl font-black tracking-tight">Commissions</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage commission rules and payouts for your sales team.
          </p>
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

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 border-b border-border/50">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/marketing/manage/commissions?tab=${t.key}`}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap",
              activeTab === t.key
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
            )}
          >
            {t.label}
            <span className={cn(
              "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none min-w-[18px]",
              activeTab === t.key
                ? "bg-amber-500/15 text-amber-600"
                : "bg-muted text-muted-foreground"
            )}>
              {t.count}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Panel content ── */}
      {activeTab === "rules" && (
        <CommissionsManager rules={rules} currency={currency} />
      )}
      {activeTab === "rep" && (
        <RepCommissionsPanel
          records={repRecords}
          reps={salesReps}
          rules={rules.map((r) => ({ id: r.id, name: r.name, amount: r.amount }))}
          currency={currency}
        />
      )}
      {activeTab === "ledger" && (
        <LedgerPanel entries={ledger} currency={currency} />
      )}
    </div>
  );
}
