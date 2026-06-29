"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  months: { key: string; label: string }[];
  selectedKey: string;
}

/** Month picker that drives the report's `?month=` query param. */
export function MonthSelect({ months, selectedKey }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor="report-month" className="text-xs font-medium text-muted-foreground">
        Month
      </label>
      <div className="relative">
        <select
          id="report-month"
          value={selectedKey}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.value;
            startTransition(() => {
              router.push(`${pathname}?month=${value}`);
            });
          }}
          className="appearance-none rounded-lg border border-border/60 bg-background py-1.5 pl-3 pr-8 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {[...months].reverse().map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        {pending && (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
