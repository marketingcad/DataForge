import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL!;
const isLocal = connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1");

const adapter = new PrismaPg(new Pool({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false } }));
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding boss account...");

  const bossEmail = "boss@dataforge.dev";
  const bossPassword = await bcrypt.hash("Password1234", 10);

  await prisma.user.upsert({
    where: { email: bossEmail },
    update: { role: "boss", password: bossPassword },
    create: { name: "Boss", email: bossEmail, password: bossPassword, role: "boss" },
  });

  console.log("Done. Boss account: boss@dataforge.dev / Password1234");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
