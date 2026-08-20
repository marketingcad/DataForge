import { NextRequest, NextResponse } from "next/server";
import { getLeads, insertLead } from "@/lib/leads/service";
import { LeadInputSchema } from "@/types/lead";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const result = await getLeads({
    search: searchParams.get("search") ?? "",
    industry: searchParams.get("industry") ?? "",
    state: searchParams.get("state") ?? "",
    status: searchParams.get("status") ?? "",
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = LeadInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await insertLead(parsed.data);
  return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
}
