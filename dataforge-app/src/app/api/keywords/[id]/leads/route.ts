import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessKeyword, hasFullKeywordAccess } from "@/lib/keywords/access";
const DEFAULT_PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  const userId = (session.user as unknown as Record<string, unknown>)?.id as string;
  if (!hasFullKeywordAccess(role) && role !== "team_lead") {
    if (!(await canAccessKeyword({ id: userId, role }, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const sp = req.nextUrl.searchParams;

  const page        = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize    = Math.min(10000, Math.max(1, Number(sp.get("pageSize") ?? DEFAULT_PAGE_SIZE)));
  const search      = sp.get("search")?.trim() ?? "";
  const searchField = sp.get("searchField") ?? "business";
  const sort        = sp.get("sort") ?? "newest";
  const state       = sp.get("state")?.trim() ?? "";

  // Per-field has/no filters
  const fEmail   = sp.get("email");    // "has" | "no" | null
  const fWebsite = sp.get("website");  // "has" | "no" | null
  const fAddress = sp.get("address");  // "has" | "no" | null
  const fPhone   = sp.get("phone");    // "has" | "no" | null
  const fScore   = sp.get("score");    // "has" | "no" | null
  const fName    = sp.get("name");     // "has" | "no" | null
  const scoreMin = sp.get("scoreMin"); // numeric string | null
  const scoreMax = sp.get("scoreMax"); // numeric string | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any = { source: { startsWith: `GoogleMaps:keyword_${id}` }, folderId: null };

  if (search) {
    const like = { contains: search, mode: "insensitive" };
    switch (searchField) {
      case "contact":  base.contactPerson = like; break;
      case "location": base.OR = [{ city: like }, { state: like }]; break;
      case "phone":    base.phone   = like; break;
      case "email":    base.email   = like; break;
      case "website":  base.website = like; break;
      default:         base.businessName = like;
    }
  }

  if (fEmail === "has") base.email = { not: null, notIn: [""] };
  if (fEmail === "no")  base.AND = [...(base.AND ?? []), { OR: [{ email: null }, { email: "" }] }];

  if (fWebsite === "has") base.website = { not: null, notIn: [""] };
  if (fWebsite === "no")  base.AND = [...(base.AND ?? []), { OR: [{ website: null }, { website: "" }] }];

  if (fAddress === "has") base.address = { not: null, notIn: [""] };
  if (fAddress === "no")  base.AND = [...(base.AND ?? []), { OR: [{ address: null }, { address: "" }] }];

  if (fPhone === "has") base.phone = { not: null, notIn: ["", "N/A"] };
  if (fPhone === "no")  base.AND = [...(base.AND ?? []), { OR: [{ phone: null }, { phone: "" }, { phone: "N/A" }] }];

  if (fScore === "has") base.dataQualityScore = { gt: 0 };
  if (fScore === "no")  base.dataQualityScore = { equals: 0 };

  const minVal = scoreMin !== null ? parseInt(scoreMin) : NaN;
  const maxVal = scoreMax !== null ? parseInt(scoreMax) : NaN;
  if (!isNaN(minVal) && !isNaN(maxVal)) {
    base.dataQualityScore = { gte: minVal, lte: maxVal };
  } else if (!isNaN(minVal)) {
    base.dataQualityScore = { gte: minVal };
  } else if (!isNaN(maxVal)) {
    base.dataQualityScore = { lte: maxVal };
  }

  if (fName === "has") base.businessName = { not: null, notIn: [""] };
  if (fName === "no")  base.AND = [...(base.AND ?? []), { OR: [{ businessName: null }, { businessName: "" }] }];

  if (state) base.state = { contains: state, mode: "insensitive" };

  const orderBy =
    sort === "name_asc"  ? { businessName: "asc" as const }  :
    sort === "name_desc" ? { businessName: "desc" as const } :
    sort === "oldest"    ? { dateCollected: "asc" as const }  :
    /* newest */           { dateCollected: "desc" as const };

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where: base }),
    prisma.lead.findMany({
      where: base,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        businessName: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        city: true,
        state: true,
        country: true,
        contactPerson: true,
        dataQualityScore: true,
      },
    }),
  ]);

  return NextResponse.json({ leads, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
