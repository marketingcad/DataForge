import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getMyCommissions } from "@/lib/marketing/lead-commissions.service";
import { MyLeadsClient } from "./MyLeadsClient";

export default async function MyLeadsPage() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (role !== "sales_rep") redirect("/dashboard");

  const userId = session!.user.id!;
  const commissions = await withDbRetry(() => getMyCommissions(userId));

  const totalPending   = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const totalPaid      = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0);
  const totalConfirmed = commissions.filter((c) => c.status === "confirmed").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">My Leads &amp; Commissions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Leads assigned to you and your commission status.
        </p>
      </div>

      {/* Ledger summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending",    value: totalPending,   style: "text-amber-600",   bg: "bg-amber-500/10" },
          { label: "Paid",       value: totalPaid,      style: "text-sky-600",     bg: "bg-sky-500/10" },
          { label: "Confirmed",  value: totalConfirmed, style: "text-emerald-600", bg: "bg-emerald-500/10" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl ${s.bg} px-5 py-4 text-center`}>
            <p className={`text-2xl font-black tabular-nums ${s.style}`}>₱{s.value.toLocaleString()}</p>
            <p className="text-xs font-semibold text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <MyLeadsClient commissions={commissions} />
    </div>
  );
}
