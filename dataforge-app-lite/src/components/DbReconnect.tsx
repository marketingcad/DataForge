"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Database } from "lucide-react";

const GUARD_KEY = "df-reconnect-guard";

/**
 * Shown by the error boundaries. Repeatedly probes /api/health/db:
 *  - DB unreachable  → "Reconnecting to the database…" spinner; keeps polling; auto-reloads when it returns.
 *  - DB reachable but page still errored (a non-DB bug) → falls back to a normal "Something went wrong" screen.
 * A short-window guard prevents an infinite reload loop on genuine non-DB errors.
 */
export function DbReconnect({ reset, digest }: { reset: () => void; digest?: string }) {
  const [phase, setPhase] = useState<"checking" | "reconnecting" | "error">("checking");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function ping(): Promise<boolean> {
      try {
        const r = await fetch("/api/health/db", { cache: "no-store" });
        const j = await r.json().catch(() => ({ ok: false }));
        return r.ok && !!j.ok;
      } catch {
        return false;
      }
    }

    async function loop() {
      const ok = await ping();
      if (!active) return;

      if (ok) {
        // DB is reachable. Guard against reload loops from non-DB errors.
        let g = { n: 0, t: 0 };
        try { g = JSON.parse(sessionStorage.getItem(GUARD_KEY) || "") || g; } catch { /* ignore */ }
        const now = new Date().getTime();
        if (now - g.t > 15000) g = { n: 0, t: now };
        g.n += 1; g.t = now;
        try { sessionStorage.setItem(GUARD_KEY, JSON.stringify(g)); } catch { /* ignore */ }

        if (g.n > 3) { setPhase("error"); return; }  // keeps erroring with DB up → not the DB
        reset();                                      // DB back (or blip recovered) → reload
        return;
      }

      // DB down — keep trying.
      setPhase("reconnecting");
      setAttempts((a) => a + 1);
      timer = setTimeout(loop, 3000);
    }

    loop();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [reset]);

  if (phase === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            The database is reachable, but this page ran into a problem. Please try again.
          </p>
        </div>
        <Button className="gap-1.5" onClick={reset}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
        {digest && <p className="text-[10px] text-muted-foreground/50 tabular-nums">Reference: {digest}</p>}
      </div>
    );
  }

  // checking / reconnecting
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/20" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
          <Database className="h-7 w-7 text-blue-500" />
        </div>
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-lg font-semibold tracking-tight flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
          Reconnecting to the database…
        </h2>
        <p className="text-sm text-muted-foreground">
          DataForge lost its connection to the database and is trying to reconnect. The app will continue automatically once it&apos;s back — no need to do anything.
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground/60 tabular-nums">
        Attempt {attempts || 1} · retrying every few seconds
      </p>
    </div>
  );
}
