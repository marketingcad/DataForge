import { prisma } from "@/lib/prisma";
import { Country, State, City } from "country-state-city";
import { getSettings } from "@/lib/settings/service";

export async function getKeywords(opts?: { createdById?: string; ids?: string[] }) {
  const where: Record<string, unknown> = {};
  if (opts?.createdById) where.createdById = opts.createdById;
  // Restrict to a specific set of keyword IDs (used to scope lead specialists
  // to the keywords granted to them).
  if (opts?.ids) where.id = { in: opts.ids };

  return prisma.scrapingKeyword.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: {
      // Count only jobs — leads count is fetched on-demand via /api/keywords/[id]/leads
      _count: { select: { jobs: true, leads: { where: { folderId: null } } } },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        // Exclude pendingLeads (large JSON) from the polling payload.
        // startedById lets the UI decide who may stop a running job.
        select: { id: true, status: true, leadsProcessed: true, leadsDiscovered: true, errorMessage: true, createdAt: true, startedById: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getKeywordById(id: string) {
  return prisma.scrapingKeyword.findUniqueOrThrow({
    where: { id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          leadsDiscovered: true,
          leadsProcessed: true,
          duplicatesFound: true,
          createdAt: true,
          completedTime: true,
        },
      },
    },
  });
}

export async function createKeyword(data: {
  keyword: string;
  location: string;
  maxLeads?: number;
  intervalMinutes?: number;
  extraKeywords?: string[];
  extraKeywordsMode?: string;
  extraKeywordsMin?: number;
  extraKeywordsMax?: number;
  extraKeywordsOrder?: string[];
  category?: string;
  grabEmail?: boolean;
  createdById?: string;
}) {
  const nextRunAt = new Date();
  return prisma.scrapingKeyword.create({
    data: {
      keyword: data.keyword.trim(),
      location: data.location.trim(),
      maxLeads: data.maxLeads ?? 50,
      intervalMinutes: data.intervalMinutes ?? 1440,
      extraKeywords: data.extraKeywords ?? [],
      extraKeywordsMode: data.extraKeywordsMode ?? "random",
      extraKeywordsMin: data.extraKeywordsMin ?? 1,
      extraKeywordsMax: data.extraKeywordsMax ?? 3,
      extraKeywordsOrder: data.extraKeywordsOrder ?? [],
      category: data.category?.trim() || "Uncategorized",
      // Default ON: visit each lead's website to grab a contact email.
      grabEmail: data.grabEmail ?? true,
      nextRunAt,
      createdById: data.createdById ?? null,
    },
  });
}

export async function updateKeyword(
  id: string,
  data: Partial<{
    keyword: string;
    location: string;
    maxLeads: number;
    intervalMinutes: number;
    enabled: boolean;
    nextRunAt: Date;
    extraKeywords: string[];
    extraKeywordsMode: string;
    extraKeywordsMin: number;
    extraKeywordsMax: number;
    extraKeywordsOrder: string[];
    category: string;
    cityIndex: number;
    cityRotationEnabled: boolean;
    grabEmail: boolean;
    autoRun: boolean;
    autoRunStartedAt: Date | null;
  }>
) {
  return prisma.scrapingKeyword.update({ where: { id }, data });
}

/**
 * Resolves the actual location to use for a given run.
 * - If the stored location already includes a city (3 parts) → use as-is every run.
 * - If only state + country (2 parts) → cycle through all cities using cityIndex,
 *   returning the city's lat/lng so the scraper can pin geolocation precisely.
 */
export function resolveRunLocation(kw: { location: string; cityIndex: number; cityRotationEnabled?: boolean }): {
  location: string;
  coords?: { latitude: number; longitude: number };
} {
  // If city rotation is disabled, always use the stored location as-is
  if (kw.cityRotationEnabled === false) return { location: kw.location };

  const parts = kw.location.split(",").map((s) => s.trim());

  // City already embedded → fixed city, use every run
  if (parts.length >= 3) return { location: kw.location };

  // State + country → auto-cycle cities
  if (parts.length === 2) {
    const [stateName, countryName] = parts;
    const country = Country.getAllCountries().find(
      (c) => c.name.toLowerCase() === countryName.toLowerCase()
    );
    if (!country) return { location: kw.location };

    const state = State.getStatesOfCountry(country.isoCode).find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase()
    );
    if (!state) return { location: kw.location };

    const cities = City.getCitiesOfState(country.isoCode, state.isoCode).filter((c) => c?.name);
    if (cities.length === 0) return { location: kw.location };

    const city = cities[kw.cityIndex % cities.length];
    if (!city) return { location: kw.location };
    const cityLocation = `${city.name}, ${state.name}, ${country.name}`;
    const coords = city.latitude && city.longitude
      ? { latitude: parseFloat(city.latitude), longitude: parseFloat(city.longitude) }
      : undefined;

    return { location: cityLocation, coords };
  }

  return { location: kw.location };
}

/**
 * Build the Google Maps search term for this run.
 *
 * ordered: cycles through extras one at a time using extraKeywordsIndex.
 *          e.g. run 0 → "dentist orthodontist", run 1 → "dentist dental clinic"
 *
 * random:  picks between extraKeywordsMin and extraKeywordsMax extras,
 *          shuffled, so every run is a unique combination.
 *          e.g. "dentist", "dentist orthodontist", "dentist dental clinic orthodontist"
 */
export function pickSearchTerm(kw: {
  keyword: string;
  extraKeywords: string[];
  extraKeywordsMode: string;
  extraKeywordsMin: number;
  extraKeywordsMax: number;
  extraKeywordsIndex: number;
  extraKeywordsOrder: string[];
}): string {
  const extras = kw.extraKeywords.filter(Boolean);
  if (extras.length === 0) return kw.keyword;

  if (kw.extraKeywordsMode === "ordered") {
    // Use the user-selected ordered subset; fall back to full extras list
    const pool = kw.extraKeywordsOrder.filter(Boolean);
    const ordered = pool.length > 0 ? pool : extras;
    const idx = kw.extraKeywordsIndex % ordered.length;
    // Shuffle the two parts so main keyword isn't always first
    const parts = [kw.keyword, ordered[idx]];
    return parts.sort(() => Math.random() - 0.5).join(" ");
  }

  // Random mode
  const min = Math.max(0, Math.min(kw.extraKeywordsMin, extras.length));
  const max = Math.max(min, Math.min(kw.extraKeywordsMax, extras.length));
  const count = min + Math.floor(Math.random() * (max - min + 1));
  if (count === 0) return kw.keyword;
  const shuffled = [...extras].sort(() => Math.random() - 0.5);
  // Shuffle main keyword position among the selected extras
  return [kw.keyword, ...shuffled.slice(0, count)].sort(() => Math.random() - 0.5).join(" ");
}

export async function deleteKeyword(id: string) {
  return prisma.scrapingKeyword.delete({ where: { id } });
}

/**
 * Keywords the cron should run this tick:
 *  - autoRun keywords: always due (they loop every tick until turned off), or
 *  - enabled keywords whose nextRunAt is due (or never set).
 * The cron's per-keyword active-job check prevents overlapping runs.
 */
export async function getDueKeywords() {
  return prisma.scrapingKeyword.findMany({
    where: {
      OR: [
        { autoRun: true },
        {
          enabled: true,
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
        },
      ],
    },
    orderBy: { nextRunAt: "asc" },
  });
}

/**
 * Force-stop any keyword that has been auto-running continuously longer than the
 * configured `scrapingMaxRunMinutes` guard. Turns auto-run off, clears the timer,
 * and cancels the live job (status → "paused", which the processor polls and stops).
 * Returns the stopped keywords so the caller can notify. No-op when the setting is 0.
 */
export async function enforceMaxAutoRunTime(): Promise<
  { id: string; keyword: string; location: string; createdById: string | null; minutes: number }[]
> {
  const settings = await getSettings().catch(() => null);
  const maxMinutes = settings?.scrapingMaxRunMinutes ?? 0;
  if (!maxMinutes || maxMinutes <= 0) return [];

  const cutoff = new Date(Date.now() - maxMinutes * 60 * 1000);
  const expired = await prisma.scrapingKeyword.findMany({
    where: { autoRun: true, autoRunStartedAt: { not: null, lte: cutoff } },
    select: { id: true, keyword: true, location: true, createdById: true },
  });
  if (expired.length === 0) return [];

  const ids = expired.map((k) => k.id);
  await prisma.scrapingKeyword.updateMany({
    where: { id: { in: ids } },
    data: { autoRun: false, autoRunStartedAt: null },
  }).catch(() => {});
  await prisma.scrapingJob.updateMany({
    where: { keywordId: { in: ids }, status: { in: ["pending", "running"] } },
    data: { status: "paused", errorMessage: `Auto-stopped — reached the ${maxMinutes}-minute run limit.` },
  }).catch(() => {});

  return expired.map((k) => ({ ...k, minutes: maxMinutes }));
}

/** Called after a keyword-linked job completes successfully. */
export async function onKeywordJobSuccess(id: string, intervalMinutes: number) {
  const next = new Date(Date.now() + intervalMinutes * 60 * 1000);
  return prisma.scrapingKeyword.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: next,
      failedAttempts: 0,
      lastError: null,
      extraKeywordsIndex: { increment: 1 },
      cityIndex: { increment: 1 },
    },
  });
}

/** Called after a keyword-linked job fails. Returns updated failedAttempts. */
export async function onKeywordJobFailure(id: string, error: string, intervalMinutes: number) {
  const kw = await prisma.scrapingKeyword.findUniqueOrThrow({ where: { id } });
  const attempts = kw.failedAttempts + 1;
  const MAX_FAILURES = 5;

  // Back-off: retry in intervalMinutes, but disable after max failures
  const next = attempts >= MAX_FAILURES
    ? null
    : new Date(Date.now() + intervalMinutes * 60 * 1000);

  await prisma.scrapingKeyword.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: next,
      failedAttempts: attempts,
      lastError: error,
      enabled: attempts < MAX_FAILURES,
    },
  });

  return { attempts, disabled: attempts >= MAX_FAILURES };
}
