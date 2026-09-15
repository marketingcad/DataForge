// DataForge desktop shell (Electron main process).
//
// Responsibilities:
//   1. Boot the app's own Next.js + Socket.io server (the same server.ts that
//      `npm run start` uses) as a child process, on a local port.
//   2. Wait until that server is answering HTTP, then open a window pointing at it.
//   3. Tear the server down when the app quits.
//
// The window loads the exact same web UI — nothing about the design changes;
// Electron just hosts it in a native window instead of a browser tab.

const { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain, dialog } = require("electron");
const { initUpdater, isUpdateReady, getUpdateState, installNow, stopUpdater } = require("./updater");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const fs = require("fs");
const os = require("os");

const TRAY_ICON = path.join(__dirname, "icon.ico");

// ── Launch timing diagnostics ──────────────────────────────────────────────
// Writes elapsed-ms milestones to <userData>/launch-timing.log so we can see
// EXACTLY where startup time goes (Electron init vs. window paint vs. server
// boot). T0 is when this main.js module first loads.
const T0 = Date.now();
let timingLogPath = null;
function timing(label) {
  const line = `+${String(Date.now() - T0).padStart(6, " ")}ms  ${label}`;
  console.log("[dataforge:timing]", line);
  try {
    if (!timingLogPath) timingLogPath = path.join(app.getPath("userData"), "launch-timing.log");
    fs.appendFileSync(timingLogPath, line + "\n");
  } catch { /* userData not ready yet / disk error — console line still emitted */ }
}
timing("main.js module loaded");

// Fixed local port. Kept at 3000 for now so it matches the app's existing
// auth/callback config; made configurable so we can change it later if needed.
const PORT = process.env.DATAFORGE_PORT || "3000";
const APP_URL = `http://localhost:${PORT}`;

// Root of the app (one level up from /electron).
const APP_ROOT = path.join(__dirname, "..");

// Attach mode: skip starting our own server and just open a window against an
// already-running app (e.g. `npm run dev` on :3000). Used for quick UI smoke
// tests during development — set DATAFORGE_ATTACH=1.
const ATTACH_MODE = process.env.DATAFORGE_ATTACH === "1";

let serverProcess = null;
let mainWindow = null;
let tray = null;
// True only when the user really wants to quit (tray "Quit"). Otherwise closing
// the window just hides it to the tray so scraping keeps running in the
// background — like Discord.
let isQuitting = false;

/**
 * Start the Next.js + Socket.io server as a child process.
 * Milestone 1 (dev/unpackaged): run the existing `tsx server.ts`.
 * A later milestone swaps this for a bundled, compiled server so no tsx/npm
 * is needed in the packaged app.
 */
function startServer() {
  const isWin = process.platform === "win32";

  if (app.isPackaged) {
    // Packaged app: run the Next standalone server with Electron's OWN Node
    // runtime (ELECTRON_RUN_AS_NODE) — no system Node, npm, or tsx required.
    const standaloneDir = path.join(process.resourcesPath, "standalone");
    const serverEntry = path.join(standaloneDir, "server.js");
    serverProcess = spawn(process.execPath, [serverEntry], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT,
        HOSTNAME: "localhost",
        // Chromium is downloaded on first scrape into a persistent, writable
        // per-user location (survives app updates; app resources are read-only).
        PLAYWRIGHT_BROWSERS_PATH: path.join(app.getPath("userData"), "ms-playwright"),
      },
      stdio: "ignore",
    });
  } else {
    // Dev/unpackaged: run the existing tsx server straight from source.
    const tsxBin = path.join(APP_ROOT, "node_modules", ".bin", isWin ? "tsx.cmd" : "tsx");
    serverProcess = spawn(tsxBin, ["server.ts"], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT,
        HOSTNAME: "localhost",
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
      shell: isWin, // .cmd shims on Windows must run through a shell
      stdio: "inherit",
    });
  }

  serverProcess.on("exit", (code) => {
    console.log(`[dataforge] server process exited with code ${code}`);
  });
}

/**
 * Is anything already accepting connections on this port?
 *
 * Checked BEFORE we spawn our own server, and deliberately not by asking the
 * responder who it is: another app's replies are not ours to predict. If we have
 * not started yet and something already answers, that alone is the collision.
 *
 * This is the failure it prevents. An unrelated Next app was left running on
 * 3000; our server child could not bind, and because packaged builds run it with
 * stdio "ignore" that failure was invisible. `waitForServer` then got an instant
 * reply from the stranger, and the window loaded THEIR app — surfacing only as
 * "a client-side exception has occurred while loading localhost", which points
 * nowhere near the real cause.
 *
 * Both loopback families are probed: two servers can hold the same port at once
 * when one binds IPv4 and the other IPv6, and which one a later `localhost`
 * lookup reaches is not something we should leave to resolution order.
 */
function isPortInUse(port, timeoutMs = 1500) {
  const probe = (host) => new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });

  return Promise.all([probe("127.0.0.1"), probe("::1")]).then((r) => r.some(Boolean));
}

/** Poll the server URL until it responds (or we time out). */
function waitForServer(url, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error("Timed out waiting for the DataForge server to start."));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

// Lightweight splash shown instantly while the local server boots, so the app
// feels like it launched immediately instead of a blank delay.
const SPLASH_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{height:100%;margin:0}
  body{background:#0a0a0a;color:#e5e7eb;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
  .box{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
  .brand{font-size:22px;font-weight:700;letter-spacing:-.01em}
  .sub{font-size:13px;color:#9ca3af;min-height:18px;transition:opacity .3s}
  .spinner{width:30px;height:30px;border:3px solid #1f2937;border-top-color:#3b82f6;
           border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div class="box"><div class="spinner"></div>
<div class="brand">DataForge</div><div class="sub" id="msg">Initializing…</div></div>
<script>
  var msgs=["Initializing…","Starting the server…","Waking the database…","Loading your workspace…","Almost ready…"];
  var i=0,el=document.getElementById("msg");
  setInterval(function(){i=(i+1)%msgs.length;el.style.opacity=0;
    setTimeout(function(){el.textContent=msgs[i];el.style.opacity=1;},250);},1900);
</script></body></html>`;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // reveal once the splash is painted (below)
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    title: "DataForge",
    icon: TRAY_ICON,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // External links (e.g. to Vercel, docs) open in the system browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Close → hide to tray (keep running in the background) unless the user
  // explicitly chose Quit from the tray menu.
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Open maximized (fills the screen; the 1400×900 above is the restore size).
  mainWindow.maximize();

  // Show the window instantly — the dark backgroundColor avoids a white flash —
  // then paint the loading splash. We do NOT await the server here, so the
  // window is on screen right away and the splash animates while things boot.
  mainWindow.show();
  timing("window shown");
  mainWindow.webContents.once("did-finish-load", () => timing("splash painted"));
  mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(SPLASH_HTML)).catch(() => {});

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** Show and focus the main window (recreating it if it was fully closed). */
function showWindow() {
  if (!mainWindow) {
    createWindow().then(async () => {
      try {
        await waitForServer(APP_URL);
        if (mainWindow) await mainWindow.loadURL(APP_URL);
      } catch { /* ignore */ }
    });
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Build the tray menu. Rebuilt (not built once) because the update item only appears
 * after an update has downloaded — Electron has no way to toggle an existing item's
 * visibility, so the whole menu is replaced.
 */
function buildTrayMenu() {
  const items = [
    { label: "Open DataForge", click: showWindow },
  ];

  if (isUpdateReady()) {
    items.push(
      { type: "separator" },
      {
        label: "Restart && update now",
        click: () => installNow(() => { isQuitting = true; stopServer(); }),
      },
      { label: "Update installs on quit", enabled: false },
    );
  }

  items.push(
    { type: "separator" },
    {
      label: "Quit DataForge",
      click: () => { isQuitting = true; app.quit(); },
    },
  );

  return Menu.buildFromTemplate(items);
}

/** Swap in a freshly built menu — called when an update finishes downloading. */
function refreshTrayMenu() {
  if (!tray) return;
  try {
    tray.setContextMenu(buildTrayMenu());
    tray.setToolTip(isUpdateReady() ? "DataForge — update ready" : "DataForge");
  } catch (err) {
    console.error("[dataforge] failed to refresh tray menu:", err);
  }
}

/**
 * An update finished downloading. Refresh the tray AND tell the renderer so the
 * in-app modal can appear.
 *
 * The send is best-effort by design: the window may be hidden in the tray, closed,
 * or still showing the splash. Anything that misses the push picks the same state
 * up from `updater:get-state` when it mounts, so there is no retry logic here.
 */
function handleUpdateStateChange() {
  refreshTrayMenu();
  try {
    mainWindow?.webContents.send("updater:ready", getUpdateState());
  } catch (err) {
    console.error("[dataforge] failed to notify renderer of update:", err);
  }
}

/**
 * Machine identity for the boss fleet view, computed once in the MAIN process.
 *
 * This used to live in preload.js. Preloads run SANDBOXED (webPreferences sets
 * contextIsolation and leaves `sandbox` at its default of true), and a sandboxed
 * preload cannot `require("os")` — it throws "module not found" and aborts the
 * ENTIRE preload, silently taking the whole `window.dataforgeDesktop` bridge with
 * it. That is exactly what was happening: every desktop install reported itself as
 * "web", with no device name and no LAN IP.
 *
 * Computing it here and passing it over IPC keeps the sandbox on.
 */
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

const DEVICE_INFO = {
  platform: process.platform,
  deviceName: (() => { try { return os.hostname(); } catch { return null; } })(),
  lanIp: firstLanIp(),
};

/**
 * IPC surface for the in-app update prompt — the app's only two channels.
 *
 * Both are deliberately narrow: one reads the small state object from updater.js,
 * the other performs the same user-initiated install the tray already offers. The
 * renderer gets no general-purpose bridge into the main process.
 */
function registerIpc() {
  // Synchronous on purpose: the preload exposes deviceName/lanIp as plain values,
  // which is the shape PresenceHeartbeat already reads. The payload is three short
  // strings computed once at startup, so the blocking round trip is negligible —
  // and making it async would mean changing every consumer.
  ipcMain.on("device:info", (event) => { event.returnValue = DEVICE_INFO; });

  ipcMain.handle("updater:get-state", () => getUpdateState());
  ipcMain.handle("updater:install-now", () => {
    // Identical to the tray's "Restart && update now": stop the server child first
    // so the scrape dies with us rather than outliving the app.
    installNow(() => { isQuitting = true; stopServer(); });
    return true;
  });
}

/** System-tray icon + menu so the app can live in the background. */
function createTray() {
  if (tray) return;
  try {
    const image = nativeImage.createFromPath(TRAY_ICON);
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
    tray.setToolTip("DataForge");
    tray.setContextMenu(buildTrayMenu());
    // Single click (Windows) / double-click opens the window.
    tray.on("click", showWindow);
    tray.on("double-click", showWindow);
  } catch (err) {
    console.error("[dataforge] failed to create tray:", err);
  }
}

/** Kill the server child (and its whole tree on Windows) on quit. */
function stopServer() {
  if (!serverProcess) return;
  try {
    if (process.platform === "win32" && serverProcess.pid) {
      spawn("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"]);
    } else {
      serverProcess.kill();
    }
  } catch (err) {
    console.error("[dataforge] failed to stop server:", err);
  }
  serverProcess = null;
}

// Single-instance lock. If DataForge is already running (e.g. hidden in the
// tray, still scraping), a second launch must NOT boot another server / double
// the running state — it hands off to the first instance and exits. The first
// instance gets the `second-instance` event and just surfaces its window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  showWindow();
});

if (gotSingleInstanceLock) app.whenReady().then(async () => {
  timing("app ready (Electron init done)");
  // IPC first, before any window exists: the preload runs as soon as a window is
  // created and asks for device info synchronously. Registering after createWindow()
  // would leave that first call unanswered.
  registerIpc();
  // Kick off the server AND show the splash window at the same time, so the
  // window appears instantly instead of after the server has finished booting.
  // Window FIRST so it paints instantly, then boot everything behind the splash.
  await createWindow();
  createTray();

  // Refuse to start on an occupied port rather than silently adopting whatever
  // is already there. ATTACH_MODE is exempt by definition — it exists to attach
  // to a server someone else started.
  let portConflict = false;
  if (!ATTACH_MODE) {
    portConflict = await isPortInUse(Number(PORT)).catch(() => false);
    if (portConflict) {
      const message =
        `Port ${PORT} is already in use by another application, so DataForge cannot ` +
        `start its own server.\n\nClose whatever is using port ${PORT} and launch ` +
        `DataForge again, or start DataForge with DATAFORGE_PORT set to a free port.`;
      console.error(`[dataforge] ${message}`);
      try { dialog.showErrorBox("DataForge could not start", message); } catch { /* never fatal */ }
    } else {
      startServer();
    }
  }
  timing("server spawn kicked off");

  // Auto-update runs behind everything else: the first check is delayed and the
  // module no-ops in dev and whenever the private feed is unreachable, so it can
  // never delay startup or a scrape.
  initUpdater(handleUpdateStateChange);

  // A conflicting port means anything answering on it is not ours, so do not
  // load it into the window — that is precisely how another app's UI ended up
  // inside DataForge. The splash stays up behind the error dialog.
  if (!portConflict) {
    try {
      await waitForServer(APP_URL);
      timing("server responding");
      // Swap the splash for the real app (guard in case the window was closed).
      if (mainWindow) await mainWindow.loadURL(APP_URL);
      timing("app URL loaded (usable)");
    } catch (err) {
      console.error("[dataforge]", err);
      // Packaged builds run the server with stdio "ignore", so a startup failure
      // is otherwise completely invisible — the window just sits on the splash.
      // Say what went wrong.
      try {
        dialog.showErrorBox("DataForge could not start", String(err?.message ?? err));
      } catch { /* a dialog must never be the thing that breaks startup */ }
    }
  }

  app.on("activate", () => {
    showWindow();
  });
});

// Do NOT quit when the window closes — the app lives in the tray and keeps the
// server (and any running scrapes) alive. Quitting happens via the tray menu.
app.on("window-all-closed", () => {
  /* stay running in the tray */
});

app.on("before-quit", () => {
  isQuitting = true;
  stopUpdater();
  stopServer();
});
