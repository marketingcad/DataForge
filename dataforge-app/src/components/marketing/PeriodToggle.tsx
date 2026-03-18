"use client";

import { useRouter, usePathname } from "next/navigation";

const OPTIONS = [
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "week"      },
  { label: "This Month", value: "month"    },
] as const;

export type Period = (typeof OPTIONS)[number]["value"];

export function PeriodToggle({ period }: { period: Period }) {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => router.push(`${pathname}?period=${o.value}`)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            period === o.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
