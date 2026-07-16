"use client";

import { useEffect } from "react";

// Reports this instance's presence to the server every 10s so the boss fleet view
// can see who's online and on what kind of device. Renders nothing.
//
// deviceId is a stable per-install id kept in localStorage — so the same browser
// or desktop app keeps its identity across reloads. Desktop is detected via the
// bridge the Electron preload exposes (window.dataforgeDesktop.isDesktop).

function getDeviceId(): string {
  const KEY = "dataforge:deviceId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable — fall back to a per-session id.
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function PresenceHeartbeat() {
  useEffect(() => {
    const deviceId = getDeviceId();
    const kind =
      typeof window !== "undefined" &&
      (window as unknown as { dataforgeDesktop?: { isDesktop?: boolean } }).dataforgeDesktop?.isDesktop
        ? "desktop"
        : "web";

    let stopped = false;
    async function beat() {
      if (stopped) return;
      try {
        await fetch("/api/instances/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, kind }),
          keepalive: true,
        });
      } catch { /* offline / transient — next beat retries */ }
    }

    beat(); // report immediately on mount
    const interval = setInterval(beat, 10_000);
    // Re-beat when the tab becomes visible again (was backgrounded).
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
