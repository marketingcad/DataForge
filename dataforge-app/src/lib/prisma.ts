import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Bump this string any time you run prisma migrate (adds/removes models).
// This forces a new client in dev hot-reload scenarios.
const CLIENT_VERSION = "v8-kanban-comments-notifications";

function createPrismaClient() {
  const connectionString =
    process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL!;
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
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
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    const isTimeout =
      msg.includes("timeout") ||
      msg.includes("connect") ||
      msg.includes("econnrefused") ||
      msg.includes("socket");
    if (!isTimeout) throw err;
    // Wait briefly then try once more
    await new Promise((r) => setTimeout(r, 2000));
    return await fn();
  }
}
