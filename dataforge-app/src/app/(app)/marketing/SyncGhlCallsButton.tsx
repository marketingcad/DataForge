"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncGhlCallsButton() {
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/ghl/sync-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Sync failed", { description: data.error });
        return;
      }
      if (data.synced === 0 && data.message) {
        toast.info(data.message);
        return;
      }
      toast.success(`Synced ${data.synced} call${data.synced !== 1 ? "s" : ""} from GHL`, {
        description: data.skipped > 0 ? `${data.skipped} already up to date` : undefined,
      });
      // Refresh the page to show updated analytics
      window.location.reload();
    } catch {
      toast.error("Failed to reach sync endpoint");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" className="gap-2" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing…" : "Sync GHL Calls"}
    </Button>
  );
}
