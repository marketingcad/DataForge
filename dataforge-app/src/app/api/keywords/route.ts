import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKeywords, createKeyword } from "@/lib/keywords/service";

const ALLOWED_ROLES = ["boss", "admin", "lead_data_analyst"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keywords = await getKeywords();
  return NextResponse.json({ keywords });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { keyword, location, maxLeads, intervalMinutes } = body;

  if (!keyword?.trim() || !location?.trim()) {
    return NextResponse.json({ error: "keyword and location are required" }, { status: 400 });
  }

  const userId = (session.user as unknown as Record<string, unknown>)?.id as string;
  const kw = await createKeyword({ keyword, location, maxLeads, intervalMinutes, createdById: userId });
  return NextResponse.json({ keyword: kw }, { status: 201 });
}
