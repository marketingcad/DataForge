// Post-build assembly for the desktop package.
//
// `next build` with output:"standalone" produces .next/standalone with a
// self-contained server.js + traced node_modules, but Next intentionally does
// NOT copy the static assets or /public — we must. Chromium is NOT bundled anymore
// (it's downloaded on first scrape, see main.js + core.ts ensureChromiumInstalled);
// we only ensure the Playwright install machinery is present.
//
// Run AFTER `BUILD_TARGET=desktop next build`, BEFORE electron-builder.

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STANDALONE = join(ROOT, ".next", "standalone");

if (!existsSync(STANDALONE)) {
  console.error("✗ .next/standalone not found. Run `BUILD_TARGET=desktop next build` first.");
  process.exit(1);
}

// 1. Static assets (hashed JS/CSS) — required or the app loads blank.
const staticSrc = join(ROOT, ".next", "static");
const staticDest = join(STANDALONE, ".next", "static");
mkdirSync(join(STANDALONE, ".next"), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
console.log("✓ copied .next/static");

// 2. /public assets.
const publicSrc = join(ROOT, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(STANDALONE, "public"), { recursive: true });
  console.log("✓ copied public/");
}

// 3. Playwright install machinery (NOT the browser).
//    We no longer bundle the ~650 MB Chromium — it's downloaded on first scrape
//    into a per-user location (see main.js PLAYWRIGHT_BROWSERS_PATH + the scraper's
//    ensureChromiumInstalled). That keeps the installer ~60% smaller and removes the
//    disk-space wall when packaging. But we MUST ensure the full `playwright` and
//    `playwright-core` packages (which contain the install CLI + browser fetcher)
//    are present in the bundle, since Next's tracer can miss the CLI's dynamic requires.
for (const pkg of ["playwright", "playwright-core"]) {
  const src = join(ROOT, "node_modules", pkg);
  if (existsSync(src)) {
    cpSync(src, join(STANDALONE, "node_modules", pkg), { recursive: true });
    console.log(`✓ ensured node_modules/${pkg} (install machinery)`);
  } else {
    console.warn(`⚠ node_modules/${pkg} not found — first-run browser download may fail.`);
  }
}

// 4. Env file so the packaged app can reach the database.
//    ⚠ SECURITY: this embeds your DB connection string in the shipped app.
//    Fine for a trusted internal team; do NOT distribute publicly.
for (const envName of [".env.local", ".env"]) {
  const src = join(ROOT, envName);
  if (existsSync(src)) {
    cpSync(src, join(STANDALONE, envName));
    console.log(`✓ copied ${envName}`);
    break;
  }
}

console.log("\n✓ assembly complete — .next/standalone is ready to package.");
