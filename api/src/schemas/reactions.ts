import { z } from "zod";
import { hotelConfigSchema, simulateHotelOutputSchema } from "./simulation.js";

export const reactionsRequestSchema = z.object({
  before: hotelConfigSchema.nullable(),
  after: hotelConfigSchema,
  beforeMetrics: simulateHotelOutputSchema.nullable(),
  afterMetrics: simulateHotelOutputSchema,
});

export type ReactionsRequest = z.infer<typeof reactionsRequestSchema>;
