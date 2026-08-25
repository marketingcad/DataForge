import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/normalize";

/**
 * Local copy of the existing lead keys (business names + phone numbers), kept on disk
 * so the desktop app can check "have we seen this business?" without pulling the table.
 *
 * This is a scraping-cost optimisation, NOT the uniqueness guarantee. It only drives the
 * scraper's early skip — deciding whether to open a business's detail page. Uniqueness is
 * enforced at write time by checkDuplicate() and by the Lead_phone_normalized_key unique
 * index, so a stale cache can only cost a wasted page open; it can never create a
 * duplicate row.
 *
 * How it works
 *   1. First use loads the local copy from disk, then asks the database only for leads
 *      added since that copy was last synced (a delta of a few KB).
 *   2. Every unique lead this process inserts is appended locally by rememberLead().
 *   3. Later jobs re-sync the delta, so leads added by *other* users and devices show up
 *      within one job instead of only after a restart. DataForge is scraped by several
 *      people at once, so a snapshot frozen at process start goes stale quickly.
 *   4. The whole copy is rebuilt from scratch once a day.
 *
 * Why the daily rebuild is not optional: leads are hard-deleted in several places
 * (leads.actions.ts, the lead API route). A persisted copy would otherwise keep deleted
 * names forever and — because the copy drives the early skip — silently skip those
 * businesses on every future scrape.
 *
 * Why this replaced a per-job full fetch: that query was ~7.6 MB on the wire at 130k
 * leads and ran once per scraping job. With auto-run looping it became the app's dominant
 * source of Supabase egress (~86 GB in one billing cycle against a 5 GB quota), and it
 * grew with the table, so the cost scaled quadratically with the lead count.
 */

export type DedupCache = {
  /** lower-cased, trimmed business names */
  skipNames: Set<string>;
  /** digits-only phone numbers */
  knownPhones: Set<string>;
};

type CacheFile = {
  version: number;
  /** ISO timestamp: every lead with dateCollected <= this is already in the sets. */
  lastSync: string;
  /** ISO timestamp of the last full rebuild, used to expire deleted leads. */
  builtAt: string;
  names: string[];
  phones: string[];
};

const FILE_VERSION = 1;

/** Re-sync the delta if the in-memory copy is older than this (ms). */
const REFRESH_MS = Math.max(0, Number(process.env.DEDUP_REFRESH_MS) || 60_000);

/** Rebuild the whole copy from the database when it is older than this (ms). */
const FULL_REBUILD_MS = Math.max(0, Number(process.env.DEDUP_REBUILD_MS) || 24 * 60 * 60 * 1000);

/**
 * Re-read a little before lastSync on each delta. Concurrent inserts can commit with a
 * dateCollected slightly behind a timestamp we have already observed, and a strict
 * cursor would skip those rows permanently.
 */
const OVERLAP_MS = 5 * 60 * 1000;

/** Serverless containers have no durable disk and are recycled constantly. */
const PERSIST = !process.env.VERCEL && process.env.DEDUP_CACHE_PERSIST !== "0";

function cacheFile(): string {
  const dir =
    process.env.DEDUP_CACHE_DIR ||
    path.join(process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(), "DataForge", "cache");
  return path.join(dir, "lead-dedup-cache.json");
}

let cache: DedupCache | null = null;
let lastSync: Date | null = null;
let builtAt: Date | null = null;
let syncedAt = 0;
/** In-flight load/refresh, so concurrent jobs in one process share the work. */
let inflight: Promise<DedupCache> | null = null;
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------- disk

function readFromDisk(): CacheFile | null {
  if (!PERSIST) return null;
  try {
    const raw = fs.readFileSync(cacheFile(), "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed.version !== FILE_VERSION || !Array.isArray(parsed.names) || !Array.isArray(parsed.phones)) {
      return null;
    }
    return parsed;
  } catch {
    return null; // missing, unreadable or corrupt — treated as "no local copy"
  }
}

function writeToDisk(): void {
  if (!PERSIST || !cache || !lastSync || !builtAt) return;
  const file = cacheFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const payload: CacheFile = {
      version: FILE_VERSION,
      lastSync: lastSync.toISOString(),
      builtAt: builtAt.toISOString(),
      names: [...cache.skipNames],
      phones: [...cache.knownPhones],
    };
    // Write-then-rename so a crash mid-write cannot leave a truncated cache behind.
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, file);
    dirty = false;
  } catch {
    /* a cache we cannot persist is still correct in memory — never fail a scrape for it */
  }
}

/** Persist soon, coalescing the bursts of appends that happen while a job inserts leads. */
function scheduleFlush(): void {
  if (!PERSIST) return;
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (dirty) writeToDisk();
  }, 10_000);
  flushTimer.unref?.();
}

/** Write any pending appends immediately (called on shutdown). */
export function flushDedupCache(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (dirty) writeToDisk();
}

// ---------------------------------------------------------------- database

type KeyRow = { businessName: string; phone: string };

function addRows(target: DedupCache, rows: KeyRow[]): void {
  for (const r of rows) {
    const name = r.businessName?.toLowerCase().trim();
    if (name) target.skipNames.add(name);
    if (r.phone) target.knownPhones.add(r.phone);
  }
}

/** Every lead key in the table. Only used for the initial build and the daily rebuild. */
async function fullLoad(): Promise<DedupCache> {
  const rows = await prisma.lead.findMany({ select: { businessName: true, phone: true } });
  const built: DedupCache = { skipNames: new Set(), knownPhones: new Set() };
  addRows(built, rows);
  const now = new Date();
  cache = built;
  lastSync = now;
  builtAt = now;
  syncedAt = Date.now();
  scheduleFlush();
  return built;
}

/** Only the leads added since the last sync — a few KB in normal operation. */
async function deltaLoad(target: DedupCache): Promise<DedupCache> {
  const since = new Date((lastSync?.getTime() ?? 0) - OVERLAP_MS);
  const rows = await prisma.lead.findMany({
    where: { dateCollected: { gt: since } },
    select: { businessName: true, phone: true },
  });
  addRows(target, rows);
  cache = target;
  lastSync = new Date();
  syncedAt = Date.now();
  if (rows.length) scheduleFlush();
  return target;
}

// ---------------------------------------------------------------- public API

/**
 * Get the dedup key sets, loading the local copy and syncing the delta as needed.
 * Concurrent callers share one round trip.
 */
export async function getDedupCache(): Promise<DedupCache> {
  if (cache && Date.now() - syncedAt < REFRESH_MS) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    // Already loaded in this process: refresh the delta, and rebuild if it is a day old.
    if (cache) {
      const stale = FULL_REBUILD_MS > 0 && builtAt && Date.now() - builtAt.getTime() > FULL_REBUILD_MS;
      return stale ? fullLoad() : deltaLoad(cache);
    }

    // Cold start: try the local copy on disk first.
    const onDisk = readFromDisk();
    if (onDisk) {
      const age = Date.now() - new Date(onDisk.builtAt).getTime();
      if (!(FULL_REBUILD_MS > 0 && age > FULL_REBUILD_MS)) {
        const restored: DedupCache = {
          skipNames: new Set(onDisk.names),
          knownPhones: new Set(onDisk.phones),
        };
        lastSync = new Date(onDisk.lastSync);
        builtAt = new Date(onDisk.builtAt);
        return deltaLoad(restored);
      }
      // Older than the rebuild window: fall through and rebuild so deleted leads
      // stop being skipped.
    }
    return fullLoad();
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Record a lead this process just inserted, so the rest of the run skips it without
 * another round trip and it survives into the local copy on disk.
 */
export function rememberLead(businessName?: string | null, phone?: string | null): void {
  if (!cache) return;
  let changed = false;
  const name = businessName?.toLowerCase().trim();
  if (name && !cache.skipNames.has(name)) {
    cache.skipNames.add(name);
    changed = true;
  }
  if (phone) {
    const p = normalizePhone(phone);
    if (p && !cache.knownPhones.has(p)) {
      cache.knownPhones.add(p);
      changed = true;
    }
  }
  if (changed) scheduleFlush();
}

/** Drop the cache (memory and disk) so the next getDedupCache() rebuilds from scratch. */
export function invalidateDedupCache(): void {
  cache = null;
  lastSync = null;
  builtAt = null;
  syncedAt = 0;
  dirty = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!PERSIST) return;
  try {
    fs.rmSync(cacheFile(), { force: true });
  } catch {
    /* nothing to remove */
  }
}

/** Diagnostics for the settings/fleet UI. */
export function dedupCacheStatus() {
  return {
    loaded: !!cache,
    names: cache?.skipNames.size ?? 0,
    phones: cache?.knownPhones.size ?? 0,
    lastSync: lastSync?.toISOString() ?? null,
    builtAt: builtAt?.toISOString() ?? null,
    persisted: PERSIST ? cacheFile() : null,
  };
}
