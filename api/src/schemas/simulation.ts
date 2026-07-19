import { z } from "zod";
import { DISCLAIMER } from "../simulation/index.js";
import { coordinateSchema } from "./common.js";

export const hotelTypeSchema = z.enum([
  "budget",
  "midscale",
  "upscale",
  "luxury",
  "resort",
  "extended_stay",
]);

export const locationTypeSchema = z.enum([
  "downtown",
  "airport",
  "resort",
  "business_district",
  "suburban",
]);

export const locationScoresSchema = z.object({
  transit: z.number().gte(0).lte(1),
  airport: z.number().gte(0).lte(1),
  tourism: z.number().gte(0).lte(1),
  business: z.number().gte(0).lte(1),
});

export const competitorSchema = z.object({
  stars: z.number().int().gte(1).lte(5).optional(),
  hotelType: hotelTypeSchema.optional(),
  pricePerNight: z.number().nonnegative().optional(),
  coordinates: coordinateSchema,
});

/** Request body for POST /simulations (the full sandbox hotel configuration). */
export const hotelConfigSchema = z.object({
  hotelType: hotelTypeSchema,
  rooms: z.number().int().nonnegative(),
  stars: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  modernity: z.number().gte(0).lte(1),
  // Renovation CapEx intent. No longer surfaced as its own sandbox control
  // (it overlapped conceptually with modernity); defaults to 0 so requests
  // may omit it, while the engine's investment model still supports it for
  // the AI consultant / existing-hotel upgrade scenarios.
  renovationDelta: z.number().gte(0).lte(1).default(0),
  amenities: z.array(z.string()),
  targetSegment: z.enum(["leisure", "business", "mixed"]),
  basePrice: z.number().positive(),
  segmentAdrNorm: z.number().positive(),
  location: z.object({
    type: locationTypeSchema,
    scores: locationScoresSchema,
    coordinates: coordinateSchema,
    baseDemand: z.number().finite(),
    locationDemand: z.number().finite(),
    locationSatisfaction: z.number().finite(),
  }),
  competitors: z.array(competitorSchema).default([]),
  baseRating: z.number().gte(1).lte(5).default(3.5),
});

export const simulationRequestSchema = z.object({
  sessionId: z.string().min(1),
  startingHotelId: z.string().nullable().optional(),
  config: hotelConfigSchema,
  investmentMode: z.enum(["new_build", "upgrade"]).default("new_build"),
  // Starting config for upgrade scenarios (existing hotel) so CapEx reflects
  // only incremental changes instead of full rebuild cost.
  startingConfig: hotelConfigSchema.optional(),
  // Baseline annual operating profit of the starting config; when present in
  // upgrade mode, ROI/payback are based on uplift profit.
  baselineAnnualOperatingProfit: z.number().nonnegative().optional(),
  /** The sandbox's previous metrics, persisted as beforeMetrics when present. */
  beforeMetrics: z.record(z.unknown()).nullable().optional(),
  changes: z.record(z.unknown()).optional(),
});

/** Bounds check on every simulation output before it leaves the process. */
export const simulateHotelOutputSchema = z.object({
  adr: z.number().finite().positive(),
  occupancy: z.number().finite().gte(0).lte(100),
  revenue: z.number().finite().nonnegative(),
  rating: z.number().finite().gte(1.0).lte(5.0),
  investment: z.number().finite().nonnegative(),
  annualOperatingProfit: z.number().finite().nonnegative(),
  roi: z.number().finite().nonnegative(),
  paybackYears: z.union([
    z.number().finite().positive(),
    z.literal(Number.POSITIVE_INFINITY),
  ]),
  intermediates: z.object({
    locationMultiplier: z.number().finite().positive(),
    qualityMultiplier: z.number().finite().positive(),
    amenityImpactPct: z.number().finite(),
    competitionPressure: z.number().finite(),
    amenitySatisfaction: z.number().finite(),
    priceExpectationPenalty: z.number().finite(),
  }),
  disclaimer: z.literal(DISCLAIMER),
});

export const simulationResponseSchema = z.object({
  result: simulateHotelOutputSchema,
  simulationId: z.string(),
  disclaimer: z.literal(DISCLAIMER),
});

export type HotelConfigInput = z.infer<typeof hotelConfigSchema>;
export type SimulationRequest = z.infer<typeof simulationRequestSchema>;
