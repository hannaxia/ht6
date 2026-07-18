import { z } from "zod";
import { coordinateSchema } from "./common.js";
import {
  competitorSchema,
  locationScoresSchema,
  locationTypeSchema,
} from "./simulation.js";

export const opportunityGridQuerySchema = z.object({
  city: z.string().min(1),
  gridSize: z.coerce.number().int().gte(2).lte(60).default(20),
});

/** Query for GET /locations/context — resolve one coordinate's context. */
export const locationContextQuerySchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  /** Exclude a subject hotel (by Stay22 id) from the competitor set. */
  excludeHotelId: z.string().min(1).optional(),
});

/**
 * Location context resolved from real nearby inventory (Stay22 / Hotels
 * collection) plus seeded Location scores — the accurate, location-aware
 * seed for a sandbox hotel instead of arbitrary defaults. All economic
 * figures remain simulation inputs, not real financial data.
 */
export const locationContextResponseSchema = z.object({
  location: z.object({
    type: locationTypeSchema,
    scores: locationScoresSchema,
    coordinates: coordinateSchema,
    baseDemand: z.number().finite(),
    locationDemand: z.number().finite(),
    locationSatisfaction: z.number().finite(),
  }),
  basePrice: z.number().positive(),
  segmentAdrNorm: z.number().positive(),
  competitors: z.array(competitorSchema),
  nearbyHotelCount: z.number().int().nonnegative(),
  source: z.enum(["stay22", "database", "baseline"]),
  disclaimer: z.string(),
});

const normalizedScore = z.number().gte(0).lte(100);

export const opportunityCellSchema = z.object({
  coordinates: coordinateSchema,
  // Half-width/height of this cell in degrees, so the frontend can render
  // exact edge-to-edge squares (no gaps, no overlap) instead of guessing a
  // fixed radius — cells can vary in size across places with different
  // grid densities.
  cellHalfDegLat: z.number().positive(),
  cellHalfDegLng: z.number().positive(),
  components: z.object({
    revenuePotential: z.number().finite(),
    demand: z.number().finite(),
    segmentWeightedCompetition: z.number().finite(),
    risk: z.number().finite(),
  }),
  normalized: z.object({
    revenuePotential: normalizedScore,
    demand: normalizedScore,
    segmentWeightedCompetition: normalizedScore,
    risk: normalizedScore,
  }),
  opportunityScore: normalizedScore,
});

export const opportunityGridResponseSchema = z.object({
  cells: z.array(opportunityCellSchema),
  disclaimer: z.string(),
  /** True when this response was served from the grid cache collection. */
  cached: z.boolean().optional(),
});
