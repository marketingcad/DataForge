/**
 * The running build's version, inlined at build time from package.json by
 * next.config.ts (NEXT_PUBLIC_APP_VERSION).
 *
 * Single source of truth: the same field electron-builder packages into the
 * desktop installer and the release workflow asserts against the git tag. Do not
 * hardcode a version anywhere in the UI — a stale literal is exactly how the
 * sidebar ended up claiming "v1.0" while the app was on 0.2.1.
 *
 * Falls back to "dev" when the env var is absent (e.g. a bare `next dev` started
 * without the config, or a test harness).
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
