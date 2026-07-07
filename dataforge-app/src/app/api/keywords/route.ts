import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKeywords, createKeyword } from "@/lib/keywords/service";
import { getGrantedKeywordIds, hasFullKeywordAccess } from "@/lib/keywords/access";

const ALLOWED_ROLES = ["boss", "admin", "team_lead", "lead_specialist"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Boss/admin/team_lead see all; lead specialists only keywords granted to them.
  let keywords;
  if (hasFullKeywordAccess(role) || role === "team_lead") {
    keywords = await getKeywords();
  } else {
    const userId = (session.user as unknown as Record<string, unknown>)?.id as string;
    const ids = await getGrantedKeywordIds(userId);
    keywords = ids.length ? await getKeywords({ ids }) : [];
  }
  return NextResponse.json({ keywords });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { keyword, location, maxLeads, intervalMinutes, extraKeywords, extraKeywordsMode, extraKeywordsMin, extraKeywordsMax, extraKeywordsOrder, category, grabEmail } = body;

  if (!keyword?.trim() || !location?.trim()) {
    return NextResponse.json({ error: "keyword and location are required" }, { status: 400 });
  }

  const userId = (session.user as unknown as Record<string, unknown>)?.id as string;
  try {
    const kw = await createKeyword({ keyword, location, maxLeads, intervalMinutes, extraKeywords, extraKeywordsMode, extraKeywordsMin, extraKeywordsMax, extraKeywordsOrder, category, grabEmail, createdById: userId });
    // A lead specialist who creates a keyword automatically gets access to it.
    if (role === "lead_specialist" && userId) {
      await prisma.keywordAccess.create({ data: { userId, keywordId: kw.id } }).catch(() => {});
    }
    return NextResponse.json({ keyword: kw }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/keywords]", err);
    return NextResponse.json({ error: "Failed to save keyword." }, { status: 500 });
  }
}
