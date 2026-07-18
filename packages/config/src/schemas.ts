import { z } from "zod";

const HOTEL_TYPES = [
  "budget",
  "midscale",
  "upscale",
  "luxury",
  "resort",
  "extended_stay",
] as const;

const finiteNumber = z.number().finite();
const nonNegativeCost = z.number().finite().nonnegative();

export const amenityImpactEntrySchema = z.record(
  z.string(),
  finiteNumber.optional(),
);

export const amenityImpactTableSchema = z.record(
  z.string(),
  amenityImpactEntrySchema,
);

export const amenityImpactCapSchema = z.number().finite().positive();

export const competitionWeightingSchema = z.object({
  starLevelWeight: finiteNumber.nonnegative(),
  typeMatchWeight: finiteNumber.nonnegative(),
  priceBandWeight: finiteNumber.nonnegative(),
  radiusKm: finiteNumber.positive(),
  pressurePerCompetitor: finiteNumber.nonnegative(),
  priceBandUsd: finiteNumber.positive(),
});

const starCostsSchema = z.object({
  1: nonNegativeCost,
  2: nonNegativeCost,
  3: nonNegativeCost,
  4: nonNegativeCost,
  5: nonNegativeCost,
});

export const costTableSchema = z.object({
  perRoom: z.object(
    Object.fromEntries(HOTEL_TYPES.map((t) => [t, starCostsSchema])) as Record<
      (typeof HOTEL_TYPES)[number],
      typeof starCostsSchema
    >,
  ),
  perAmenity: z.record(z.string(), nonNegativeCost),
  renovationPerRoom: nonNegativeCost,
});

export const operatingMarginSchema = z.number().finite().gt(0).lt(1);

export const usdToCadRateSchema = z.number().finite().positive();

export const riskWeightsSchema = z.object({
  volatility: finiteNumber.nonnegative(),
  relConstructionCost: finiteNumber.nonnegative(),
  demandConcentration: finiteNumber.nonnegative(),
});

export const opportunityWeightsSchema = z.object({
  revenuePotential: finiteNumber.nonnegative(),
  demand: finiteNumber.nonnegative(),
  segmentWeightedCompetition: finiteNumber.nonnegative(),
  risk: finiteNumber.nonnegative(),
});

export const configSchema = z.object({
  amenityImpactTable: amenityImpactTableSchema,
  amenityImpactCap: amenityImpactCapSchema,
  competitionWeighting: competitionWeightingSchema,
  costTable: costTableSchema,
  operatingMargin: operatingMarginSchema,
  riskWeights: riskWeightsSchema,
  opportunityWeights: opportunityWeightsSchema,
  usdToCadRate: usdToCadRateSchema,
});

export type LoadedConfig = z.infer<typeof configSchema>;
