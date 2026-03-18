"use client";

import dynamic from "next/dynamic";
import type { GlobePoint } from "@/lib/leads/locations";

const LeadsGlobeInner = dynamic(() => import("./LeadsGlobeInner"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border bg-card overflow-hidden h-[420px] flex items-center justify-center">
      <div className="text-sm text-muted-foreground animate-pulse">Loading globe…</div>
    </div>
  ),
});

interface Props {
  points: GlobePoint[];
}

export function LeadsGlobe({ points }: Props) {
  return <LeadsGlobeInner points={points} />;
}
