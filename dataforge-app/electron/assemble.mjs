// Post-build assembly for the desktop package.
//
// `next build` with output:"standalone" produces .next/standalone with a
// self-contained server.js + traced node_modules, but Next intentionally does
// NOT copy the static assets or /public — we must. We also copy the local
// Playwright Chromium into the bundle so scraping works with no separate install.
//
// Run AFTER `BUILD_TARGET=desktop next build`, BEFORE electron-builder.

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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

// 3. Playwright Chromium — copy the installed browser so the packaged app
//    doesn't need `npx playwright install`. We bundle chromium + headless shell
//    + ffmpeg from the user's ms-playwright cache.
const pwCache = join(homedir(), "AppData", "Local", "ms-playwright");
const pwDest = join(STANDALONE, "playwright-browser");
if (existsSync(pwCache)) {
  mkdirSync(pwDest, { recursive: true });
  for (const entry of readdirSync(pwCache)) {
    // Bundle only what the scraper uses; skip the MCP/chrome extras.
    if (/^(chromium|ffmpeg)/i.test(entry)) {
      cpSync(join(pwCache, entry), join(pwDest, entry), { recursive: true });
      console.log(`✓ copied playwright/${entry}`);
    }
  }
} else {
  console.warn("⚠ ms-playwright cache not found — scraping won't work until browsers are bundled.");
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
