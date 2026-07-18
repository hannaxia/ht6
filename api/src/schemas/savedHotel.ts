import { z } from "zod";
import { coordinateSchema } from "./common.js";
import { hotelConfigSchema } from "./simulation.js";

/**
 * Create or update a saved hotel. `id` present → update that record (must
 * belong to the caller); absent → create a new one. `sessionId` is the
 * caller's session identity (Auth0 subject when logged in) and scopes
 * ownership, mirroring how Simulations are attributed.
 */
export const savedHotelUpsertSchema = z.object({
  sessionId: z.string().min(1),
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  /**
   * True for a from-scratch hotel (placed pin); false for one cloned from an
   * existing Stay22 listing. Only settable on create — an update omitting it
   * keeps the existing record's value (see savedHotelService.upsertSavedHotel).
   */
  isCustom: z.boolean().optional(),
  config: hotelConfigSchema,
  metrics: z.record(z.unknown()).nullable().optional(),
});

export const savedHotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  isCustom: z.boolean(),
  config: hotelConfigSchema,
  metrics: z.record(z.unknown()).nullable(),
  coordinates: coordinateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const savedHotelListResponseSchema = z.object({
  savedHotels: z.array(savedHotelSchema),
});

export const savedHotelResponseSchema = z.object({
  savedHotel: savedHotelSchema,
});

export const savedHotelListQuerySchema = z.object({
  sessionId: z.string().min(1),
});

export const savedHotelIdQuerySchema = z.object({
  sessionId: z.string().min(1),
});

export type SavedHotelUpsert = z.infer<typeof savedHotelUpsertSchema>;
export type SavedHotelResponse = z.infer<typeof savedHotelSchema>;
