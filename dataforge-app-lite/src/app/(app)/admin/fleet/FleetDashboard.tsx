"use client";

import { useEffect, useState, useCallback } from "react";
import { getFleetAction, issueRemoteCommandAction, type FleetInstance, type FleetKeyword } from "@/actions/fleet.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Monitor, Globe, Play, Square, Search, ChevronDown, ChevronRight, MapPin, Wifi, Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Per-device: a keyword is "scraping" on a device only if that device has a
// running/pending job for it (attributed per device server-side).
const isScraping = (k: FleetKeyword) => k.jobStatus === "running" || k.jobStatus === "pending";

// Deterministic soft color for an account avatar.
const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function FleetDashboard() {
  const [instances, setInstances] = useState<FleetInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    try {
      setInstances((await getFleetAction()).instances);
    } catch { /* transient */ } finally {
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
    setInstances((prev) =>
      prev.map((inst) =>
        inst.deviceId !== deviceId ? inst : {
          ...inst,
          keywords: inst.keywords.map((k) => (k.id === kw.id ? { ...k, jobStatus: action === "start" ? "running" : null } : k)),
        }
      )
    );
    const res = await issueRemoteCommandAction(deviceId, kw.id, action);
    setBusy((b) => { const n = { ...b }; delete n[key]; return n; });
    if ("error" in res) { toast.error(res.error); refresh(); }
    else toast.success(`${action === "start" ? "Start" : "Stop"} sent — “${kw.keyword}” runs on that device shortly.`);
  }

  async function stopAll(inst: FleetInstance) {
    for (const k of inst.keywords.filter(isScraping)) await issue(inst.deviceId, k, "stop");
  }

  const totalScraping = instances.reduce((s, i) => s + i.keywords.filter(isScraping).length, 0);

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading fleet…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatTile icon={<Monitor className="h-4 w-4" />} label="Devices online" value={instances.length} tone="blue" />
        <StatTile icon={<Activity className="h-4 w-4" />} label="Scraping now" value={totalScraping} tone="emerald" />
      </div>

      {instances.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No devices online right now. A device appears here while its DataForge app or tab is open.
        </p>
      ) : (
        instances.map((inst) => {
          const scraping = inst.keywords.filter(isScraping);
          const isOpen = expanded[inst.deviceId] ?? false;
          const q = (search[inst.deviceId] ?? "").toLowerCase();
          const listed = inst.keywords.filter((k) => !q || k.keyword.toLowerCase().includes(q) || k.location.toLowerCase().includes(q));
          const name = inst.userName ?? inst.userEmail ?? "Unknown user";

          return (
            <div key={inst.deviceId} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white", avatarColor(name))}>
                    {initials(name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate leading-tight">{name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Chip className="capitalize">{inst.role.replace("_", " ")}</Chip>
                      <Chip className={inst.kind === "desktop" ? "text-blue-600 border-blue-200 dark:border-blue-800" : ""}>
                        {inst.kind === "desktop" ? <Monitor className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {inst.kind === "desktop" ? "Desktop" : "Website"}
                      </Chip>
                      {inst.deviceName && <Chip>{inst.deviceName}</Chip>}
                      {inst.ipAddress && <Chip><Wifi className="h-3 w-3" />{inst.ipAddress}</Chip>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    {scraping.length > 0 ? `${scraping.length} scraping` : "online"}
                  </span>
                  {scraping.length > 0 && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => stopAll(inst)}>
                      <Square className="h-3 w-3" />Stop all
                    </Button>
                  )}
                </div>
              </div>

              {/* Currently scraping — highlighted */}
              {scraping.length > 0 && (
                <div className="border-t bg-blue-50/40 dark:bg-blue-950/10 px-4 py-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600/80 dark:text-blue-400/80">Scraping now</p>
                  {scraping.map((k) => <KeywordRow key={k.id} k={k} deviceId={inst.deviceId} busy={busy} onIssue={issue} highlight />)}
                </div>
              )}

              {/* Manage all */}
              <div className="border-t px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [inst.deviceId]: !isOpen }))}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Manage all {inst.keywords.length} accessible keyword{inst.keywords.length !== 1 ? "s" : ""}
                </button>

                {isOpen && (
                  <div className="mt-2.5 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search keywords…"
                        value={search[inst.deviceId] ?? ""}
                        onChange={(e) => setSearch((s) => ({ ...s, [inst.deviceId]: e.target.value }))}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                      {listed.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No keywords match.</p>
                      ) : (
                        listed.map((k) => <KeywordRow key={k.id} k={k} deviceId={inst.deviceId} busy={busy} onIssue={issue} />)
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function StatTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "emerald" }) {
  const tones = {
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tones[tone])}>{icon}</div>
      <div>
        <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground", className)}>
      {children}
    </span>
  );
}

function KeywordRow({
  k, deviceId, busy, onIssue, highlight,
}: {
  k: FleetKeyword;
  deviceId: string;
  busy: Record<string, boolean>;
  onIssue: (deviceId: string, k: FleetKeyword, action: "start" | "stop") => void;
  highlight?: boolean;
}) {
  const scraping = isScraping(k);
  const isBusy = busy[`${deviceId}:${k.id}`];
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
      highlight ? "bg-background border-blue-200/60 dark:border-blue-900/40" : "bg-background hover:bg-muted/40"
    )}>
      <div className="min-w-0">
        <p className="font-medium truncate">{k.keyword}</p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
          <MapPin className="h-2.5 w-2.5 shrink-0" />{k.location}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {scraping && (
          <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />Scraping
          </span>
        )}
        <span className="text-muted-foreground tabular-nums">{k.leads} <span className="text-muted-foreground/60">leads</span></span>
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          className={cn("h-7 px-2.5 gap-1", scraping ? "text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30" : "text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30")}
          onClick={() => onIssue(deviceId, k, scraping ? "stop" : "start")}
        >
          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : scraping ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {scraping ? "Stop" : "Start"}
        </Button>
      </div>
    </div>
  );
}
