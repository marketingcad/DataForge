import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStateCityPopulations, hasPopulationData } from "@/lib/geo/city-populations";

/**
 * Population figures for every city in one state, keyed by the city name the
 * `country-state-city` package uses (so the client can look up directly).
 *
 * The underlying dataset is a few MB and stays server-side; the location picker
 * pulls one state at a time as the user drills down.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const country = req.nextUrl.searchParams.get("country");
  const state = req.nextUrl.searchParams.get("state");
  if (!country || !state) {
    return NextResponse.json({ error: "country and state are required" }, { status: 400 });
  }

  if (!hasPopulationData) {
    return NextResponse.json({ available: false, populations: {} });
  }

  const populations = getStateCityPopulations(country, state);
  return NextResponse.json(
    { available: true, populations },
    // Static bundled data — safe to cache hard.
    { headers: { "Cache-Control": "public, max-age=86400, immutable" } }
  );
}
