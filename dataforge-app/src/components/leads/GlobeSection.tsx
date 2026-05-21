"use client";

import { useState } from "react";
import { LeadsGlobe } from "./LeadsGlobe";
import type { GlobePoint } from "@/lib/leads/locations";

const COOKIE_KEY = "df-globe-visible";
const ONE_YEAR = 60 * 60 * 24 * 365;

interface Props {
  points: GlobePoint[];
  defaultVisible: boolean;
}

export function GlobeSection({ points, defaultVisible }: Props) {
  const [visible, setVisible] = useState(defaultVisible);

  function toggle() {
    const next = !visible;
    setVisible(next);
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
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
          {visible ? "Hide" : "Show"}
        </button>
      </div>

      {visible && <LeadsGlobe points={points} />}
    </div>
  );
}
