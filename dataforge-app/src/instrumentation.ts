// Runs once when the Next.js server starts — in dev, on Vercel, AND in the
// packaged desktop (standalone) server. We use it to WARM the database
// connection immediately at boot, so the first page's query doesn't pay the
// full cold-start (e.g. a serverless/Neon database waking from idle).
//
// IMPORTANT: Next.js AWAITS register() before the server starts accepting
// requests. So we must NOT await the DB query here — doing so would block the
// whole server (and the desktop window) behind the Supabase SSL handshake +
// query, making startup slower. Instead we kick the warm-up off in the
// background (fire-and-forget) so the server is ready instantly and the DB
// connection warms up in parallel while the first screen renders.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Deliberately NOT awaited — warm the connection in the background.
  void (async () => {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // Ignore — the first real query has its own retry (withDbRetry).
    }
  })();
}
