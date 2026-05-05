"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const OPTIONS = [
  { label: "Yesterday",  value: "yesterday" },
  { label: "This Week",  value: "week"      },
  { label: "This Month", value: "month"     },
  { label: "All Time",   value: "all_time"  },
] as const;

export type Period = (typeof OPTIONS)[number]["value"];

export function PeriodToggle({ period }: { period: Period }) {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const activePeriod = (searchParams.get("period") ?? period) as Period;

  function href(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex rounded-lg bg-muted/30 p-0.5 gap-0.5">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={href(o.value)}
          prefetch={false}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            activePeriod === o.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
