import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

(async () => {
  const user = await prisma.user.findUnique({
    where: { email: "boss@dataforge.dev" },
    select: { id: true, name: true, email: true, role: true, password: true },
  });

  if (!user) {
    console.log("❌ User boss@dataforge.dev does not exist.");
    return;
  }

  console.log("✅ Found:", { id: user.id, name: user.name, email: user.email, role: user.role, hasPassword: !!user.password });

  const valid = await bcrypt.compare("Password1234", user.password ?? "");
  console.log("Password match:", valid ? "✅ YES" : "❌ NO");

  await prisma.$disconnect();
})();
