import { LeadInput } from "@/types/lead";

/**
 * Score breakdown (0–100):
 *
 *   Business name   15
 *   Phone           20
 *   Email           25   ← highest weight; a lead with email is far more actionable
 *   Website         15
 *   City / State    15
 *   Category        10
 *   ─────────────────
 *   Total          100   ← a lead with all core fields (no contact person needed) hits 100
 *
 * Contact person adds up to +10 as a bonus but the score is capped at 100.
 * Cross-industry appearances also add bonus points (capped at 100).
 *
 * Score only increases — callers should use Math.max(existing, new).
 */
export function calculateDataQualityScore(
  lead: Partial<LeadInput>,
  industriesCount: number
): number {
  let score = 0;

  if (lead.businessName?.trim())              score += 15;
  if (lead.phone?.trim())                     score += 20;
  if (lead.email?.trim())                     score += 25;
  if (lead.website?.trim())                   score += 15;
  if (lead.city?.trim() || lead.state?.trim()) score += 15;
  if (lead.category?.trim())                  score += 10;

  // Contact person is a bonus — most scraped leads won't have this
  if (lead.contactPerson?.trim())             score += 10;

  // Cross-industry bonus
  if (industriesCount >= 2) score += 5;
  if (industriesCount >= 3) score += 5;

  return Math.min(score, 100);
}
