/**
 * Seeds the `Locations` collection with Toronto neighbourhood data so the
 * opportunity heatmap has real per-area variation instead of falling back
 * to the flat, neutral-score default (see README → "Remaining work after
 * keys are in"). Run with:
 *   pnpm --filter @innsight/api seed:locations
 *
 * Scores (tourism/business/transit, all 0-1) and population/hotel density
 * are directional estimates for demo purposes, not verified market data.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pino } from "pino";
import { LocationSchema, type LocationDoc } from "../db/models/Location.js";
import { loadEnv } from "../env.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
dotenv.config({ path: path.join(repoRoot, ".env") });

const logger = pino({ level: "info" });

type SeedLocation = Pick<
  LocationDoc,
  | "city"
  | "country"
  | "coordinates"
  | "tourism_score"
  | "business_score"
  | "transit_score"
  | "population_density"
  | "hotel_density"
>;

const TORONTO_LOCATIONS: SeedLocation[] = [
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.3832, 43.6532] },
    tourism_score: 0.85,
    business_score: 0.9,
    transit_score: 0.95,
    population_density: 9500,
    hotel_density: 28,
  }, // Downtown / Financial District
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.3871, 43.6426] },
    tourism_score: 0.95,
    business_score: 0.55,
    transit_score: 0.85,
    population_density: 7200,
    hotel_density: 22,
  }, // Entertainment District / CN Tower area
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.3789, 43.6677] },
    tourism_score: 0.6,
    business_score: 0.5,
    transit_score: 0.8,
    population_density: 8100,
    hotel_density: 8,
  }, // Yorkville
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.3568, 43.6656] },
    tourism_score: 0.5,
    business_score: 0.35,
    transit_score: 0.75,
    population_density: 6900,
    hotel_density: 4,
  }, // Cabbagetown / Riverdale
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.3957, 43.6389] },
    tourism_score: 0.65,
    business_score: 0.4,
    transit_score: 0.6,
    population_density: 5200,
    hotel_density: 6,
  }, // Waterfront / Harbourfront
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.4, 43.6555] },
    tourism_score: 0.55,
    business_score: 0.45,
    transit_score: 0.7,
    population_density: 5800,
    hotel_density: 5,
  }, // Liberty Village / King West
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.4111, 43.6629] },
    tourism_score: 0.3,
    business_score: 0.3,
    transit_score: 0.55,
    population_density: 4300,
    hotel_density: 2,
  }, // Little Italy / Trinity Bellwoods
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.4, 43.7] },
    tourism_score: 0.2,
    business_score: 0.4,
    transit_score: 0.6,
    population_density: 4600,
    hotel_density: 3,
  }, // Midtown / Yonge-Eglinton
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.4111, 43.7615] },
    tourism_score: 0.15,
    business_score: 0.5,
    transit_score: 0.65,
    population_density: 4900,
    hotel_density: 4,
  }, // North York Centre
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.2578, 43.7764] },
    tourism_score: 0.1,
    business_score: 0.25,
    transit_score: 0.4,
    population_density: 3200,
    hotel_density: 1,
  }, // Scarborough Town Centre
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.5433, 43.6435] },
    tourism_score: 0.1,
    business_score: 0.2,
    transit_score: 0.35,
    population_density: 2900,
    hotel_density: 1,
  }, // Etobicoke
  {
    city: "Toronto",
    country: "Canada",
    coordinates: { type: "Point", coordinates: [-79.6, 43.68] },
    tourism_score: 0.35,
    business_score: 0.15,
    transit_score: 0.2,
    population_density: 1400,
    hotel_density: 3,
  }, // Pearson Airport corridor
];

async function main(): Promise<void> {
  const env = loadEnv(logger);
  if (!env.MONGODB_URI) {
    logger.error(
      { variable: "MONGODB_URI" },
      "MONGODB_URI is not set — cannot seed locations",
    );
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });
  logger.info("MongoDB connected");
  const Location = mongoose.model("Location", LocationSchema);

  const result = await Location.bulkWrite(
    TORONTO_LOCATIONS.map((loc) => ({
      updateOne: {
        filter: {
          city: loc.city,
          "coordinates.coordinates": loc.coordinates.coordinates,
        },
        update: { $set: loc },
        upsert: true,
      },
    })),
  );
  logger.info(
    {
      matched: result.matchedCount,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    },
    "seeded Toronto locations",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error({ err }, "seed script failed");
  process.exit(1);
});
