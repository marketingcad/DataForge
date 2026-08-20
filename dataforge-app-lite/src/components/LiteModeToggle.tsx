"use client";

import { useEffect, useState } from "react";
import { Feather } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LITE_KEY = "df-lite-mode";

/**
 * Toggles "Lite Mode" — sets `data-lite` on <html>, which the stylesheet uses to
 * strip animations/transitions/shimmer for a snappier, lower-CPU/RAM experience.
 * Persisted to localStorage; a no-flash script in the root layout applies it
 * before first paint so there's no flash of animation on load.
 */
export function LiteModeToggle() {
  const [lite, setLite] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLite(document.documentElement.getAttribute("data-lite") === "1");
    setMounted(true);
  }, []);

  function toggle() {
    const next = !lite;
    setLite(next);
    if (next) document.documentElement.setAttribute("data-lite", "1");
    else document.documentElement.removeAttribute("data-lite");
    try { localStorage.setItem(LITE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={mounted ? lite : undefined}
      title={
        mounted && lite
          ? "Lite mode ON — animations off, lower resource use. Click to turn off."
          : "Lite mode OFF — click to turn on (fewer animations, lighter on RAM/CPU)."
      }
    >
      <Feather className={cn("h-[1.1rem] w-[1.1rem]", mounted && lite ? "text-primary" : "text-muted-foreground")} />
      <span className="sr-only">Toggle lite mode</span>
    </Button>
  );
}
