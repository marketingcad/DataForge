/**
 * Builds src/lib/geo/city-populations.json from a GeoNames dump.
 *
 * GeoNames is the same upstream source the `country-state-city` package is
 * derived from, so coordinates line up almost exactly — that lets us fall back
 * to lat/lng proximity when city names disagree ("St. Louis" vs "Saint Louis").
 *
 * Usage:
 *   1. Download + unzip a cities dump into scripts/data/
 *        https://download.geonames.org/export/dump/cities1000.zip
 *      (cities1000 = every place with population >= 1,000, ~150k rows.
 *       cities5000 / cities15000 are smaller if you want a lighter file.)
 *   2. node scripts/build-city-populations.mjs scripts/data/cities1000.txt
 *
 * Output shape (compact on purpose — this file ships in the repo):
 *   { "<countryCode>": { "<admin1>": [ [normalizedName, population, lat, lng], ... ] } }
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "src", "lib", "geo", "city-populations.json");

// Keep in sync with normalizeCityName() in src/lib/geo/city-populations.ts
function normalizeCityName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/\bsainte\b/g, "st")
    .replace(/\bmount\b/g, "mt")
    .replace(/\bfort\b/g, "ft")
    .replace(/[^a-z0-9]/g, "");
}

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-city-populations.mjs <path-to-cities1000.txt>");
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`Not found: ${input}`);
  console.error("Download it from https://download.geonames.org/export/dump/cities1000.zip");
  process.exit(1);
}

const out = {};
let rows = 0;
let kept = 0;

const rl = readline.createInterface({
  input: fs.createReadStream(input, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

// GeoNames dump columns (tab separated, no header):
// 0 geonameid  1 name  2 asciiname  3 alternatenames  4 lat  5 lng
// 6 featureClass  7 featureCode  8 countryCode  9 cc2  10 admin1  ...  14 population
for await (const line of rl) {
  if (!line) continue;
  rows++;
  const f = line.split("\t");
  const name = f[1];
  const lat = parseFloat(f[4]);
  const lng = parseFloat(f[5]);
  const featureClass = f[6];
  const countryCode = f[8];
  const admin1 = f[10];
  const population = parseInt(f[14], 10);

  // P = populated place. Skip admin regions, parks, etc.
  if (featureClass !== "P") continue;
  if (!name || !countryCode || !admin1) continue;
  if (!Number.isFinite(population) || population <= 0) continue;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  const norm = normalizeCityName(name);
  if (!norm) continue;

  out[countryCode] ??= {};
  out[countryCode][admin1] ??= [];
  out[countryCode][admin1].push([
    norm,
    population,
    Math.round(lat * 1000) / 1000,
    Math.round(lng * 1000) / 1000,
  ]);
  kept++;
}

// Largest first within each state — the lookup keeps the biggest match when a
// normalized name collides (e.g. a township and a city sharing a name).
for (const country of Object.values(out)) {
  for (const list of Object.values(country)) {
    list.sort((a, b) => b[1] - a[1]);
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));

const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`Read ${rows.toLocaleString()} rows, kept ${kept.toLocaleString()} populated places.`);
console.log(`Countries: ${Object.keys(out).length}`);
console.log(`Wrote ${OUT} (${mb} MB)`);
