/**
 * Enriches the Toronto-region hotels in the `Hotels` collection with real
 * amenity data scraped from Google Hotels via SerpApi, then writes the
 * amenities onto each matched hotel doc (which already carries the point /
 * coordinates). We cache them in MongoDB so the app never has to hit SerpApi
 * at request time — `/hotels` reads amenities straight from the doc, which
 * flow into the Discover sidebar and the sandbox's amenity preset.
 *
 * Why SerpApi: Stay22's API does not distribute amenity data (nor do the
 * travel/GDS APIs — Amadeus removed it for the same legal reason). Google
 * Hotels (via SerpApi) is a general search source that does surface a
 * hotel's amenity list.
 *
 * Cost-aware by design: instead of one SerpApi search per hotel (312 of
 * them), it runs a handful of broad area searches, collects every returned
 * property with its amenities + GPS, and matches those to our hotels by
 * coordinate proximity + name overlap.
 *
 * Two passes per area (mode=both, the default): a hotels pass, and a
 * `vacation_rentals=true` pass so the many Airbnb-style short-term rentals in
 * our data (which don't appear in the hotels results) also get real
 * amenities. Google returns both in the same `properties[]` shape, so the
 * parsing/matching is identical.
 *
 * Run with (needs SERPAPI_API_KEY in the root .env):
 *   npm run scrape:amenities -w api
 *   npm run scrape:amenities -w api -- --pages=2 --areas=Toronto,Mississauga
 *   npm run scrape:amenities -w api -- --mode=rentals   (hotels | rentals | both)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pino } from "pino";
import { HotelSchema, type HotelDoc } from "../db/models/Hotel.js";
import { loadEnv } from "../env.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
dotenv.config({ path: path.join(repoRoot, ".env") });

const logger = pino({ level: "info" });

// Toronto-region hotels span the whole GTA, so we search each sub-area.
const DEFAULT_AREAS = [
  "Toronto",
  "North York",
  "Scarborough",
  "Etobicoke",
  "Mississauga",
  "Vaughan",
  "Markham",
  "Brampton",
  "Richmond Hill",
  "Oakville",
];

// Bounding box of the region whose hotels we enrich (matches the Discover
// map's Toronto region; a touch wider to catch the GTA suburbs).
const TORONTO_REGION_BBOX = {
  west: -79.75,
  south: 43.55,
  east: -79.1,
  north: 43.92,
};

const SERPAPI_URL = "https://serpapi.com/search";
const MATCH_RADIUS_M = 250; // same-name property within this counts as a match
const MATCH_RADIUS_STRICT_M = 80; // this close counts even without a name match

// SerpApi amenity phrase → our canonical sandbox amenity vocabulary.
const AMENITY_PATTERNS: Record<string, string[]> = {
  wifi: ["wi-fi", "wifi", "internet"],
  pool: ["pool"],
  gym: ["fitness", "gym"],
  spa: ["spa"],
  restaurant: ["restaurant"],
  bar: ["bar"],
  breakfast: ["breakfast"],
  parking: ["parking"],
  coworking: ["coworking", "workspace"],
  ev_charging: ["ev charging", "electric vehicle", "car charging", "ev charger"],
  conference_rooms: ["conference", "meeting room", "business cent", "banquet"],
  rooftop_bar: ["rooftop"],
  airport_shuttle: ["airport shuttle", "shuttle"],
  smart_rooms: ["smart tv", "smart room"],
  pet_friendly: ["pet-friendly", "pets allowed", "pet friendly", "pets welcome"],
};

const NAME_STOPWORDS = new Set([
  "hotel",
  "hotels",
  "inn",
  "suites",
  "suite",
  "the",
  "and",
  "by",
  "at",
  "of",
  "resort",
  "motel",
  "toronto",
  "downtown",
]);

interface ScrapedProperty {
  name: string;
  lat: number;
  lng: number;
  amenities: string[]; // canonicalized
}

function stayDates(): { checkin: string; checkout: string } {
  const inD = new Date();
  inD.setDate(inD.getDate() + 30);
  const outD = new Date(inD);
  outD.setDate(outD.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { checkin: fmt(inD), checkout: fmt(outD) };
}

function canonicalizeAmenities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const joined = raw
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.toLowerCase())
    .join(" | ");
  const out: string[] = [];
  for (const [key, patterns] of Object.entries(AMENITY_PATTERNS)) {
    if (patterns.some((p) => joined.includes(p))) out.push(key);
  }
  return out;
}

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !NAME_STOPWORDS.has(t)),
  );
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchArea(
  apiKey: string,
  query: string,
  maxPages: number,
  vacationRentals: boolean,
): Promise<ScrapedProperty[]> {
  const { checkin, checkout } = stayDates();
  const results: ScrapedProperty[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(SERPAPI_URL);
    url.searchParams.set("engine", "google_hotels");
    url.searchParams.set("q", query);
    if (vacationRentals) url.searchParams.set("vacation_rentals", "true");
    url.searchParams.set("check_in_date", checkin);
    url.searchParams.set("check_out_date", checkout);
    url.searchParams.set("gl", "ca");
    url.searchParams.set("hl", "en");
    url.searchParams.set("currency", "CAD");
    url.searchParams.set("api_key", apiKey);
    if (pageToken) url.searchParams.set("next_page_token", pageToken);

    let data: {
      properties?: {
        name?: string;
        gps_coordinates?: { latitude?: number; longitude?: number };
        amenities?: unknown;
      }[];
      serpapi_pagination?: { next_page_token?: string };
      next_page_token?: string;
      error?: string;
    };
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn({ query, page, status: res.status }, "SerpApi non-2xx");
        break;
      }
      data = await res.json();
    } catch (err) {
      logger.warn({ query, page, err }, "SerpApi request failed");
      break;
    }
    if (data.error) {
      logger.warn({ query, error: data.error }, "SerpApi returned an error");
      break;
    }

    for (const p of data.properties ?? []) {
      const lat = p.gps_coordinates?.latitude;
      const lng = p.gps_coordinates?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number" || !p.name) continue;
      results.push({
        name: p.name,
        lat,
        lng,
        amenities: canonicalizeAmenities(p.amenities),
      });
    }

    pageToken = data.serpapi_pagination?.next_page_token ?? data.next_page_token;
    if (!pageToken) break;
    await new Promise((r) => setTimeout(r, 400)); // courtesy spacing
  }

  logger.info(
    { query, vacationRentals, properties: results.length },
    "search complete",
  );
  return results;
}

function parseArg(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return hit?.split("=")[1];
}

async function main(): Promise<void> {
  const env = loadEnv(logger);
  const apiKey = env.SERPAPI_API_KEY;
  if (!apiKey) {
    logger.error("SERPAPI_API_KEY is not set in the root .env — cannot scrape");
    process.exit(1);
  }
  if (!env.MONGODB_URI) {
    logger.error("MONGODB_URI is not set — cannot persist amenities");
    process.exit(1);
  }

  const areas = (parseArg("areas")?.split(",").map((a) => a.trim()).filter(Boolean)) ??
    DEFAULT_AREAS;
  const maxPages = Math.max(1, Math.min(5, Number(parseArg("pages") ?? 1)));
  const mode = parseArg("mode") ?? "both"; // hotels | rentals | both
  const doHotels = mode === "both" || mode === "hotels";
  const doRentals = mode === "both" || mode === "rentals";

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });
  const Hotel = mongoose.model<HotelDoc>("Hotel", HotelSchema);

  const passesPerArea = (doHotels ? 1 : 0) + (doRentals ? 1 : 0);
  logger.info(
    {
      areas: areas.length,
      maxPages,
      mode,
      estimatedSearches: areas.length * maxPages * passesPerArea,
    },
    "scraping Google Hotels amenities via SerpApi",
  );

  // 1. Scrape all areas (hotels + vacation rentals) into one pool.
  const scraped: ScrapedProperty[] = [];
  for (const area of areas) {
    if (doHotels) {
      scraped.push(
        ...(await fetchArea(apiKey, `hotels in ${area}, Ontario`, maxPages, false)),
      );
    }
    if (doRentals) {
      scraped.push(
        ...(await fetchArea(
          apiKey,
          `vacation rentals in ${area}, Ontario`,
          maxPages,
          true,
        )),
      );
    }
  }
  const withAmenities = scraped.filter((s) => s.amenities.length > 0);
  logger.info(
    { total: scraped.length, withAmenities: withAmenities.length },
    "scrape complete",
  );

  // 2. Load our Toronto-region hotels.
  const hotels = await Hotel.find({
    coordinates: {
      $geoWithin: {
        $box: [
          [TORONTO_REGION_BBOX.west, TORONTO_REGION_BBOX.south],
          [TORONTO_REGION_BBOX.east, TORONTO_REGION_BBOX.north],
        ],
      },
    },
  })
    .lean<HotelDoc[]>()
    .exec();
  logger.info({ hotels: hotels.length }, "loaded region hotels to enrich");

  // 3. Match each hotel to the nearest scraped property (coord + name).
  const updates: { stayId: string; amenities: string[] }[] = [];
  for (const hotel of hotels) {
    const [hlng, hlat] = hotel.coordinates.coordinates;
    const hp = { lat: hlat!, lng: hlng! };
    const tokens = nameTokens(hotel.name);

    let best: ScrapedProperty | undefined;
    let bestDist = Infinity;
    for (const s of withAmenities) {
      const dist = haversineM(hp, { lat: s.lat, lng: s.lng });
      if (dist > MATCH_RADIUS_M || dist >= bestDist) continue;
      const shareName = [...nameTokens(s.name)].some((t) => tokens.has(t));
      if (dist <= MATCH_RADIUS_STRICT_M || shareName) {
        best = s;
        bestDist = dist;
      }
    }
    if (best) {
      updates.push({ stayId: hotel.stayId, amenities: best.amenities });
    }
  }
  logger.info(
    { matched: updates.length, ofHotels: hotels.length },
    "matched hotels to scraped amenities",
  );

  // 4. Persist onto the hotel docs (which already carry the point).
  if (updates.length > 0) {
    await Hotel.bulkWrite(
      updates.map((u) => ({
        updateOne: {
          filter: { stayId: u.stayId },
          update: { $set: { amenities: u.amenities } },
        },
      })),
    );
  }
  logger.info({ updated: updates.length }, "hotel amenities persisted");

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error({ err }, "scrapeHotelAmenities failed");
  process.exit(1);
});
