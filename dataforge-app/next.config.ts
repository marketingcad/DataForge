import type { NextConfig } from "next";

// Desktop (Electron) build is opt-in via BUILD_TARGET=desktop so the normal
// Vercel build is completely unaffected.
const isDesktop = process.env.BUILD_TARGET === "desktop";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    // Desktop server runs these directly from node_modules (not bundled by Next).
    ...(isDesktop ? ["@prisma/adapter-pg", "pg", "playwright", "playwright-core"] : []),
  ],
  ...(isDesktop
    ? {
        // Emit a self-contained server + traced node_modules under .next/standalone
        // so the Electron app can run it without the full project tree.
        output: "standalone",
        // Pin the tracing root to THIS project. Without this, Next walks up and can
        // pick a parent folder as the root (e.g. a stray C:\Users\<you>\package.json),
        // which makes it recreate the whole path under .next/standalone and blow past
        // the Windows path-length limit (EINVAL copyfile errors).
        outputFileTracingRoot: process.cwd(),
        // The generated Prisma client is imported dynamically enough that the tracer
        // can miss files — include the whole folder to be safe.
        outputFileTracingIncludes: {
          "*": ["./src/generated/prisma/**/*"],
        },
      }
    : {}),
};

export default nextConfig;
