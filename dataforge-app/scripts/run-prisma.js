const { execSync } = require("child_process");
const path = require("path");

process.chdir(path.join(__dirname, ".."));
console.log("CWD:", process.cwd());

try {
  console.log("\n--- db push ---");
  const push = execSync("node node_modules/prisma/build/index.js db push --accept-data-loss", {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  console.log(push);
} catch (e) {
  console.error("db push error:", e.stdout, e.stderr);
}

try {
  console.log("\n--- generate ---");
  const gen = execSync("node node_modules/prisma/build/index.js generate", {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  console.log(gen);
} catch (e) {
  console.error("generate error:", e.stdout, e.stderr);
}
