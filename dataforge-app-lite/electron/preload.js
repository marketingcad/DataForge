// Preload script — runs in the renderer before the web app loads, exposing a
// controlled bridge: a flag that we're inside the desktop shell (the web app
// checks `window.dataforgeDesktop?.isDesktop`), the machine identity used by the
// boss fleet view, and the auto-update channel.
//
// ⚠ THIS RUNS SANDBOXED. `webPreferences` sets contextIsolation and leaves
// `sandbox` at its default of true, so only `electron` and a small polyfilled
// subset are requireable here. `require("os")` used to sit in this file: it throws
// "module not found", which aborts the ENTIRE preload and silently deletes the
// whole bridge — every desktop install reported itself as "web" for that reason.
//
// So: anything needing Node belongs in the main process, behind IPC. And every
// call below is guarded, because one throw at this level costs the whole bridge.
const { contextBridge, ipcRenderer } = require("electron");

/** Hostname, LAN IP and platform, computed in the main process (main.js DEVICE_INFO). */
function deviceInfo() {
  try {
    return ipcRenderer.sendSync("device:info") ?? {};
  } catch {
    // Main process not listening yet, or the channel is gone. Degrade to unknown
    // rather than taking the bridge down with us.
    return {};
  }
}

const device = deviceInfo();

contextBridge.exposeInMainWorld("dataforgeDesktop", {
  isDesktop: true,
  platform: device.platform ?? null,
  // Machine hostname + LAN IP so the boss fleet view can tell devices apart.
  deviceName: device.deviceName ?? null,
  lanIp: device.lanIp ?? null,

  // ── Auto-update bridge ────────────────────────────────────────────────────
  // Only `{ ready, version, current }` ever crosses. The update feed token and
  // the rest of the environment stay in the main process: the renderer runs web
  // code, so anything handed to it can leave the machine (CLAUDE.md C9).
  //
  // Named functions rather than an exposed `ipcRenderer` so the renderer can call
  // exactly these channels and nothing else.
  getUpdateState: () => ipcRenderer.invoke("updater:get-state"),
  installUpdateNow: () => ipcRenderer.invoke("updater:install-now"),
  /** Subscribe to "an update finished downloading". Returns an unsubscribe fn. */
  onUpdateReady: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("updater:ready", handler);
    return () => ipcRenderer.off("updater:ready", handler);
  },
});
