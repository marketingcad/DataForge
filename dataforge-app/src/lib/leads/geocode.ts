const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function geocodeAddress(params: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  // If a full address is present use it alone — it already contains city/state/country.
  // Only fall back to assembling from structured fields when there's no address string.
  const q = params.address?.trim()
    ?? [params.city, params.state, params.country].map((s) => s?.trim()).filter(Boolean).join(", ");

  if (!q) return null;

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DataForge-App/1.0 (justin@murphyconsulting.us)" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[geocode] Nominatim HTTP ${res.status} for: ${q}`);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[geocode] No results for: ${q}`);
      return null;
    }

    const { lat, lon } = data[0];
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) return null;
    return { latitude, longitude };
  } catch (err) {
    console.error(`[geocode] Fetch failed for: ${q}`, err);
    return null;
  }
}
