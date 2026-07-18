import { z } from "zod";

/**
 * Stay22 Direct Travel API — confirmed live against
 * https://api.stay22.com/v2/accommodations (2026-07-18). Source of truth:
 * https://dev.stay22.com/docs/api — re-verify here if Stay22 changes shape.
 */
export const stay22SupplierSchema = z.object({
  id: z.string(),
  link: z.string(),
  media: z.object({ logoSquare: z.string().nullable().optional() }).optional(),
  price: z.object({ total: z.number().nonnegative() }).optional(),
});

export const stay22AccommodationSchema = z.object({
  id: z.string().min(1),
  url: z.string(), // provider-agnostic deeplink, includes our aid tracking
  name: z.string().min(1),
  type: z.string().optional(),
  location: z.object({
    address: z.string().nullable().optional(),
    coordinates: z.object({
      lat: z.number().gte(-90).lte(90).nullable(),
      lng: z.number().gte(-180).lte(180).nullable(),
    }),
    distanceInMeters: z.number().nullable().optional(),
  }),
  rating: z
    .object({
      value: z.number().gte(0).lte(10).nullable().optional(), // guest rating, 0-10
      hotelStars: z.number().gte(0).lte(5).nullable().optional(),
      count: z.number().nullable().optional(),
    })
    .optional(),
  media: z
    .object({ thumbnail: z.string().nullable().optional() })
    .optional(),
  suppliers: z.record(z.string(), stay22SupplierSchema).default({}),
});

export const stay22EnvelopeSchema = z.object({
  results: z.array(z.unknown()),
  meta: z.object({
    currency: z.string().optional(),
    nights: z.number().nullable().optional(),
    total: z.number().int().nonnegative().optional(),
    hasMore: z.boolean().optional(),
  }),
});

export type Stay22Accommodation = z.infer<typeof stay22AccommodationSchema>;

/**
 * Our internal normalized hotel shape — stable across Stay22 wire-format
 * changes; every other module (routes, simulation, frontend) depends on
 * this, not on stay22AccommodationSchema directly.
 */
export const stay22HotelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  supplier: z.string().min(1),
  coordinates: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  }),
  city: z.string().optional(),
  country: z.string().optional(),
  stars: z.number().int().gte(1).lte(5).optional(),
  rating: z.number().gte(0).lte(5).optional(),
  price: z
    .object({
      amount: z.number().nonnegative(),
      currency: z.string().length(3),
      per: z.enum(["night", "stay"]).default("night"),
    })
    .optional(),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  bookingUrl: z.string().url().optional(),
});

export type Stay22Hotel = z.infer<typeof stay22HotelSchema>;

/**
 * Maps a validated Stay22 accommodation record into our internal shape.
 * Returns null when the record lacks usable coordinates (can't be plotted
 * or fed into location-based scoring) — caller discards and logs.
 */
export function mapAccommodationToHotel(
  record: Stay22Accommodation,
  nights: number | null | undefined,
  currency: string | undefined,
): Stay22Hotel | null {
  const { lat, lng } = record.location.coordinates;
  if (lat === null || lng === null) return null;

  const supplierEntries = Object.entries(record.suppliers);
  const [supplierName, supplier] = supplierEntries.find(
    ([, s]) => s.price !== undefined,
  ) ?? supplierEntries[0] ?? ["stay22", undefined];

  let price: Stay22Hotel["price"];
  if (supplier?.price && currency) {
    const n = nights && nights > 0 ? nights : 1;
    price = {
      amount: Math.round((supplier.price.total / n) * 100) / 100,
      currency,
      per: "night",
    };
  }

  // Stay22's guest rating is 0-10; our internal scale (matching Stay22's own
  // hotel-star convention elsewhere in the app) is 0-5.
  const rating =
    record.rating?.value != null
      ? Math.round((record.rating.value / 2) * 10) / 10
      : undefined;

  return {
    id: record.id,
    name: record.name,
    supplier: supplierName,
    coordinates: { lat, lng },
    // No structured city/country in this API (only a freeform address) —
    // left unset rather than unreliably parsed.
    stars: record.rating?.hotelStars ?? undefined,
    rating,
    price,
    // Stay22's accommodations endpoint does not return amenities — genuinely
    // absent, not fabricated.
    amenities: [],
    images: record.media?.thumbnail ? [record.media.thumbnail] : [],
    bookingUrl: record.url,
  };
}
