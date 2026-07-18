/**
 * Scrapes Stay22 hotel inventory for a curated list of Canadian cities and
 * upserts into the `Hotels` collection, keyed by `stayId`. Run manually
 * (or on a schedule) to (re)populate the map's hotel markers — the live
 * `/hotels` route reads from MongoDB, not Stay22 directly, so this script
 * is the only thing that talks to Stay22 for hotel data.
 *
 * Rate-limit safety: Stay22's standard tier caps at 150 req/min (sliding
 * window). Each city here uses maxWindows=1, maxPagesPerWindow=2 (≤2
 * requests/city), plus a delay between cities, keeping this comfortably
 * under the limit even for the full list.
 *
 * Run with:
 *   pnpm --filter @innsight/api scrape:hotels
 *   pnpm --filter @innsight/api scrape:hotels -- --cities=toronto,ottawa
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pino } from "pino";
import { HotelSchema } from "../db/models/Hotel.js";
import { loadEnv } from "../env.js";
import { createStay22Client, type BoundingBox } from "../stay22/client.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
dotenv.config({ path: path.join(repoRoot, ".env") });

const logger = pino({ level: "info" });

/**
 * Curated Canadian cities with small bounding boxes (city-core sized —
 * the size that reliably returns local results rather than Stay22's
 * highest-ranked properties anywhere; see DiscoverPage / locationService
 * comments for why province/country-wide boxes don't work).
 * [west, south, east, north]
 */
const CANADIAN_CITIES: Record<string, BoundingBox> = {
  toronto: { west: -79.64, south: 43.58, east: -79.12, north: 43.85 },
  ottawa: { west: -76.0, south: 45.2, east: -75.4, north: 45.6 },
  hamiltonNiagara: { west: -80.1, south: 42.9, east: -79.0, north: 43.4 },
  londonWindsorON: { west: -83.2, south: 42.0, east: -80.9, north: 43.1 },
  kingston: { west: -76.7, south: 44.0, east: -76.2, north: 44.4 },
  barrie: { west: -80.0, south: 44.2, east: -79.4, north: 44.6 },
  sudburyNorthBay: { west: -81.3, south: 46.2, east: -79.2, north: 46.7 },
  thunderBay: { west: -89.6, south: 48.2, east: -89.0, north: 48.6 },
  kenora: { west: -94.8, south: 49.6, east: -94.3, north: 49.9 },
  montreal: { west: -73.9, south: 45.4, east: -73.4, north: 45.7 },
  quebecCity: { west: -71.4, south: 46.7, east: -71.1, north: 46.9 },
  vancouver: { west: -123.3, south: 49.2, east: -123.0, north: 49.35 },
  victoria: { west: -123.5, south: 48.4, east: -123.3, north: 48.5 },
  calgary: { west: -114.3, south: 50.9, east: -113.9, north: 51.2 },
  edmonton: { west: -113.7, south: 53.4, east: -113.3, north: 53.7 },
  winnipeg: { west: -97.3, south: 49.8, east: -97.0, north: 49.95 },
  halifax: { west: -63.7, south: 44.6, east: -63.5, north: 44.7 },
  stJohnsNL: { west: -52.8, south: 47.5, east: -52.6, north: 47.65 },
  saskatoon: { west: -106.8, south: 52.05, east: -106.5, north: 52.2 },
  regina: { west: -104.7, south: 50.4, east: -104.5, north: 50.5 },
  whitehorse: { west: -135.2, south: 60.65, east: -135.0, north: 60.75 },
  yellowknife: { west: -114.5, south: 62.4, east: -114.3, north: 62.5 },
};

const DELAY_BETWEEN_CITIES_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCitiesArg(): string[] | null {
  const arg = process.argv.find((a) => a.startsWith("--cities="));
  if (!arg) return null;
  return arg
    .slice("--cities=".length)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const env = loadEnv(logger);
  if (!env.MONGODB_URI) {
    logger.error(
      { variable: "MONGODB_URI" },
      "MONGODB_URI is not set — cannot scrape into the database",
    );
    process.exit(1);
  }
  if (!env.STAY22_API_KEY) {
    logger.error(
      { variable: "STAY22_API_KEY" },
      "STAY22_API_KEY is not set — nothing to scrape",
    );
    process.exit(1);
  }

  const requestedCities = parseCitiesArg();
  const cityEntries = Object.entries(CANADIAN_CITIES).filter(
    ([name]) => !requestedCities || requestedCities.includes(name),
  );
  if (cityEntries.length === 0) {
    logger.error({ requestedCities }, "no matching cities to scrape");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });
  logger.info("MongoDB connected");
  const Hotel = mongoose.model("Hotel", HotelSchema);
  const stay22 = createStay22Client(env, logger);

  let totalUpserted = 0;
  let totalMatched = 0;
  let citiesWithZero = 0;

  for (const [cityName, bbox] of cityEntries) {
    const hotels = await stay22.searchByBoundingBox(bbox, {
      maxWindows: 1,
      maxPagesPerWindow: 2,
    });
    if (hotels.length === 0) {
      citiesWithZero += 1;
      logger.warn({ city: cityName }, "no hotels returned for this city");
    } else {
      const result = await Hotel.bulkWrite(
        hotels.map((h) => ({
          updateOne: {
            filter: { stayId: h.id },
            update: {
              $set: {
                stayId: h.id,
                name: h.name,
                supplier: h.supplier,
                city: cityName,
                country: "Canada",
                stars: h.stars,
                rating: h.rating,
                price: h.price,
                amenities: h.amenities,
                images: h.images,
                coordinates: {
                  type: "Point",
                  coordinates: [h.coordinates.lng, h.coordinates.lat],
                },
              },
            },
            upsert: true,
          },
        })),
      );
      totalUpserted += result.upsertedCount;
      totalMatched += result.matchedCount;
      logger.info(
        {
          city: cityName,
          found: hotels.length,
          upserted: result.upsertedCount,
          updated: result.matchedCount,
        },
        "city scraped",
      );
    }
    await sleep(DELAY_BETWEEN_CITIES_MS);
  }

  const totalInDb = await Hotel.countDocuments({ country: "Canada" });
  logger.info(
    {
      citiesScraped: cityEntries.length,
      citiesWithZero,
      totalUpserted,
      totalMatched,
      totalCanadianHotelsInDb: totalInDb,
    },
    "scrape complete",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error({ err }, "scrape script failed");
  process.exit(1);
});
