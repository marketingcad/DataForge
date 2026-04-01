import { prisma } from "@/lib/prisma";

export type GlobePoint = {
  lat: number;
  long: number;
  name: string;
  count: number;
  color: string;
  folderName: string | null;
};

// US state centers (abbreviation → [lat, lon])
const US_STATES: Record<string, [number, number]> = {
  AL: [32.806671, -86.791130], AK: [61.370716, -152.404419],
  AZ: [33.729759, -111.431221], AR: [34.969704, -92.373123],
  CA: [36.116203, -119.681564], CO: [39.059811, -105.311104],
  CT: [41.597782, -72.755371], DE: [39.318523, -75.507141],
  FL: [27.766279, -81.686783], GA: [33.040619, -83.643074],
  HI: [21.094318, -157.498337], ID: [44.240459, -114.478828],
  IL: [40.349457, -88.986137], IN: [39.849426, -86.258278],
  IA: [42.011539, -93.210526], KS: [38.526600, -96.726486],
  KY: [37.668140, -84.670067], LA: [31.169960, -91.867805],
  ME: [44.693947, -69.381927], MD: [39.063946, -76.802101],
  MA: [42.230171, -71.530106], MI: [43.326618, -84.536095],
  MN: [45.694454, -93.900192], MS: [32.741646, -89.678696],
  MO: [38.456085, -92.288368], MT: [46.921925, -110.454353],
  NE: [41.125370, -98.268082], NV: [38.313515, -117.055374],
  NH: [43.452492, -71.563896], NJ: [40.298904, -74.521011],
  NM: [34.840515, -106.248482], NY: [42.165726, -74.948051],
  NC: [35.630066, -79.806419], ND: [47.528912, -99.784012],
  OH: [40.388783, -82.764915], OK: [35.565342, -96.928917],
  OR: [44.572021, -122.070938], PA: [40.590752, -77.209755],
  RI: [41.680893, -71.511780], SC: [33.856892, -80.945007],
  SD: [44.299782, -99.438828], TN: [35.747845, -86.692345],
  TX: [31.054487, -97.563461], UT: [40.150032, -111.862434],
  VT: [44.045876, -72.710686], VA: [37.769337, -78.169968],
  WA: [47.400902, -121.490494], WV: [38.491226, -80.954453],
  WI: [44.268543, -89.616508], WY: [42.755966, -107.302490],
  DC: [38.897438, -77.026817],
};

// Country centers (name variations → [lat, lon])
const COUNTRIES: Record<string, [number, number]> = {
  "united states": [37.090240, -95.712891],
  "us": [37.090240, -95.712891],
  "usa": [37.090240, -95.712891],
  "philippines": [12.879721, 121.774017],
  "ph": [12.879721, 121.774017],
  "united kingdom": [55.378051, -3.435973],
  "uk": [55.378051, -3.435973],
  "france": [46.227638, 2.213749],
  "germany": [51.165691, 10.451526],
  "japan": [36.204824, 138.252924],
  "australia": [-25.274398, 133.775136],
  "canada": [56.130366, -106.346771],
  "india": [20.593684, 78.962880],
  "brazil": [-14.235004, -51.925280],
  "mexico": [23.634501, -102.552784],
  "china": [35.861660, 104.195397],
  "south korea": [35.907757, 127.766922],
  "singapore": [1.352083, 103.819836],
  "new zealand": [-40.900557, 174.885971],
  "south africa": [-30.559482, 22.937506],
  "nigeria": [9.081999, 8.675277],
  "kenya": [-0.023559, 37.906193],
};

// Common cities with coordinates
const CITIES: Record<string, [number, number]> = {
  "newark": [40.7357, -74.1724],
  "jersey city": [40.7178, -74.0431],
  "trenton": [40.2171, -74.7597],
  "new york": [40.7128, -74.0060],
  "new york city": [40.7128, -74.0060],
  "nyc": [40.7128, -74.0060],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "houston": [29.7604, -95.3698],
  "phoenix": [33.4484, -112.0740],
  "philadelphia": [39.9526, -75.1652],
  "san antonio": [29.4241, -98.4936],
  "san diego": [32.7157, -117.1611],
  "dallas": [32.7767, -96.7970],
  "san jose": [37.3382, -121.8863],
  "austin": [30.2672, -97.7431],
  "jacksonville": [30.3322, -81.6557],
  "san francisco": [37.7749, -122.4194],
  "columbus": [39.9612, -82.9988],
  "charlotte": [35.2271, -80.8431],
  "london": [51.5074, -0.1278],
  "manila": [14.5995, 120.9842],
  "angeles city": [15.1472, 120.5931],
  "paris": [48.8566, 2.3522],
  "berlin": [52.5200, 13.4050],
  "tokyo": [35.6762, 139.6503],
  "sydney": [-33.8688, 151.2093],
  "toronto": [43.6532, -79.3832],
  "miami": [25.7617, -80.1918],
  "atlanta": [33.7490, -84.3880],
  "boston": [42.3601, -71.0589],
  "seattle": [47.6062, -122.3321],
  "denver": [39.7392, -104.9903],
  "las vegas": [36.1699, -115.1398],
  "portland": [45.5231, -122.6765],
  "minneapolis": [44.9778, -93.2650],
  "detroit": [42.3314, -83.0458],
  "memphis": [35.1495, -90.0490],
  "louisville": [38.2527, -85.7585],
  "baltimore": [39.2904, -76.6122],
  "milwaukee": [43.0389, -87.9065],
};

function resolveCoords(city?: string | null, state?: string | null, country?: string | null): [number, number] | null {
  // Try city name lookup first
  if (city) {
    const key = city.toLowerCase().trim();
    if (CITIES[key]) return CITIES[key];
  }

  // Try US state abbreviation
  if (state) {
    const abbr = state.toUpperCase().trim().slice(0, 2);
    if (US_STATES[abbr]) return US_STATES[abbr];
    // Try as full state name match via fuzzy
    const stateKey = Object.keys(US_STATES).find(
      (k) => state.toLowerCase().startsWith(k.toLowerCase())
    );
    if (stateKey) return US_STATES[stateKey];
  }

  // Try country lookup
  if (country) {
    const key = country.toLowerCase().trim();
    const match = Object.keys(COUNTRIES).find((k) => key.includes(k) || k.includes(key));
    if (match) return COUNTRIES[match];
  }

  return null;
}

export async function getLeadLocations(): Promise<GlobePoint[]> {
  const rows = await prisma.lead.findMany({
    select: {
      city: true,
      state: true,
      country: true,
      folderId: true,
      folder: { select: { color: true, name: true } },
    },
    where: {
      OR: [
        { city: { not: null } },
        { state: { not: null } },
        { country: { not: null } },
      ],
    },
  });

  // Group by resolved coordinates + folder so each folder gets its own colored dot
  const map = new Map<string, GlobePoint>();

  for (const row of rows) {
    const coords = resolveCoords(row.city, row.state, row.country);
    if (!coords) continue;

    const folderId = row.folderId ?? "unfiled";
    const key = `${coords[0].toFixed(2)},${coords[1].toFixed(2)}:${folderId}`;
    const label = [row.city, row.state, row.country].filter(Boolean).join(", ");
    const color = row.folder?.color ?? "#6b7280";
    const folderName = row.folder?.name ?? null;

    if (map.has(key)) {
      map.get(key)!.count += 1;
    } else {
      map.set(key, { lat: coords[0], long: coords[1], name: label, count: 1, color, folderName });
    }
  }

  return Array.from(map.values());
}
