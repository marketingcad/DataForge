// electron-builder afterPack hook.
//
// We copy the assembled Next standalone bundle into the packaged app's
// resources/ folder here, using a plain recursive file copy. electron-builder's
// own `extraResources` globbing skips dot-directories (and the bundle is full of
// them: `.next/`, `.env.local`), which silently left the server out of the app.
// A direct cpSync copies EVERYTHING, dotfiles included.

const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

exports.default = async function afterPack(context) {
  const src = join(process.cwd(), ".next", "standalone");
  const dest = join(context.appOutDir, "resources", "standalone");

  if (!existsSync(src)) {
    throw new Error(
      `[afterPack] .next/standalone not found — run "npm run desktop:build-web && npm run desktop:assemble" before packaging.`
    );
  }

  cpSync(src, dest, { recursive: true });
  console.log(`[afterPack] copied standalone bundle -> ${dest}`);
};
