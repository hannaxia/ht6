import { z } from "zod";
import { coordinateSchema } from "./common.js";

export const opportunityGridQuerySchema = z.object({
  city: z.string().min(1),
  gridSize: z.coerce.number().int().gte(2).lte(60).default(20),
});

const normalizedScore = z.number().gte(0).lte(100);

export const opportunityCellSchema = z.object({
  coordinates: coordinateSchema,
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
});
