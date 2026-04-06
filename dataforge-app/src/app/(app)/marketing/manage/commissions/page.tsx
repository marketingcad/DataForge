import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllCommissionRules } from "@/lib/marketing/commissions.service";
import { getLedger } from "@/lib/marketing/lead-commissions.service";
import { CommissionsManager } from "./CommissionsManager";
import { LedgerPanel } from "./LedgerPanel";
import Link from "next/link";

export default async function ManageCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "boss" && role !== "admin") redirect("/unauthorized");

  const { tab } = await searchParams;
  const activeTab = tab === "ledger" ? "ledger" : "rules";

  const [rules, ledger] = await Promise.all([
    getAllCommissionRules(),
    getLedger(),
  ]);

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/50 pb-0">
        {[
          { key: "rules",  label: "Commission Rules" },
          { key: "ledger", label: `Ledger (${ledger.length})` },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/marketing/manage/commissions?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "rules" ? (
        <CommissionsManager rules={rules} />
      ) : (
        <LedgerPanel entries={ledger} />
      )}
    </div>
  );
}
