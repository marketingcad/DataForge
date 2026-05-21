"use client";

import { useState, useEffect } from "react";
import { LeadsGlobe } from "./LeadsGlobe";
import type { GlobePoint } from "@/lib/leads/locations";

const LS_KEY = "df-globe-visible";

interface Props {
  points: GlobePoint[];
}

export function GlobeSection({ points }: Props) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored !== null) setVisible(stored === "true");
    setMounted(true);
  }, []);

  function toggle() {
    const next = !visible;
    setVisible(next);
    localStorage.setItem(LS_KEY, String(next));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Lead Origins Globe
        </p>
        <button
          onClick={toggle}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-lg hover:bg-muted/60"
        >
          {mounted ? (visible ? "Hide" : "Show") : "Hide"}
        </button>
      </div>

      {(!mounted || visible) && <LeadsGlobe points={points} />}
    </div>
  );
}
