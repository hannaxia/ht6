import { z } from "zod";

export const ERROR_CODES = [
  "invalid_request",
  "database_unavailable",
  "ai_not_configured",
  "simulation_output_invalid",
  "internal_error",
  "response_validation_failed",
  "not_found",
] as const;

export const errorEnvelopeSchema = z.object({
  errorCode: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});

export const coordinateSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});
