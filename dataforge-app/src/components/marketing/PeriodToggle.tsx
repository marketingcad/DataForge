"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { label: "Yesterday",  value: "yesterday" },
  { label: "This Week",  value: "week"      },
  { label: "This Month", value: "month"     },
  { label: "All Time",   value: "all_time"  },
] as const;

export type Period = (typeof OPTIONS)[number]["value"];

export function PeriodToggle({ period }: { period: Period }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const active       = (searchParams.get("period") ?? period) as Period;

  function href(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground gap-0.5">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={href(o.value)}
          prefetch={false}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
            active === o.value
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground"
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
