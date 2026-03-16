import axios from "axios";
import { DiscoveredBusiness } from "@/types/scraping";

interface SerpApiResult {
  title?: string;
  phone?: string;
  website?: string;
  address?: string;
  place_id?: string;
  type?: string;
}

/**
 * Discover businesses using SerpAPI Google Maps search.
 * Falls back to empty array if SERPAPI_API_KEY is not set.
 */
export async function discoverBusinesses(
  industry: string,
  location: string,
  maxResults: number
): Promise<DiscoveredBusiness[]> {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    console.warn("[Discovery] SERPAPI_API_KEY not set — returning empty results");
    return [];
  }

  try {
    const response = await axios.get("https://serpapi.com/search.json", {
      timeout: 10000,
      params: {
        engine: "google_maps",
        q: `${industry} in ${location}`,
        type: "search",
        api_key: apiKey,
        num: Math.min(maxResults, 20),
      },
    });

    const results: SerpApiResult[] = response.data?.local_results ?? [];

    return results.slice(0, maxResults).map((r) => {
      const parts = (r.address ?? "").split(",").map((s: string) => s.trim());
      return {
        businessName: r.title ?? "",
        phone: r.phone,
        website: r.website,
        address: r.address,
        city: parts[parts.length - 3] ?? undefined,
        state: parts[parts.length - 2] ?? undefined,
        category: r.type ?? industry,
      };
    }).filter((b) => b.businessName);

  } catch (err) {
    console.error("[Discovery] SerpAPI error:", err);
    return [];
  }
}
