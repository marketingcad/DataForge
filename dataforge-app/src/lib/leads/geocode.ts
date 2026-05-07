const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function geocodeAddress(params: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  const parts = [params.address, params.city, params.state, params.country]
    .map((s) => s?.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const q = parts.join(", ");

  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DataForge-App/1.0 (justin@murphyconsulting.us)" },
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const { lat, lon } = data[0];
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
