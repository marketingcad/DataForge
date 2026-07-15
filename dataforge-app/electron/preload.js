// Preload script — runs in the renderer before the web app loads, with access
// to a controlled bridge. For now it just flags that we're running inside the
// desktop shell (the web app can check `window.dataforgeDesktop?.isDesktop`).
// Reserved for future IPC (e.g. native file save, notifications).
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("dataforgeDesktop", {
  isDesktop: true,
  platform: process.platform,
});
