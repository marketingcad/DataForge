import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/lib/auth";
import { getKeywordById, updateKeyword, deleteKeyword } from "@/lib/keywords/service";
import { canAccessKeyword, hasFullKeywordAccess } from "@/lib/keywords/access";
import { runKeywordAutoLoop } from "@/lib/scraping/jobs/processor";

const ALLOWED_ROLES = ["boss", "admin", "team_lead", "lead_specialist"];

/**
 * Authorize a keyword request. Returns an error NextResponse to short-circuit,
 * or null if allowed. Lead specialists must have been granted this keyword.
 */
async function authorizeKeyword(id: string): Promise<NextResponse | null> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!hasFullKeywordAccess(role) && role !== "team_lead") {
    const userId = (session.user as unknown as Record<string, unknown>)?.id as string;
    if (!(await canAccessKeyword({ id: userId, role }, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await authorizeKeyword(id);
  if (denied) return denied;

  try {
    const kw = await getKeywordById(id);
    return NextResponse.json({ keyword: kw });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await authorizeKeyword(id);
  if (denied) return denied;

  const body = await req.json();
  const { keyword, location, maxLeads, intervalMinutes, enabled, extraKeywords, extraKeywordsMode, extraKeywordsMin, extraKeywordsMax, extraKeywordsOrder, category, cityRotationEnabled, grabEmail, autoRun } = body;

  const existing = await getKeywordById(id).catch(() => null);

  // Reset nextRunAt to now when:
  // - intervalMinutes changed (so it runs at the new frequency immediately)
  // - keyword is being re-enabled (so it doesn't wait until the old nextRunAt)
  // - autoRun is being turned on (so continuous mode starts on the next cron tick)
  const intervalChanged = intervalMinutes !== undefined && existing && existing.intervalMinutes !== intervalMinutes;
  const beingEnabled = enabled === true && existing && !existing.enabled;
  const autoRunTurnedOn = autoRun === true && existing && !existing.autoRun;
  const locationChanged = location !== undefined && existing && existing.location !== location;
  const resetNextRun = intervalChanged || beingEnabled || autoRunTurnedOn;

  const updated = await updateKeyword(id, {
    keyword,
    location,
    maxLeads,
    intervalMinutes,
    enabled,
    extraKeywords,
    extraKeywordsMode,
    extraKeywordsMin,
    extraKeywordsMax,
    extraKeywordsOrder,
    ...(category !== undefined ? { category: category?.trim() || "Uncategorized" } : {}),
    ...(cityRotationEnabled !== undefined ? { cityRotationEnabled } : {}),
    ...(grabEmail !== undefined ? { grabEmail } : {}),
    ...(autoRun !== undefined ? { autoRun } : {}),
    ...(resetNextRun ? { nextRunAt: new Date() } : {}),
    ...(locationChanged ? { cityIndex: 0 } : {}),
  });

  // Auto-run turned on → start the server-side loop immediately so it doesn't
  // wait for the next cron tick (essential locally, where the cron never fires).
  if (autoRunTurnedOn) {
    const session = await auth();
    const userId = (session?.user as unknown as Record<string, unknown>)?.id as string | undefined;
    waitUntil(runKeywordAutoLoop(id, userId));
  }

  return NextResponse.json({ keyword: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await authorizeKeyword(id);
  if (denied) return denied;

  await deleteKeyword(id);
  return NextResponse.json({ success: true });
}
