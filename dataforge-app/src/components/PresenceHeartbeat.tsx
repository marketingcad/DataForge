"use client";

import { useEffect } from "react";

// Reports this instance's presence every ~8s so the boss fleet view sees who's
// online, and executes any remote start/stop commands the boss queued for THIS
// device — which is how a boss's action makes the scrape run on the user's device.
// Renders nothing.

function getDeviceId(): string {
  const KEY = "dataforge:deviceId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// Friendly name for a web instance, e.g. "Chrome on Windows".
function webDeviceName(): string {
  try {
    const ua = navigator.userAgent;
    const browser =
      /Edg\//.test(ua) ? "Edge" :
      /OPR\//.test(ua) ? "Opera" :
      /Chrome\//.test(ua) ? "Chrome" :
      /Firefox\//.test(ua) ? "Firefox" :
      /Safari\//.test(ua) ? "Safari" : "Browser";
    const os =
      /Windows/.test(ua) ? "Windows" :
      /Mac OS X/.test(ua) ? "macOS" :
      /Android/.test(ua) ? "Android" :
      /(iPhone|iPad)/.test(ua) ? "iOS" :
      /Linux/.test(ua) ? "Linux" : "";
    return os ? `${browser} on ${os}` : browser;
  } catch {
    return "Web";
  }
}

export function PresenceHeartbeat() {
  useEffect(() => {
    const deviceId = getDeviceId();
    const desktop = (window as unknown as { dataforgeDesktop?: { isDesktop?: boolean; deviceName?: string; lanIp?: string } }).dataforgeDesktop;
    const kind = desktop?.isDesktop ? "desktop" : "web";
    const deviceName = desktop?.isDesktop ? (desktop.deviceName || "Desktop") : webDeviceName();
    // Desktop reports its LAN IP (the server only sees localhost for a desktop's
    // own requests). For web, the server reads the public IP from headers.
    const reportedIp = desktop?.isDesktop ? (desktop.lanIp || null) : null;

    let stopped = false;

    // Execute a remote command locally: toggling auto-run on THIS device's server
    // starts/stops the scrape here. The keyword is one the logged-in user can
    // access (the boss only issues those), so the PATCH authorizes.
    async function runCommand(cmd: { action: string; keywordId: string }) {
      try {
        await fetch(`/api/keywords/${cmd.keywordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoRun: cmd.action === "start", deviceId }),
        });
      } catch { /* transient — boss can re-issue */ }
    }

    async function beat() {
      if (stopped) return;
      try {
        const res = await fetch("/api/instances/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, kind, deviceName, reportedIp }),
          keepalive: true,
        });
        const data = await res.json().catch(() => null);
        const commands: { action: string; keywordId: string }[] = data?.commands ?? [];
        for (const cmd of commands) await runCommand(cmd);
      } catch { /* offline / transient — next beat retries */ }
    }

    beat();
    const interval = setInterval(beat, 8_000);
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);

    // On close (tab closed, app quit, navigate away), tell the server immediately
    // so the fleet drops this device without waiting for the heartbeat timeout.
    // sendBeacon survives page unload and carries the session cookie.
    const leave = () => {
      stopped = true;
      try {
        const blob = new Blob([JSON.stringify({ deviceId })], { type: "application/json" });
        navigator.sendBeacon("/api/instances/leave", blob);
      } catch { /* ignore */ }
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
    };
  }, []);

  return null;
}
