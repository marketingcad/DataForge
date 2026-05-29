"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";

const OPTIONS = [
  { label: "Today",      value: "today"    },
  { label: "This Week",  value: "week"     },
  { label: "This Month", value: "month"    },
  { label: "All Time",   value: "all_time" },
] as const;

export type Period = (typeof OPTIONS)[number]["value"] | "custom";

export function PeriodToggle({ period }: { period: Period }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const active       = (searchParams.get("period") ?? period) as Period;

  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const f = searchParams.get("from");
    const t = searchParams.get("to");
    if (f) return { from: new Date(f + "T00:00:00"), to: t ? new Date(t + "T00:00:00") : undefined };
    return undefined;
  });

  function href(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    params.delete("from");
    params.delete("to");
    return `${pathname}?${params.toString()}`;
  }

  function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function handleRangeSelect(r: DateRange | undefined) {
    setRange(r);
    if (r?.from && r?.to) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", "custom");
      params.set("from", toDateStr(r.from));
      params.set("to", toDateStr(r.to));
      router.push(`${pathname}?${params.toString()}`);
      setIsOpen(false);
    }
  }

  const customLabel = (() => {
    if (active !== "custom") return "Custom Range";
    const f = searchParams.get("from");
    const t = searchParams.get("to");
    if (f && t) {
      const fmt = (d: string) =>
        new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `${fmt(f)} – ${fmt(t)}`;
    }
    return "Custom Range";
  })();

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

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 rounded-md px-3 py-1 text-sm font-medium transition-all",
                active === "custom"
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground text-muted-foreground"
              )}
            />
          }
        >
          {customLabel}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" side="bottom">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
