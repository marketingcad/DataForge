// DataForge desktop auto-update.
//
// Installers are published to a PRIVATE GitHub repo (marketingcad/DataForge-releases),
// not to the app's own repo, because that one is public and `electron/assemble.mjs`
// bakes .env into the packaged app. A public release asset would put the database
// connection string, the Supabase service-role key and AUTH_SECRET on an
// unauthenticated URL. See CLAUDE.md C9.
//
// Reaching a private feed needs a token, so the installer carries one:
// UPDATE_FEED_TOKEN, a fine-grained PAT scoped to `contents: read` on the releases
// repo and nothing else. It is still a secret in a shipped artifact — but its blast
// radius is "can download DataForge installers", not "owns the database". It cannot
// be rotated without shipping a new build, so treat it as long-lived and keep its
// scope minimal.
//
// UX contract (see LOOP.md / docs/OPERATIONS.md): download silently, notify, install
// on quit. NEVER restart the app on its own — a scrape may be running in the tray,
// and killing it mid-job leaves a ScrapingJob row frozen at "running" until the
// 3-minute reaper catches it.

const { app, Notification, shell } = require("electron");

// Check this soon after launch, then on a slow timer. A desktop instance often runs
// for days, so without the interval the launch check is the only one that ever fires.
const FIRST_CHECK_DELAY_MS = 30 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h

let autoUpdater = null;
let updateReady = false;
let checkTimer = null;
/** Called after an update finishes downloading, so main.js can refresh the tray menu. */
let onStateChange = () => {};

function log(...args) {
  console.log("[dataforge:updater]", ...args);
}

/**
 * Load electron-updater lazily.
 *
 * Kept out of the module's top-level require so a missing/broken dependency degrades
 * to "no auto-update" instead of preventing the app from starting. The desktop app's
 * job is to run scrapes; failing to check for updates must never cost a launch.
 */
function loadUpdater() {
  if (autoUpdater) return autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (err) {
    log("electron-updater unavailable — auto-update disabled:", err.message);
    return null;
  }

  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
  // We drive the restart from the tray; never seize the app ourselves.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const token = process.env.UPDATE_FEED_TOKEN;
  if (token) {
    // electron-updater reads GH_TOKEN for private GitHub feeds. We accept it under
    // our own name so the baked .env doesn't carry a variable name that looks like a
    // general-purpose GitHub token with write scope.
    process.env.GH_TOKEN = token;
  } else {
    log("UPDATE_FEED_TOKEN not set — private update feed unreachable, updates disabled");
    return null;
  }

  return autoUpdater;
}

function notify(title, body) {
  try {
    if (!Notification.isSupported()) return;
    new Notification({ title, body, silent: true }).show();
  } catch {
    /* notifications are a nicety — never fail the app for one */
  }
}

/**
 * Wire up auto-update. Safe to call once, after the tray exists.
 * @param {() => void} stateChangeCallback re-render the tray menu when an update lands
 */
function initUpdater(stateChangeCallback) {
  if (!app.isPackaged) {
    log("dev build — auto-update skipped");
    return;
  }
  if (typeof stateChangeCallback === "function") onStateChange = stateChangeCallback;

  const updater = loadUpdater();
  if (!updater) return;

  updater.on("update-available", (info) => {
    log(`update available: ${info?.version} (downloading in background)`);
  });

  updater.on("update-not-available", () => {
    log("already up to date");
  });

  updater.on("update-downloaded", (info) => {
    updateReady = true;
    log(`update ${info?.version} downloaded — will install on quit`);
    notify(
      "DataForge update ready",
      `Version ${info?.version} installs when you quit. Use the tray menu to restart now — ` +
        `any running scrape will be stopped.`
    );
    onStateChange();
  });

  updater.on("error", (err) => {
    // Offline, feed unreachable, token expired, rate-limited — all non-fatal.
    log("update check failed:", err?.message ?? err);
  });

  const check = () => {
    updater.checkForUpdates().catch((err) => log("check threw:", err?.message ?? err));
  };

  setTimeout(check, FIRST_CHECK_DELAY_MS).unref?.();
  checkTimer = setInterval(check, CHECK_INTERVAL_MS);
  checkTimer.unref?.();
}

/** True once an update is downloaded and waiting. Drives the tray menu item. */
function isUpdateReady() {
  return updateReady;
}

/**
 * Install now, at the user's explicit request from the tray.
 *
 * This DOES stop a running scrape. That is acceptable only because the user asked:
 * the job's row goes stale and the cron (web) or the auto-loop (desktop) reaps it
 * after 3 minutes, so nothing is permanently stuck — it just has to be re-run.
 * @param {() => void} beforeQuit let main.js set isQuitting and stop the server child
 */
function installNow(beforeQuit) {
  if (!updateReady || !autoUpdater) return;
  try {
    if (typeof beforeQuit === "function") beforeQuit();
    // isSilent=false shows the installer UI; isForceRunAfter=true reopens the app.
    autoUpdater.quitAndInstall(false, true);
  } catch (err) {
    log("quitAndInstall failed:", err?.message ?? err);
    // Last resort: send them somewhere they can grab the installer by hand.
    shell.openExternal("https://github.com/marketingcad/DataForge-releases/releases/latest").catch(() => {});
  }
}

function stopUpdater() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

module.exports = { initUpdater, isUpdateReady, installNow, stopUpdater };
