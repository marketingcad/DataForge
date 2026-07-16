"use client";

import { useEffect, useState, useCallback } from "react";
import { getFleetAction, issueRemoteCommandAction, type FleetInstance, type FleetKeyword } from "@/actions/fleet.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Monitor, Globe, Play, Square, Search, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Per-device: a keyword is "scraping" on a device only if that device has a
// running/pending job for it (jobStatus is attributed per device server-side).
const isScraping = (k: FleetKeyword) => k.jobStatus === "running" || k.jobStatus === "pending";

export function FleetDashboard() {
  const [instances, setInstances] = useState<FleetInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({}); // key: `${deviceId}:${kwId}`

  const refresh = useCallback(async () => {
    try {
      setInstances((await getFleetAction()).instances);
    } catch { /* ignore transient */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  async function issue(deviceId: string, kw: FleetKeyword, action: "start" | "stop") {
    const key = `${deviceId}:${kw.id}`;
    setBusy((b) => ({ ...b, [key]: true }));
    // Optimistic: reflect the intended auto-run state right away.
    setInstances((prev) =>
      prev.map((inst) =>
        inst.deviceId !== deviceId ? inst : {
          ...inst,
          keywords: inst.keywords.map((k) => (k.id === kw.id ? { ...k, autoRun: action === "start" } : k)),
        }
      )
    );
    const res = await issueRemoteCommandAction(deviceId, kw.id, action);
    setBusy((b) => { const n = { ...b }; delete n[key]; return n; });
    if ("error" in res) {
      toast.error(res.error);
      refresh(); // revert optimistic
    } else {
      toast.success(`${action === "start" ? "Start" : "Stop"} sent to that device — “${kw.keyword}”. It runs there within a few seconds.`);
    }
  }

  async function stopAll(inst: FleetInstance) {
    const active = inst.keywords.filter(isScraping);
    for (const k of active) await issue(inst.deviceId, k, "stop");
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading fleet…</div>;
  }
  if (instances.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No devices online right now. A device appears here while its DataForge app or tab is open.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {instances.map((inst) => {
        const scraping = inst.keywords.filter(isScraping);
        const isOpen = expanded[inst.deviceId] ?? false;
        const q = (search[inst.deviceId] ?? "").toLowerCase();
        const listed = inst.keywords.filter(
          (k) => !q || k.keyword.toLowerCase().includes(q) || k.location.toLowerCase().includes(q)
        );

        return (
          <div key={inst.deviceId} className="rounded-lg border bg-card p-4 space-y-3">
            {/* Device header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {inst.kind === "desktop" ? <Monitor className="h-5 w-5 text-blue-600 shrink-0" /> : <Globe className="h-5 w-5 text-muted-foreground shrink-0" />}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{inst.userName ?? inst.userEmail ?? "Unknown user"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="capitalize">{inst.role.replace("_", " ")}</span>
                    {" · "}
                    <span className="font-medium">{inst.kind === "desktop" ? "Desktop" : "Website"}</span>
                    {inst.deviceName ? ` · ${inst.deviceName}` : ""}
                    {inst.ipAddress ? ` · ${inst.ipAddress}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  {scraping.length > 0 ? `${scraping.length} scraping` : "online"}
                </span>
                {scraping.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-rose-600 border-rose-300 hover:bg-rose-50" onClick={() => stopAll(inst)}>
                    <Square className="h-3 w-3" />Stop all
                  </Button>
                )}
              </div>
            </div>

            {/* Currently scraping — always visible for quick control */}
            {scraping.length > 0 && (
              <div className="space-y-1">
                {scraping.map((k) => (
                  <KeywordRow key={k.id} k={k} deviceId={inst.deviceId} busy={busy} onIssue={issue} />
                ))}
              </div>
            )}

            {/* Manage-all expander (keeps big lists collapsed) */}
            <button
              type="button"
              onClick={() => setExpanded((e) => ({ ...e, [inst.deviceId]: !isOpen }))}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Manage all {inst.keywords.length} accessible keyword{inst.keywords.length !== 1 ? "s" : ""}
            </button>

            {isOpen && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search keywords…"
                    value={search[inst.deviceId] ?? ""}
                    onChange={(e) => setSearch((s) => ({ ...s, [inst.deviceId]: e.target.value }))}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {listed.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No keywords match.</p>
                  ) : (
                    listed.map((k) => (
                      <KeywordRow key={k.id} k={k} deviceId={inst.deviceId} busy={busy} onIssue={issue} />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KeywordRow({
  k, deviceId, busy, onIssue,
}: {
  k: FleetKeyword;
  deviceId: string;
  busy: Record<string, boolean>;
  onIssue: (deviceId: string, k: FleetKeyword, action: "start" | "stop") => void;
}) {
  const scraping = isScraping(k);
  const isBusy = busy[`${deviceId}:${k.id}`];
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
      <span className="truncate min-w-0">
        {k.keyword} <span className="text-muted-foreground">· {k.location}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {scraping && <span className="font-medium text-blue-600">{k.jobStatus === "running" || k.jobStatus === "pending" ? "Scraping…" : "Auto"}</span>}
        <span className="text-muted-foreground">{k.leads}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          className={cn("h-6 px-2 gap-1", scraping ? "text-rose-600 border-rose-300 hover:bg-rose-50" : "text-emerald-600 border-emerald-300 hover:bg-emerald-50")}
          onClick={() => onIssue(deviceId, k, scraping ? "stop" : "start")}
        >
          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : scraping ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {scraping ? "Stop" : "Start"}
        </Button>
      </span>
    </div>
  );
}
