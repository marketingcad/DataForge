import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session?.user || !["boss", "admin", "dev"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const leads = await prisma.lead.findMany({
    where: {
      address: { not: null },
      ...(q ? { businessName: { contains: q, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      businessName: true,
      address: true,
      city: true,
      state: true,
      country: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { businessName: "asc" },
    take: 30,
  });

  return NextResponse.json(leads);
}
