import dotenvLocal from "dotenv";
dotenvLocal.config({ path: ".env.local" });
dotenvLocal.config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL!;
const isLocal =
  connectionString?.includes("localhost") ||
  connectionString?.includes("127.0.0.1") ||
  connectionString?.includes("sslmode=disable");

const pool = new Pool({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  console.log("DB host:", connectionString?.replace(/:[^:@]+@/, ":***@"));

  const hashed = await bcrypt.hash("Password1234", 12);
  const user = await prisma.user.upsert({
    where: { email: "boss@dataforge.dev" },
    update: { password: hashed, role: "boss" },
    create: { name: "Boss", email: "boss@dataforge.dev", password: hashed, role: "boss" },
    select: { id: true, name: true, email: true, role: true },
  });
  console.log("✅ Boss account ready:", user);
  await prisma.$disconnect();
})();
