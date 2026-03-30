import { PrismaClient } from "@/generated/prisma/client";
import { DedupResult } from "@/types/lead";

/**
 * Check if a lead already exists in the database.
 * Uniqueness is determined by phone number OR business name (case-insensitive).
 * Website and email are intentionally excluded — they produce too many false
 * positives (shared aggregator domains, franchise sites, etc.).
 */
export async function checkDuplicate(
  prisma: PrismaClient,
  normalizedPhone: string,
  businessName: string,
): Promise<DedupResult> {
  const orConditions: object[] = [];

  if (normalizedPhone) orConditions.push({ phone: normalizedPhone });
  if (businessName.trim()) orConditions.push({ businessName: { equals: businessName.trim(), mode: "insensitive" } });

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
