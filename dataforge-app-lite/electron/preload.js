// Preload script — runs in the renderer before the web app loads, with access
// to a controlled bridge. For now it just flags that we're running inside the
// desktop shell (the web app can check `window.dataforgeDesktop?.isDesktop`).
// Reserved for future IPC (e.g. native file save, notifications).
const { contextBridge } = require("electron");
const os = require("os");

function firstLanIp() {
  try {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family === "IPv4" && !a.internal) return a.address;
      }
    }
  } catch { /* ignore */ }
  return null;
}

contextBridge.exposeInMainWorld("dataforgeDesktop", {
  isDesktop: true,
  platform: process.platform,
  // Machine hostname + LAN IP so the boss fleet view can tell devices apart.
  deviceName: (() => { try { return os.hostname(); } catch { return null; } })(),
  lanIp: firstLanIp(),
});
