import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Finding and resolving duplicate leads.
 *
 * Several people scrape at once, each device holding its own local copy of the lead keys
 * (see src/lib/scraping/jobs/dedup-cache.ts), so the same business can be reached from two
 * directions. checkDuplicate() and the unique indexes stop identical rows being written,
 * but they cannot settle the ambiguous cases:
 *
 *   - the same business name under two different phone numbers — two branches, or one
 *     business whose number changed? 16 of these exist today.
 *   - the same phone number under two different names — an ownership change, or a
 *     scraping error?
 *
 * Those need a person to decide, which is what the duplicates banner and review list are
 * for. Grouping is by the same normalized keys the dedup layer uses, so whatever the
 * automatic rules let through shows up here.
 */

export type DuplicateLead = {
  id: string;
  businessName: string;
  phone: string;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  source: string;
  dataQualityScore: number;
  dateCollected: Date;
  savedByName: string | null;
  folderName: string | null;
  /** Children that would be affected by removing this copy. */
  callCount: number;
  hasCommission: boolean;
};

export type DuplicateGroup = {
  /** The shared value: a lower-cased business name, or a digits-only phone number. */
  key: string;
  matchedOn: "name" | "phone";
  leads: DuplicateLead[];
};

/** How many duplicate groups exist. Used for the banner, so it must stay cheap. */
export async function countDuplicateGroups(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT (
      (SELECT count(*) FROM (
        SELECT lower(btrim("businessName")) k FROM "Lead"
        GROUP BY 1 HAVING count(*) > 1
      ) a)
      +
      (SELECT count(*) FROM (
        SELECT regexp_replace("phone", '\\D', '', 'g') k FROM "Lead"
        WHERE length(regexp_replace("phone", '\\D', '', 'g')) >= 7
        GROUP BY 1 HAVING count(*) > 1
      ) b)
    ) AS n
  `;
  return Number(rows[0]?.n ?? 0);
}

export const DUPLICATE_COUNT_TAG = "duplicate-lead-count";

/**
 * Cached wrapper for the banner. The two aggregations group over every row — measured at
 * ~330 ms and ~235 ms warm, and several seconds on a cold connection — which is too much
 * to pay on every leads page render. The number only changes when leads are added or
 * merged, so a few minutes of staleness costs nothing; mergeDuplicatesAction() busts the
 * tag immediately so the banner never shows work that is already done.
 */
export const getDuplicateGroupCount = unstable_cache(
  async () => countDuplicateGroups(),
  ["duplicate-lead-count"],
  { revalidate: 300, tags: [DUPLICATE_COUNT_TAG] }
);

type KeyRow = { key: string; matched_on: "name" | "phone" };

/**
 * List duplicate groups, newest-conflict first, with every copy in each group.
 * Two queries: the conflicting keys, then the rows behind them.
 */
export async function findDuplicateGroups(limit = 50): Promise<DuplicateGroup[]> {
  const keys = await prisma.$queryRaw<KeyRow[]>`
    SELECT k AS key, 'name' AS matched_on, newest FROM (
      SELECT lower(btrim("businessName")) k, max("dateCollected") newest
      FROM "Lead" GROUP BY 1 HAVING count(*) > 1
    ) a
    UNION ALL
    SELECT k AS key, 'phone' AS matched_on, newest FROM (
      SELECT regexp_replace("phone", '\\D', '', 'g') k, max("dateCollected") newest
      FROM "Lead"
      WHERE length(regexp_replace("phone", '\\D', '', 'g')) >= 7
      GROUP BY 1 HAVING count(*) > 1
    ) b
    ORDER BY newest DESC
    LIMIT ${limit}
  `;
  if (!keys.length) return [];

  const nameKeys = keys.filter((k) => k.matched_on === "name").map((k) => k.key);
  const phoneKeys = keys.filter((k) => k.matched_on === "phone").map((k) => k.key);

  // One pass for the rows, then bucket them in JS — avoids a query per group.
  const rows = await prisma.$queryRaw<
    (Omit<DuplicateLead, "callCount" | "hasCommission"> & {
      name_key: string;
      phone_key: string | null;
      call_count: bigint;
      has_commission: boolean;
    })[]
  >`
    SELECT
      l."id", l."businessName", l."phone", l."email", l."website", l."city", l."state",
      l."category", l."source", l."dataQualityScore", l."dateCollected",
      u."name"                                        AS "savedByName",
      f."name"                                        AS "folderName",
      lower(btrim(l."businessName"))                  AS name_key,
      NULLIF(regexp_replace(l."phone", '\\D', '', 'g'), '') AS phone_key,
      (SELECT count(*) FROM "CallLog" c WHERE c."leadId" = l."id")            AS call_count,
      EXISTS (SELECT 1 FROM "LeadCommission" lc WHERE lc."leadId" = l."id")   AS has_commission
    FROM "Lead" l
    LEFT JOIN "User"   u ON u."id" = l."savedById"
    LEFT JOIN "Folder" f ON f."id" = l."folderId"
    WHERE lower(btrim(l."businessName")) = ANY(${nameKeys}::text[])
       OR regexp_replace(l."phone", '\\D', '', 'g') = ANY(${phoneKeys}::text[])
    ORDER BY l."dateCollected" ASC
  `;

  const groups: DuplicateGroup[] = [];
  for (const k of keys) {
    const members = rows
      .filter((r) => (k.matched_on === "name" ? r.name_key === k.key : r.phone_key === k.key))
      .map((r) => ({
        id: r.id,
        businessName: r.businessName,
        phone: r.phone,
        email: r.email,
        website: r.website,
        city: r.city,
        state: r.state,
        category: r.category,
        source: r.source,
        dataQualityScore: r.dataQualityScore,
        dateCollected: r.dateCollected,
        savedByName: r.savedByName,
        folderName: r.folderName,
        callCount: Number(r.call_count),
        hasCommission: r.has_commission,
      }));
    // A group can drop below 2 if rows were resolved between the two queries.
    if (members.length > 1) groups.push({ key: k.key, matchedOn: k.matched_on, leads: members });
  }
  return groups;
}

export type MergeResult =
  | { ok: true; keptId: string; removed: number; movedCalls: number; movedCommission: boolean }
  | { ok: false; reason: string };

/**
 * Keep one copy and fold the others into it.
 *
 * Deleting a duplicate outright loses data: LeadCommission cascades (a commission record
 * would be destroyed), and CallLog / GhlOpportunity / GhlAppointment have their leadId set
 * to NULL, orphaning call history. So this reassigns every child to the survivor first,
 * and enriches the survivor with anything only the other copies had, before deleting them.
 *
 * Refuses rather than guesses when more than one copy carries a commission:
 * LeadCommission.leadId is UNIQUE, so they cannot all move to the survivor, and silently
 * dropping one would delete money data.
 */
export async function mergeDuplicates(keepId: string, removeIds: string[]): Promise<MergeResult> {
  const losers = removeIds.filter((id) => id !== keepId);
  if (!losers.length) return { ok: false, reason: "Nothing to merge." };

  return prisma.$transaction(async (tx) => {
    const all = await tx.lead.findMany({ where: { id: { in: [keepId, ...losers] } } });
    const keep = all.find((l) => l.id === keepId);
    if (!keep) return { ok: false, reason: "The lead to keep no longer exists." };
    const drop = all.filter((l) => l.id !== keepId);
    if (!drop.length) return { ok: false, reason: "The duplicates were already resolved." };

    const commissions = await tx.leadCommission.findMany({
      where: { leadId: { in: [keepId, ...losers] } },
      select: { id: true, leadId: true },
    });
    if (commissions.length > 1) {
      return {
        ok: false,
        reason:
          `${commissions.length} of these copies have commission records. ` +
          `Only one can be kept, so resolve the commissions first — merging would delete money data.`,
      };
    }

    // Move history onto the survivor.
    const movedCalls = await tx.callLog.updateMany({
      where: { leadId: { in: losers } },
      data: { leadId: keepId },
    });
    await tx.ghlOpportunity.updateMany({ where: { leadId: { in: losers } }, data: { leadId: keepId } });
    await tx.ghlAppointment.updateMany({ where: { leadId: { in: losers } }, data: { leadId: keepId } });

    const orphanCommission = commissions.find((c) => c.leadId !== keepId);
    if (orphanCommission) {
      await tx.leadCommission.update({ where: { id: orphanCommission.id }, data: { leadId: keepId } });
    }

    // Take the best of what the copies knew: fill blanks, union industries, keep the
    // highest quality score (scores are monotonic elsewhere in the app too).
    const firstOf = (pick: (l: (typeof drop)[number]) => string | null | undefined) =>
      drop.map(pick).find((v) => v && String(v).trim().length > 0) ?? undefined;

    await tx.lead.update({
      where: { id: keepId },
      data: {
        email: keep.email || firstOf((l) => l.email) || null,
        website: keep.website || firstOf((l) => l.website) || null,
        contactPerson: keep.contactPerson || firstOf((l) => l.contactPerson) || null,
        address: keep.address || firstOf((l) => l.address) || null,
        city: keep.city || firstOf((l) => l.city) || null,
        state: keep.state || firstOf((l) => l.state) || null,
        country: keep.country || firstOf((l) => l.country) || null,
        phone: keep.phone || drop.map((l) => l.phone).find((p) => p && p.trim()) || keep.phone,
        industriesFoundIn: Array.from(new Set([...keep.industriesFoundIn, ...drop.flatMap((l) => l.industriesFoundIn)])),
        dataQualityScore: Math.max(keep.dataQualityScore, ...drop.map((l) => l.dataQualityScore)),
        duplicateFlag: true,
      },
    });

    await tx.lead.deleteMany({ where: { id: { in: losers } } });

    return {
      ok: true,
      keptId: keepId,
      removed: losers.length,
      movedCalls: movedCalls.count,
      movedCommission: !!orphanCommission,
    };
  });
}
