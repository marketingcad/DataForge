import { PrismaClient } from "@/generated/prisma/client";
import { DedupResult } from "@/types/lead";

/**
 * Check if a lead already exists anywhere in the database.
 *
 * A lead is a duplicate when EITHER key matches an existing row:
 *   - phone number (digits-only, as stored by normalizePhone)
 *   - business name (case-insensitive, trimmed)
 *
 * Both are checked on every insert, not in priority order. An earlier version
 * short-circuited — phone only, falling back to name just when no phone was present —
 * so a lead carrying a phone number was never name-checked, and the same business
 * scraped with two different numbers landed twice. Name uniqueness lived only in the
 * scraper's in-memory snapshot, which a second concurrent job could not see.
 *
 * Email is deliberately NOT a uniqueness key. Scraped emails are frequently template
 * or telemetry addresses lifted from site boilerplate and shared by unrelated
 * businesses: in the current data one Wix Sentry address appears on 860 leads,
 * "user@domain.com" on 629, and 9,032 rows in total share an email with another lead.
 * Keying on it collapses distinct businesses.
 *
 * Note the tradeoff name matching restores: directory scrapes can produce distinct
 * leads sharing one site-derived name, and those now collapse into a single lead
 * (industries merged, score kept monotonic by insertLead) rather than inserting
 * separately. That is the intended "unique across the whole database" behaviour.
 *
 * Written as one raw query so both comparisons hit their indexes: "phone" is indexed
 * directly and stored pre-normalized, and lower(btrim("businessName")) is covered by
 * Lead_business_name_key_idx. Prisma's `mode: "insensitive"` compiles to ILIKE, which
 * no btree index can serve — that would seq-scan the whole table on every insert.
 */
export async function checkDuplicate(
  prisma: PrismaClient,
  normalizedPhone: string,
  businessName: string,
): Promise<DedupResult> {
  const phone = normalizedPhone?.trim() ?? "";
  const nameKey = businessName?.toLowerCase().trim() ?? "";

  if (!phone && !nameKey) return { isDuplicate: false };

  // The ::text casts are required: in `$1 <> ''` both sides are untyped as far as
  // Postgres is concerned, which fails with "could not determine data type of parameter".
  // The empty-string guards themselves are essential — 6,951 leads have a blank phone, so
  // an unguarded `"phone" = ''` would report every one of them as a duplicate.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Lead"
    WHERE (${phone}::text <> '' AND "phone" = ${phone}::text)
       OR (${nameKey}::text <> '' AND lower(btrim("businessName")) = ${nameKey}::text)
    LIMIT 1
  `;

  return rows.length > 0
    ? { isDuplicate: true, existingId: rows[0].id }
    : { isDuplicate: false };
}
