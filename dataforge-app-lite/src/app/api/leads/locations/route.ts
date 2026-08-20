import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLeadLocations } from "@/lib/leads/locations";

// On-demand globe data. Only fetched when the user actually opens the Lead
// Origins globe — keeping the (potentially huge) coordinate set OUT of the
// Leads page payload so navigating there stays light on low-RAM machines.
export async function GET() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!session || !role || !["boss", "admin"].includes(role)) {
    return NextResponse.json([], { status: 403 });
  }
  const points = await getLeadLocations();
  return NextResponse.json(points);
}
