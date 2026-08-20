import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    console.log("No users in database at all.");
    return;
  }

  console.log("All users:");
  users.forEach((u) => console.log(" -", u.email, "|", u.name));

  const user = users.find(
    (u) =>
      u.email?.toLowerCase().includes("justin") ||
      u.name?.toLowerCase().includes("justin")
  );

  if (!user) {
    console.log("\nNo user matching 'justin' found.");
    return;
  }

  console.log("\nUpdating password for:", user.email);
  const hashed = await bcrypt.hash("Password1234", 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  console.log("Password updated.");
  await prisma.$disconnect();
})();
