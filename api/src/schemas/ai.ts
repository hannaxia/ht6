import { z } from "zod";
import { DISCLAIMER } from "../simulation/index.js";
import { simulateHotelOutputSchema } from "./simulation.js";

export const aiConsultRequestSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1).max(4000),
  context: z.unknown().optional(),
});

export const aiConsultResponseSchema = z.object({
  message: z.string().min(1),
  deltas: z
    .object({
      hotel: z.record(z.unknown()).optional(),
      simulation: simulateHotelOutputSchema.partial().optional(),
    })
    .default({}),
  disclaimer: z.literal(DISCLAIMER),
});

export type AiConsultRequest = z.infer<typeof aiConsultRequestSchema>;
export type AiConsultResponse = z.infer<typeof aiConsultResponseSchema>;
