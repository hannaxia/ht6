import { z } from "zod";
import { stay22HotelSchema } from "../stay22/schemas.js";

export const hotelsQuerySchema = z
  .object({
    city: z.string().min(1).optional(),
    bbox: z
      .string()
      .regex(
        /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
        "bbox must be west,south,east,north",
      )
      .optional(),
    lat: z.coerce.number().gte(-90).lte(90).optional(),
    lng: z.coerce.number().gte(-180).lte(180).optional(),
    radiusKm: z.coerce.number().positive().lte(100).optional(),
  })
  .refine(
    (q) =>
      q.city !== undefined ||
      q.bbox !== undefined ||
      (q.lat !== undefined && q.lng !== undefined && q.radiusKm !== undefined),
    {
      message:
        "provide city, bbox (west,south,east,north), or lat+lng+radiusKm",
    },
  );

export const hotelsListResponseSchema = z.object({
  hotels: z.array(stay22HotelSchema),
  source: z.literal("Stay22"),
});

export const roomEstimateResponseSchema = z.object({
  rooms: z.number().int().positive().nullable(),
  // "cached" = already stored from a prior lookup; "estimated" = a fresh
  // confident Gemini answer just cached; "unknown" = no confident answer
  // (nothing cached, retryable later).
  source: z.enum(["cached", "estimated", "unknown"]),
});
