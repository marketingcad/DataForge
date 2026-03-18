import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Bump this string any time you run prisma migrate (adds/removes models).
// This forces a new client in dev hot-reload scenarios.
const CLIENT_VERSION = "v5-user-roles";

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
