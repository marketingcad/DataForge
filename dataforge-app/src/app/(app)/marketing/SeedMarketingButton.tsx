"use client";
import { useTransition } from "react";
import { seedMarketingDataAction } from "@/actions/seed-marketing.actions";
import { useNotifications } from "@/lib/notifications";
import { Database, Loader2 } from "lucide-react";

export function SeedMarketingButton() {
  const [pending, startTransition] = useTransition();
  const { add } = useNotifications();

  function handleSeed() {
    startTransition(async () => {
      try {
        const result = await seedMarketingDataAction();
        add({ title: "Data seeded", message: result.message, type: "success" });
      } catch (e) {
        add({
          title: "Seed failed",
          message: (e as Error).message,
          type: "error",
        });
      }
    });
  }

  return (
    <button
      onClick={handleSeed}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Database className="h-3.5 w-3.5" />
      )}
      {pending ? "Seeding…" : "Seed Dummy Data"}
    </button>
  );
}
