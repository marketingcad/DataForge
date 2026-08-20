import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listGhlAgents } from "@/lib/ghl/client";

const ALLOWED_ROLES = ["boss", "admin"];

export async function GET() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.ghlApiKey || !settings?.ghlLocationId) {
    return NextResponse.json({ agents: [], configured: false });
  }

  const { agents, debug } = await listGhlAgents(settings.ghlApiKey, settings.ghlLocationId);

  // Also fetch which ghlUserIds are already linked to a DataForge user
  const linked = await prisma.user.findMany({
    where: { ghlUserId: { not: null } },
    select: { ghlUserId: true },
  });
  const linkedIds = new Set(linked.map((u) => u.ghlUserId));

  return NextResponse.json({
    configured: true,
    agents: agents.map((a) => ({ ...a, alreadyLinked: linkedIds.has(a.id) })),
    debug,
  });
}
