import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Bump this string any time you run prisma migrate (adds/removes models).
// This forces a new client in dev hot-reload scenarios.
const CLIENT_VERSION = "v26-pool-tuning";

function createPrismaClient() {
  const connectionString =
    process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL!;
  const isNeon = connectionString?.includes("neon.tech");

  if (isNeon) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  }

  // Standard Postgres (Supabase, local, etc.) — use pg Pool with SSL for remote
  const isLocal =
    connectionString?.includes("localhost") ||
    connectionString?.includes("127.0.0.1") ||
    connectionString?.includes("sslmode=disable") ||
    connectionString?.includes("sslmode=prefer");
  // Pool tuning for a slow/lossy link to the Supabase pooler. Establishing a TCP
  // connection to ap-southeast-1 measures 0.5–2.7s from some networks, and pg's
  // default idleTimeoutMillis is only 10s — so connections were being thrown away
  // and re-dialled constantly, turning ordinary page loads into ETIMEDOUT errors.
  // Holding connections open and reusing them removes almost all of that cost.
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    // Keep warm connections instead of re-dialling every 10 seconds.
    idleTimeoutMillis: isLocal ? 10_000 : 60_000,
    // TCP keepalive stops idle connections being silently dropped in between.
    keepAlive: !isLocal,
    keepAliveInitialDelayMillis: 10_000,
    // Cold connects over a degraded path can take seconds, and pages like the
    // profile issue 12 queries in one Promise.all — every one wanting its own
    // connection at the same moment. Too short a budget here surfaced as
    // "timeout exceeded when trying to connect" even with withDbRetry.
    connectionTimeoutMillis: isLocal ? 0 : 30_000,
    // Must comfortably exceed the widest Promise.all in the app (12) while staying
    // well under the server's max_connections (60, 3 reserved for superuser).
    max: isLocal ? 10 : 15,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaVersion: string | undefined;
}

// In dev, bust the singleton whenever the client version changes.
if (global.__prismaVersion !== CLIENT_VERSION) {
  global.__prisma = undefined;
  global.__prismaVersion = CLIENT_VERSION;
}

export const prisma: PrismaClient =
  global.__prisma ?? (global.__prisma = createPrismaClient());

/**
 * Retries a database operation once on connection timeout.
 * Neon free-tier cold starts can exceed the first connect_timeout window —
 * a single retry is usually enough for the DB to finish waking up.
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Prisma P2xxx codes are query/data errors — retrying won't help.
    const code = (err as { code?: string })?.code;
    if (typeof code === "string" && code.startsWith("P2")) throw err;

    // Everything else (cold-start timeouts, WebSocket ErrorEvents from Neon,
    // ECONNREFUSED, socket hangs) is likely transient — retry once.
    await new Promise((r) => setTimeout(r, 300));
    return await fn();
  }
}
