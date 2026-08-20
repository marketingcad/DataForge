"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTabs } from "@/contexts/TabsContext";
import { cn } from "@/lib/utils";

/**
 * Hierarchy breadcrumb for the current page: one crumb per level of the route,
 * e.g. Dashboard › Scraping › Auto Keywords. Click any crumb to go up to it;
 * the back arrow (or Backspace) steps up one level.
 *
 * The trail comes from the URL, so it's always the same few levels deep — it
 * doesn't record where the user has been.
 */
export function Breadcrumb() {
  const { activeTab, trail, goToCrumb, back, mounted } = useTabs();

  if (!mounted || !activeTab) return <div className="flex-1" />;

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 text-xs">
      <button
        type="button"
        onClick={back}
        disabled={trail.length < 2}
        title="Up one level (Backspace)"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <ol className="flex min-w-0 items-center gap-1 overflow-hidden">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li
              key={`${c.path}-${i}`}
              className="flex min-w-0 items-center gap-1"
            >
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
              <button
                type="button"
                onClick={() => goToCrumb(i)}
                disabled={last}
                className={cn(
                  "truncate rounded px-1.5 py-0.5 transition-colors",
                  last
                    ? "pointer-events-none font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
