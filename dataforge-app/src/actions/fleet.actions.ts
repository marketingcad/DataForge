"use server";

import { requireRole } from "@/lib/rbac/guards";
import { prisma } from "@/lib/prisma";
import { hasFullKeywordAccess, getGrantedKeywordIds } from "@/lib/keywords/access";

// An instance is "online" if it has beaten within this window.
const ONLINE_MS = 30_000;

export type FleetKeyword = {
  id: string;
  keyword: string;
  location: string;
  autoRun: boolean;
  jobStatus: string | null;
  leads: number;
};

export type FleetInstance = {
  deviceId: string;
  userName: string | null;
  userEmail: string | null;
  role: string;
  kind: string;          // "web" | "desktop"
  deviceName: string | null;
  lastSeen: string;      // ISO
  keywords: FleetKeyword[];
};

/**
 * Boss-only. Returns every currently-online instance, the account logged into it,
 * and the keywords that account can access (with live auto-run + job status). The
 * boss uses this to see who's scraping what — and later to remote start/stop.
 */
export async function getFleetAction(): Promise<{ instances: FleetInstance[] }> {
  await requireRole("boss");

  const since = new Date(Date.now() - ONLINE_MS);
  const instances = await prisma.appInstance.findMany({
    where: { lastSeen: { gte: since } },
    orderBy: { lastSeen: "desc" },
  });

  // Cache keyword lookups per user so multiple devices for the same user don't re-query.
  const cache = new Map<string, FleetKeyword[]>();

  async function keywordsForUser(userId: string, role: string): Promise<FleetKeyword[]> {
    const cacheKey = `${role}:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const where = hasFullKeywordAccess(role)
      ? {}
      : { id: { in: await getGrantedKeywordIds(userId) } };

    const rows = await prisma.scrapingKeyword.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        keyword: true,
        location: true,
        autoRun: true,
        jobs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
        _count: { select: { leads: true } },
      },
    });

    const mapped: FleetKeyword[] = rows.map((k) => ({
      id: k.id,
      keyword: k.keyword,
      location: k.location,
      autoRun: k.autoRun,
      jobStatus: k.jobs[0]?.status ?? null,
      leads: k._count.leads,
    }));
    cache.set(cacheKey, mapped);
    return mapped;
  }

  const result: FleetInstance[] = [];
  for (const inst of instances) {
    result.push({
      deviceId: inst.id,
      userName: inst.userName,
      userEmail: inst.userEmail,
      role: inst.role,
      kind: inst.kind,
      deviceName: inst.deviceName,
      lastSeen: inst.lastSeen.toISOString(),
      keywords: await keywordsForUser(inst.userId, inst.role),
    });
  }

  return { instances: result };
}

/**
 * Boss-only. Queue a start/stop command for a keyword on a specific device. The
 * target device picks it up on its next heartbeat and runs it locally. Validated
 * so the boss can only command keywords the device's own account can access.
 */
export async function issueRemoteCommandAction(
  deviceId: string,
  keywordId: string,
  action: "start" | "stop"
): Promise<{ ok: true } | { error: string }> {
  const boss = await requireRole("boss");

  const inst = await prisma.appInstance.findUnique({ where: { id: deviceId } });
  if (!inst) return { error: "Device is not online." };

  // The command must target a keyword the device's own account can access.
  if (!hasFullKeywordAccess(inst.role)) {
    const granted = await getGrantedKeywordIds(inst.userId);
    if (!granted.includes(keywordId)) return { error: "That account can't access this keyword." };
  }

  await prisma.remoteCommand.create({
    data: { targetDeviceId: deviceId, keywordId, action, createdById: boss.id },
  });

  return { ok: true };
}
