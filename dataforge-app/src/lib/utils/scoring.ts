import { LeadInput } from "@/types/lead";

/**
 * Calculate a DataQualityScore (0–100) based on field completeness
 * and number of unique industries the lead has been found in.
 *
 * Score only increases — callers should use Math.max(existing, new).
 */
export function calculateDataQualityScore(
  lead: Partial<LeadInput>,
  industriesCount: number
): number {
  let score = 0;

  // Field completeness
  if (lead.businessName?.trim()) score += 10;
  if (lead.phone?.trim()) score += 20;
  if (lead.email?.trim()) score += 20;
  if (lead.website?.trim()) score += 15;
  if (lead.contactPerson?.trim()) score += 15;
  if (lead.city?.trim() || lead.state?.trim()) score += 10;
  if (lead.category?.trim()) score += 10;

  // Cross-industry bonus
  if (industriesCount >= 2) score += 10;
  if (industriesCount >= 3) score += 10;
  if (industriesCount >= 4) score += (industriesCount - 3) * 5;

  return Math.min(score, 100);
}
