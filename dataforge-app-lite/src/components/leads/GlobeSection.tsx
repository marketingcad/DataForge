"use client";

import { useState, useEffect } from "react";
import { LeadsGlobe } from "./LeadsGlobe";
import type { GlobePoint } from "@/lib/leads/locations";

const COOKIE_KEY = "df-globe-visible";
const ONE_YEAR = 60 * 60 * 24 * 365;

interface Props {
  defaultVisible: boolean;
}

export function GlobeSection({ defaultVisible }: Props) {
  const [visible, setVisible] = useState(defaultVisible);
  const [points, setPoints] = useState<GlobePoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch the globe's coordinate data only the first time it's actually shown.
  // This keeps the (potentially very large) point set out of the Leads page load.
  useEffect(() => {
    if (!visible || points !== null || loading) return;
    setLoading(true);
    fetch("/api/leads/locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPoints(Array.isArray(data) ? data : []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [visible, points, loading]);

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

      {visible && (
        points === null
          ? (
            <div className="rounded-2xl border bg-card overflow-hidden h-[420px] flex items-center justify-center">
              <div className="text-sm text-muted-foreground animate-pulse">Loading globe…</div>
            </div>
          )
          : points.length === 0
            ? (
              <div className="rounded-2xl border bg-card overflow-hidden h-[420px] flex items-center justify-center">
                <div className="text-sm text-muted-foreground">No mapped lead locations yet.</div>
              </div>
            )
            : <LeadsGlobe points={points} />
      )}
    </div>
  );
}
