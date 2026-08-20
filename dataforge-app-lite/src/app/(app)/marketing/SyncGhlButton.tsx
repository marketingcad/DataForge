"use client";
import { useTransition } from "react";
import { syncGhlAction } from "@/actions/ghl-sync.actions";
import { useNotifications } from "@/lib/notifications";
import { RefreshCw, Loader2 } from "lucide-react";

export function SyncGhlButton() {
  const [pending, startTransition] = useTransition();
  const { add } = useNotifications();

  function handleSync() {
    startTransition(async () => {
      try {
        const result = await syncGhlAction();
        add({ title: "GHL Synced", message: result.message, type: "success" });
      } catch (e) {
        add({ title: "Sync failed", message: (e as Error).message, type: "error" });
      }
    });
  }

  return (
    <button
      onClick={handleSync}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {pending ? "Syncing…" : "Sync GHL"}
    </button>
  );
}
