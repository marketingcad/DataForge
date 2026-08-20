"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTabs } from "@/contexts/TabsContext";
import { cn } from "@/lib/utils";

export function TabBar() {
  const { tabs, activeId, switchTab, closeTab, mounted } = useTabs();
  const [closing, setClosing] = useState<string[]>([]);

  // Only surface the tab strip once there's more than one tab — a lone tab just
  // acts like the normal page (its breadcrumb still shows in the header).
  if (!mounted || tabs.length <= 1) return null;

  function handleClose(id: string) {
    // Play the collapse/fade-out, then actually remove the tab.
    setClosing((c) => [...c, id]);
    setTimeout(() => {
      closeTab(id);
      setClosing((c) => c.filter((x) => x !== id));
    }, 160);
  }

  return (
    <div className="flex items-end gap-1 overflow-x-auto border-b border-border bg-muted/20 px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const isClosing = closing.includes(tab.id);
        return (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); handleClose(tab.id); } }}
            title={tab.title}
            className={cn(
              // Folder-tab: rounded top, sits on the baseline; the active one is
              // pulled forward (bg matches content, -mb-px covers the shelf line).
              "group relative flex min-w-0 max-w-48 cursor-pointer select-none items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs transition-all duration-200 ease-out",
              active
                ? "-mb-px border-border bg-background font-medium text-foreground shadow-[0_-1px_2px_rgba(0,0,0,0.04)]"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              isClosing
                ? "max-w-0 translate-y-1 overflow-hidden px-0 opacity-0"
                : "animate-scale-in",
            )}
          >
            <span className="truncate">{tab.title}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClose(tab.id); }}
              title="Close tab"
              className="shrink-0 rounded p-0.5 opacity-50 transition-all hover:bg-muted hover:opacity-100 active:scale-90"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
