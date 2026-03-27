import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKeywordById, updateKeyword, deleteKeyword } from "@/lib/keywords/service";

const ALLOWED_ROLES = ["boss", "admin", "lead_data_analyst"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { keyword, location, maxLeads, intervalMinutes, enabled } = body;

  const existing = await getKeywordById(id).catch(() => null);

  // Reset nextRunAt to now when:
  // - intervalMinutes changed (so it runs at the new frequency immediately)
  // - keyword is being re-enabled (so it doesn't wait until the old nextRunAt)
  const intervalChanged = intervalMinutes !== undefined && existing && existing.intervalMinutes !== intervalMinutes;
  const beingEnabled = enabled === true && existing && !existing.enabled;
  const resetNextRun = intervalChanged || beingEnabled;

  const updated = await updateKeyword(id, {
    keyword,
    location,
    maxLeads,
    intervalMinutes,
    enabled,
    ...(resetNextRun ? { nextRunAt: new Date() } : {}),
  });
  return NextResponse.json({ keyword: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await deleteKeyword(id);
  return NextResponse.json({ success: true });
}
