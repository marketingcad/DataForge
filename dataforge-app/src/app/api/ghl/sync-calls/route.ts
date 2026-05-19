import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoSyncGhlCalls } from "@/lib/ghl/sync";

const ALLOWED_ROLES = ["boss", "admin"];
const PAGES_PER_BATCH = 20; // ~2000 conversations per call, well within Vercel 60s limit

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
    if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as {
      cursor?: number;
      forceReset?: boolean;
    };

    // forceReset: clear ghlCallsLastSyncedAt so we pull from the very beginning
    if (body.forceReset) {
      await prisma.appSettings.update({
        where: { id: "singleton" },
        data: { ghlCallsLastSyncedAt: null },
      });
    }

    const result = await autoSyncGhlCalls(true, {
      maxPages: PAGES_PER_BATCH,
      startAfterDate: body.cursor,
    });

    if (result.noAgents) {
      return NextResponse.json({
        synced: 0,
        skipped: 0,
        unmatched: 0,
        total: 0,
        done: true,
        noAgents: true,
        message: "No DataForge users are linked to a GHL User ID. Go to Admin → Users and set each agent's GHL User ID.",
      });
    }

    const done = result.nextCursor == null;

    // Stamp the last-synced timestamp only when the full sync is complete
    if (done) {
      await prisma.appSettings.update({
        where: { id: "singleton" },
        data: { ghlCallsLastSyncedAt: new Date() },
      });
    }

    return NextResponse.json({
      synced: result.synced,
      skipped: result.skipped,
      unmatched: result.unmatched,
      total: result.total,
      done,
      nextCursor: result.nextCursor ?? null,
    });
  } catch (err) {
    console.error("[ghl/sync-calls]", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
