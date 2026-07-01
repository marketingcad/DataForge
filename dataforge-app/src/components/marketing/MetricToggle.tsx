"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Phone, Users, CalendarCheck, DollarSign, Award } from "lucide-react";
import { cn } from "@/lib/utils";

const METRICS = [
  { label: "Calls",       value: "calls",       icon: Phone          },
  { label: "Leads",       value: "leads",       icon: Users          },
  { label: "Appts Set",   value: "appts_set",   icon: CalendarCheck  },
  { label: "Commissions", value: "commissions", icon: DollarSign     },
  { label: "Badges",      value: "badges",      icon: Award          },
] as const;

export type Metric = (typeof METRICS)[number]["value"];

export const METRIC_LABELS: Record<Metric, string> = Object.fromEntries(
  METRICS.map((m) => [m.value, m.label])
) as Record<Metric, string>;

export function MetricToggle({ metric }: { metric: Metric }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const active       = (searchParams.get("metric") ?? metric) as Metric;

  function href(value: Metric) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", value);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground gap-0.5">
      {METRICS.map(({ label, value, icon: Icon }) => (
        <Link
          key={value}
          href={href(value)}
          prefetch={false}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
            active === value
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
    </div>
  );
}
