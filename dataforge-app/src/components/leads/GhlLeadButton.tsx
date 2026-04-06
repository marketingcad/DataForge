"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Send } from "lucide-react";

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

  if (migrated) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sent to GHL
        </span>
        {migratedDate && (
          <span className="text-xs text-muted-foreground">
            {new Date(migratedDate).toLocaleDateString()}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSend}
          disabled={loading}
          className="text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Re-send"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSend}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {loading ? "Sending…" : "Send to GHL"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
