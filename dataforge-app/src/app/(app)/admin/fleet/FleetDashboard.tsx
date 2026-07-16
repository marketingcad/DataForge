"use client";

import { useEffect, useState, useCallback } from "react";
import { getFleetAction, type FleetInstance } from "@/actions/fleet.actions";
import { Loader2, Monitor, Globe } from "lucide-react";

export function FleetDashboard() {
  const [instances, setInstances] = useState<FleetInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await getFleetAction();
      setInstances(r.instances);
    } catch {
      /* ignore transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fleet…
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No devices online right now. A device shows up here while its DataForge app or tab is open.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {instances.map((inst) => {
        const scraping = inst.keywords.filter(
          (k) => k.autoRun || k.jobStatus === "running" || k.jobStatus === "pending"
        );
        return (
          <div key={inst.deviceId} className="rounded-lg border bg-card p-4 space-y-3">
            {/* Device header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {inst.kind === "desktop" ? (
                  <Monitor className="h-4 w-4 text-blue-600 shrink-0" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {inst.userName ?? inst.userEmail ?? "Unknown user"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate capitalize">
                    {inst.role.replace("_", " ")} · {inst.kind}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {scraping.length > 0 ? `${scraping.length} scraping` : "online"}
              </span>
            </div>

            {/* Accessible keywords + status */}
            <div className="space-y-1">
              {inst.keywords.length === 0 ? (
                <p className="text-xs text-muted-foreground">No accessible keywords.</p>
              ) : (
                inst.keywords.map((k) => {
                  const isScraping = k.jobStatus === "running" || k.jobStatus === "pending";
                  return (
                    <div
                      key={k.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate">
                        {k.keyword} <span className="text-muted-foreground">· {k.location}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {k.autoRun && <span className="font-medium text-emerald-600">Auto</span>}
                        {isScraping && <span className="font-medium text-blue-600">Scraping…</span>}
                        <span className="text-muted-foreground">{k.leads} leads</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
