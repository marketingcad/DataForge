"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";

interface GhlLeadButtonProps {
  leadId: string;
  alreadyMigrated: boolean;
  migratedAt: Date | null;
}

export function GhlLeadButton({ leadId, alreadyMigrated, migratedAt }: GhlLeadButtonProps) {
  const [migrated, setMigrated] = useState(alreadyMigrated);
  const [migratedDate, setMigratedDate] = useState(migratedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ghl/migrate-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send to GHL");
      setMigrated(true);
      setMigratedDate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnmark() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ghl/unmark-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to unmark");
      setMigrated(false);
      setMigratedDate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      {migrated ? (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600">Sent to GHL</span>
            {migratedDate && (
              <span className="text-[11px] text-muted-foreground">
                · {new Date(migratedDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handleSend} disabled={loading} className="text-xs gap-1.5">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Re-send
            </Button>
            <Button variant="outline" size="sm" onClick={handleUnmark} disabled={loading} className="text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
              Unmark
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleSend} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {loading ? "Sending…" : "Send to GHL"}
        </Button>
      )}
      {error && <p className="text-xs text-destructive text-right">{error}</p>}
    </div>
  );
}
