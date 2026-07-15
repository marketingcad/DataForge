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

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

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
        // Point Playwright at the Chromium we bundled during assembly.
        PLAYWRIGHT_BROWSERS_PATH: path.join(standaloneDir, "playwright-browser"),
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

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // reveal only once the app has loaded, to avoid a white flash
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    title: "DataForge",
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

  await mainWindow.loadURL(APP_URL);
  mainWindow.show();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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

app.whenReady().then(async () => {
  if (!ATTACH_MODE) startServer();
  try {
    await waitForServer(APP_URL);
  } catch (err) {
    console.error("[dataforge]", err);
  }
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopServer);
