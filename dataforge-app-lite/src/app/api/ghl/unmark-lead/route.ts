import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["boss", "admin", "lead_specialist"];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
    if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });

    await prisma.lead.update({
      where: { id: leadId },
      data: { migratedToGhl: false, migratedToGhlAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ghl/unmark-lead]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
