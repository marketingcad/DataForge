"use client";

// Last-resort boundary (root layout failed). Renders its own <html>/<body> with
// inline styles so it works even if app CSS didn't load. Polls the DB health probe:
// while the database is unreachable it shows a "Reconnecting…" screen and auto-reloads
// once it's back; if the DB is fine but the app still errored, it shows a retry screen.

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [phase, setPhase] = useState<"checking" | "reconnecting" | "error">("checking");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    console.error(error);
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function ping(): Promise<boolean> {
      try {
        const r = await fetch("/api/health/db", { cache: "no-store" });
        const j = await r.json().catch(() => ({ ok: false }));
        return r.ok && !!j.ok;
      } catch { return false; }
    }
    async function loop() {
      const ok = await ping();
      if (!active) return;
      if (ok) {
        let g = { n: 0, t: 0 };
        try { g = JSON.parse(sessionStorage.getItem("df-reconnect-guard") || "") || g; } catch { /* ignore */ }
        const now = new Date().getTime();
        if (now - g.t > 15000) g = { n: 0, t: now };
        g.n += 1; g.t = now;
        try { sessionStorage.setItem("df-reconnect-guard", JSON.stringify(g)); } catch { /* ignore */ }
        if (g.n > 3) { setPhase("error"); return; }
        reset();
        return;
      }
      setPhase("reconnecting");
      setAttempts((a) => a + 1);
      timer = setTimeout(loop, 3000);
    }
    loop();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [error, reset]);

  const wrap: React.CSSProperties = {
    margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0b0b0f", color: "#e5e7eb", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 24,
  };
  const btn: React.CSSProperties = {
    cursor: "pointer", border: "none", borderRadius: 10, padding: "10px 18px",
    fontSize: 14, fontWeight: 600, background: "#2563eb", color: "#fff",
  };

  const reconnecting = phase !== "error";

  return (
    <html lang="en">
      <body style={wrap}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 20px", display: "flex", alignItems: "center",
            justifyContent: "center", borderRadius: 16,
            background: reconnecting ? "rgba(37,99,235,0.14)" : "rgba(245,158,11,0.12)", fontSize: 26,
          }}>
            {reconnecting ? "🔌" : "⚠️"}
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 8px" }}>
            {reconnecting ? "Reconnecting to the database…" : "Something went wrong"}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#9ca3af", margin: "0 0 20px" }}>
            {reconnecting
              ? "DataForge lost its connection to the database and is trying to reconnect. The app will continue automatically once it's back — no need to do anything."
              : "The database is reachable, but the app ran into a problem. Please try again."}
          </p>
          {reconnecting ? (
            <p style={{ fontSize: 12, color: "rgba(156,163,175,0.7)" }}>
              Attempt {attempts || 1} · retrying every few seconds
            </p>
          ) : (
            <button onClick={() => reset()} style={btn}>Try again</button>
          )}
          {!reconnecting && error.digest && (
            <p style={{ fontSize: 10, color: "rgba(156,163,175,0.5)", marginTop: 20 }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
