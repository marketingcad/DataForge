import { prisma } from "@/lib/prisma";

// Noise words GHL might include around a rep's name — ignored during token matching.
const NOISE = new Set([
  "fb", "facebook", "ig", "instagram", "tt", "tiktok", "yt", "youtube",
  "tw", "twitter", "x", "wa", "whatsapp", "sms", "web", "website",
  "gg", "google", "from", "by", "via", "and", "the", "rep", "agent",
]);

// Extract meaningful tokens from a string (>= 2 chars, not noise).
function tokens(s: string): string[] {
  return s.toLowerCase().split(/[\s\-_,.|&]+/).filter((w) => w.length >= 2 && !NOISE.has(w));
}

export type MatchedRep = { id: string; name: string | null; nickname: string | null };

/**
 * Fuzzy-match a GHL-provided rep name to a DataForge user (sales_rep, team_lead,
 * boss, or admin). Returns the best candidate scoring >= 20, else null.
 *
 * Shared by the GHL appointment and lead webhooks so both attribute inbound
 * records to reps identically.
 */
export async function matchRepByName(repName: string): Promise<MatchedRep | null> {
  const allReps = await prisma.user.findMany({
    where: { role: { in: ["sales_rep", "team_lead", "boss", "admin"] } },
    select: { id: true, name: true, nickname: true },
  });

  const queryTokens = tokens(repName);

  function score(u: { name: string | null; nickname: string | null }): number {
    if (!queryTokens.length) return 0;

    const candidateTokens = [...tokens(u.name ?? ""), ...tokens(u.nickname ?? "")];
    if (!candidateTokens.length) return 0;

    // Full string exact match (highest confidence)
    const qFull  = queryTokens.join(" ");
    const cFull  = tokens(u.name ?? "").join(" ");
    const cnFull = tokens(u.nickname ?? "").join(" ");
    if (cFull === qFull || cnFull === qFull) return 100;

    // Count how many of the agent's name tokens appear in the query
    const hits = candidateTokens.filter((ct) =>
      queryTokens.some((qt) => qt === ct || qt.startsWith(ct) || ct.startsWith(qt))
    );
    if (hits.length === 0) return 0;

    // Score = proportion of agent tokens matched × 80, capped at 90.
    const tokenScore = (hits.length / candidateTokens.length) * 80;
    const lengthBonus = Math.min(10, hits.reduce((s, h) => s + h.length, 0));
    return Math.min(90, Math.round(tokenScore + lengthBonus));
  }

  return allReps
    .map((u) => ({ u, s: score(u) }))
    .filter((x) => x.s >= 20)   // minimum confidence threshold
    .sort((a, b) => b.s - a.s)[0]?.u ?? null;
}
