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

const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

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

/** System-tray icon + menu so the app can live in the background. */
function createTray() {
  if (tray) return;
  try {
    const image = nativeImage.createFromPath(TRAY_ICON);
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
    tray.setToolTip("DataForge");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open DataForge", click: showWindow },
      { type: "separator" },
      {
        label: "Quit DataForge",
        click: () => { isQuitting = true; app.quit(); },
      },
    ]));
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
  // Kick off the server AND show the splash window at the same time, so the
  // window appears instantly instead of after the server has finished booting.
  // Window FIRST so it paints instantly, then boot everything behind the splash.
  await createWindow();
  createTray();
  if (!ATTACH_MODE) startServer();
  timing("server spawn kicked off");

  try {
    await waitForServer(APP_URL);
    timing("server responding");
    // Swap the splash for the real app (guard in case the window was closed).
    if (mainWindow) await mainWindow.loadURL(APP_URL);
    timing("app URL loaded (usable)");
  } catch (err) {
    console.error("[dataforge]", err);
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
  stopServer();
});
