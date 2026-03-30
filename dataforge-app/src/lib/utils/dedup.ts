import { PrismaClient } from "@/generated/prisma/client";
import { DedupResult } from "@/types/lead";

// Directory/aggregator domains that are shared across many businesses.
// Matching on these as a "website" would produce massive false positives.
const AGGREGATOR_DOMAINS = new Set([
  "yelp.com","yellowpages.com","yp.com","bbb.org","angi.com","angieslist.com",
  "homeadvisor.com","houzz.com","thumbtack.com","tripadvisor.com","manta.com",
  "mapquest.com","whitepages.com","superpages.com","porch.com","bark.com",
  "homestars.com","checkatrade.com","trustpilot.com","birdeye.com","nextdoor.com",
  "citysearch.com","merchantcircle.com","bing.com","yahoo.com","apple.com",
]);

function isAggregatorDomain(website: string): boolean {
  return AGGREGATOR_DOMAINS.has(website) ||
    [...AGGREGATOR_DOMAINS].some(d => website.endsWith("." + d));
}

/**
 * Check if a lead already exists in the database using strong dedup signals.
 * Any single match on phone, email, or website is sufficient to flag as duplicate.
 *
 * Empty strings and aggregator/directory domains are excluded from website checks
 * to prevent false positives (many businesses share yelp.com, bbb.org, etc.).
 */
export async function checkDuplicate(
  prisma: PrismaClient,
  normalizedPhone: string,
  normalizedEmail: string,
  normalizedWebsite: string
): Promise<DedupResult> {
  const orConditions = [];

  if (normalizedPhone) orConditions.push({ phone: normalizedPhone });
  if (normalizedEmail) orConditions.push({ email: normalizedEmail });
  if (normalizedWebsite && !isAggregatorDomain(normalizedWebsite))
    orConditions.push({ website: normalizedWebsite });

  if (orConditions.length === 0) return { isDuplicate: false };

  const existing = await prisma.lead.findFirst({
    where: { OR: orConditions },
    select: { id: true },
  });

  if (existing) {
    return { isDuplicate: true, existingId: existing.id };
  }

  return { isDuplicate: false };
}
