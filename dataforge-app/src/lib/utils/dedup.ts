import { PrismaClient } from "@/generated/prisma/client";
import { DedupResult } from "@/types/lead";

/**
 * Check if a lead already exists in the database.
 *
 * Priority:
 *  1. Phone match (most reliable)
 *  2. Email match (if no phone)
 *  3. Business name match (last resort — only when neither phone nor email present,
 *     to avoid false positives on directory scrapes where every lead shares the
 *     same site name as businessName)
 */
export async function checkDuplicate(
  prisma: PrismaClient,
  normalizedPhone: string,
  businessName: string,
  normalizedEmail?: string,
): Promise<DedupResult> {
  const orConditions: object[] = [];

  if (normalizedPhone) {
    orConditions.push({ phone: normalizedPhone });
  } else if (normalizedEmail) {
    orConditions.push({ email: normalizedEmail });
  } else if (businessName.trim()) {
    orConditions.push({ businessName: { equals: businessName.trim(), mode: "insensitive" } });
  }

  if (orConditions.length === 0) return { isDuplicate: false };

  const existing = await prisma.lead.findFirst({
    where: { OR: orConditions },
    select: { id: true },
  });

  return existing
    ? { isDuplicate: true, existingId: existing.id }
    : { isDuplicate: false };
}
