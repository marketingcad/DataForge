"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

async function runSyncBatches(mode: "incremental" | "reset" | "wipe"): Promise<{ synced: number; skipped: number; unmatched: number; noAgents?: boolean; message?: string }> {
  let cursor: number | null = null;
  let totalSynced = 0;
  let totalSkipped = 0;
  let totalUnmatched = 0;
  let isFirst = true;

  while (true) {
    const body: Record<string, unknown> = {};
    if (isFirst && mode === "reset") body.forceReset = true;
    if (isFirst && mode === "wipe") body.wipe = true;
    if (cursor !== null) body.cursor = cursor;
    isFirst = false;

    const res = await fetch("/api/ghl/sync-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Sync failed");

    if (data.noAgents) return { synced: 0, skipped: 0, unmatched: 0, noAgents: true, message: data.message };

    totalSynced   += data.synced   ?? 0;
    totalSkipped  += data.skipped  ?? 0;
    totalUnmatched += data.unmatched ?? 0;

    if (data.done) break;
    cursor = data.nextCursor;
  }

  return { synced: totalSynced, skipped: totalSkipped, unmatched: totalUnmatched };
}

export function SyncGhlCallsButton() {
  const [loading, setLoading] = useState(false);

  async function handleSync(mode: "incremental" | "reset" | "wipe" = "incremental") {
    if (mode === "wipe" && !window.confirm(
      "Rebuild all call data from GHL?\n\nThis deletes every existing call log and re-imports them from GHL so the numbers match GHL's own reports exactly. Recommended if your call counts look inflated."
    )) return;

    setLoading(true);
    try {
      const result = await runSyncBatches(mode);

      if (result.noAgents) {
        toast.warning("No agents linked to GHL", {
          description: result.message,
          duration: 8000,
        });
        return;
      }

      if (result.synced === 0 && result.skipped === 0) {
        toast.info("No new calls found in GHL");
        return;
      }

      toast.success(`Synced ${result.synced} call${result.synced !== 1 ? "s" : ""} from GHL`, {
        description: result.skipped > 0 ? `${result.skipped} already up to date` : undefined,
      });
      window.location.reload();
    } catch (err) {
      toast.error("Sync failed", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="gap-2" onClick={() => handleSync("incremental")} disabled={loading}>
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing…" : "Sync GHL Calls"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Rebuild from GHL — deletes all call logs and re-imports so counts match GHL exactly"
        onClick={() => handleSync("wipe")}
        disabled={loading}
        className="h-9 w-9"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
