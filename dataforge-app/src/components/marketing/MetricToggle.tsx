"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const METRICS = [
  { label: "Calls",          value: "calls"        },
  { label: "Lead Book",      value: "leads"        },
  { label: "Appts Set",      value: "appts_set"    },
  { label: "Deals Won",      value: "deals_won"    },
  { label: "Commissions",    value: "commissions"  },
  { label: "Avg Call Time",  value: "avg_call_time"},
  { label: "Badges",         value: "badges"       },
] as const;

export type Metric = (typeof METRICS)[number]["value"];

export const METRIC_LABELS: Record<Metric, string> = Object.fromEntries(
  METRICS.map((m) => [m.value, m.label])
) as Record<Metric, string>;

export function MetricToggle({ metric }: { metric: Metric }) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  function go(value: Metric) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap rounded-lg bg-muted/30 p-0.5 gap-0.5">
      {METRICS.map((m) => (
        <button
          key={m.value}
          onClick={() => go(m.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            metric === m.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
