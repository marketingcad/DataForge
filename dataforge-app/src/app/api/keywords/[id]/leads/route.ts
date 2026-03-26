import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;

  const page        = Math.max(1, Number(sp.get("page") ?? 1));
  const search      = sp.get("search")?.trim() ?? "";
  const searchField = sp.get("searchField") ?? "business";
  const sort        = sp.get("sort") ?? "newest";
  const hasEmail    = sp.get("hasEmail") === "1";
  const hasWebsite  = sp.get("hasWebsite") === "1";
  const state       = sp.get("state")?.trim() ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any = { source: { startsWith: `GoogleMaps:keyword_${id}` } };

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

  if (hasEmail)   base.email   = { not: null };
  if (hasWebsite) base.website = { not: null };
  if (state)      base.state   = { contains: state, mode: "insensitive" };

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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        businessName: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        city: true,
        state: true,
        contactPerson: true,
        dataQualityScore: true,
      },
    }),
  ]);

  return NextResponse.json({ leads, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
}
