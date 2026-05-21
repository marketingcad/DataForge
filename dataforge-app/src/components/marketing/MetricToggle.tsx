"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const METRICS = [
  { label: "Calls",        value: "calls"       },
  { label: "Appts Set",    value: "appts_set"   },
  { label: "Commissions",  value: "commissions" },
  { label: "Badges",       value: "badges"      },
] as const;

export type Metric = (typeof METRICS)[number]["value"];

export const METRIC_LABELS: Record<Metric, string> = Object.fromEntries(
  METRICS.map((m) => [m.value, m.label])
) as Record<Metric, string>;

export function MetricToggle({ metric }: { metric: Metric }) {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const activeMetric = (searchParams.get("metric") ?? metric) as Metric;

  function href(value: Metric) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", value);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap rounded-lg bg-muted/30 p-0.5 gap-0.5">
      {METRICS.map((m) => (
        <Link
          key={m.value}
          href={href(m.value)}
          prefetch={false}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeMetric === m.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.label}
        </Link>
              ))}
    </div>
  );
}
