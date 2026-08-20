"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week",  label: "7 Days" },
  { value: "month", label: "30 Days" },
] as const;

export function PeriodTabs({ active }: { active: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(period: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("period", period);
    router.push("?" + sp.toString());
  }

  return (
    <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => go(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            active === o.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
