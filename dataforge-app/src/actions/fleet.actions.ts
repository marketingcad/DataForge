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
  ipAddress: string | null;
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

  // Cache the accessible-keyword LIST per user (device-independent). The scraping
  // status is computed per device below, since a keyword can be scraped on one
  // device but not another.
  type BaseKeyword = { id: string; keyword: string; location: string; autoRun: boolean; leads: number };
  const cache = new Map<string, BaseKeyword[]>();

  async function keywordsForUser(userId: string, role: string): Promise<BaseKeyword[]> {
    const cacheKey = `${role}:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const where = hasFullKeywordAccess(role) ? {} : { id: { in: await getGrantedKeywordIds(userId) } };
    const rows = await prisma.scrapingKeyword.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: { id: true, keyword: true, location: true, autoRun: true, _count: { select: { leads: true } } },
    });
    const mapped = rows.map((k) => ({
      id: k.id, keyword: k.keyword, location: k.location, autoRun: k.autoRun, leads: k._count.leads,
    }));
    cache.set(cacheKey, mapped);
    return mapped;
  }

  // Running jobs that aren't tagged to any device yet (legacy runs, cron runs, or
  // scrapers on an app build from before device tagging). We surface these so the
  // boss can still SEE active scraping; once devices run the tagged build, their
  // jobs attribute precisely to the right card instead.
  const untaggedJobs = await prisma.scrapingJob.findMany({
    where: { deviceId: null, status: { in: ["running", "pending"] }, keywordId: { not: null } },
    select: { keywordId: true },
  });
  const untaggedScraping = new Set(untaggedJobs.map((j) => j.keywordId).filter(Boolean) as string[]);

  const result: FleetInstance[] = [];
  for (const inst of instances) {
    const base = await keywordsForUser(inst.userId, inst.role);

    // Keywords actively being scraped BY THIS device (job tagged with its deviceId)…
    const runningJobs = await prisma.scrapingJob.findMany({
      where: { deviceId: inst.id, status: { in: ["running", "pending"] } },
      select: { keywordId: true },
    });
    const scrapingHere = new Set(runningJobs.map((j) => j.keywordId).filter(Boolean) as string[]);
    // …plus untagged running jobs the device's account can access, so nothing is invisible.
    untaggedScraping.forEach((id) => scrapingHere.add(id));

    result.push({
      deviceId: inst.id,
      userName: inst.userName,
      userEmail: inst.userEmail,
      role: inst.role,
      kind: inst.kind,
      deviceName: inst.deviceName,
      ipAddress: inst.ipAddress,
      lastSeen: inst.lastSeen.toISOString(),
      keywords: base.map((k) => ({
        ...k,
        jobStatus: scrapingHere.has(k.id) ? "running" : null,
      })),
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
