import { PrismaClient } from "@/generated/prisma/client";
import { DedupResult } from "@/types/lead";

/**
 * Check if a lead already exists in the database using strong dedup signals.
 * Any single match on phone, email, or website is sufficient to flag as duplicate.
 *
 * Empty strings are excluded from checks (they would match unintended records).
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
  if (normalizedWebsite) orConditions.push({ website: normalizedWebsite });

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
