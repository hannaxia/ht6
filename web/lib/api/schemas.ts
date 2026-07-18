import { z } from "zod";

export const DISCLAIMER =
  "All predicted metrics are simulation estimates and not real financial data.";

export const errorEnvelopeSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const coordinateSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const stay22HotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  supplier: z.string(),
  coordinates: coordinateSchema,
  city: z.string().optional(),
  country: z.string().optional(),
  stars: z.number().optional(),
  rating: z.number().optional(),
  price: z
    .object({
      amount: z.number(),
      currency: z.string(),
      per: z.enum(["night", "stay"]),
    })
    .optional(),
  amenities: z.array(z.string()),
  images: z.array(z.string()),
  bookingUrl: z.string().optional(),
});

export const hotelsListResponseSchema = z.object({
  hotels: z.array(stay22HotelSchema),
  source: z.literal("Stay22"),
});

export const simulateHotelOutputSchema = z.object({
  adr: z.number(),
  occupancy: z.number(),
  revenue: z.number(),
  rating: z.number(),
  investment: z.number(),
  annualOperatingProfit: z.number(),
  roi: z.number(),
  // Infinity serializes to null in JSON; accept both.
  paybackYears: z.number().nullable(),
  intermediates: z.object({
    locationMultiplier: z.number(),
    qualityMultiplier: z.number(),
    amenityImpactPct: z.number(),
    competitionPressure: z.number(),
    amenitySatisfaction: z.number(),
    priceExpectationPenalty: z.number(),
  }),
  disclaimer: z.string().optional(),
});

export const simulationResponseSchema = z.object({
  result: simulateHotelOutputSchema,
  simulationId: z.string(),
  disclaimer: z.string().optional(),
});

export const opportunityCellSchema = z.object({
  coordinates: coordinateSchema,
  components: z.object({
    revenuePotential: z.number(),
    demand: z.number(),
    segmentWeightedCompetition: z.number(),
    risk: z.number(),
  }),
  normalized: z.object({
    revenuePotential: z.number(),
    demand: z.number(),
    segmentWeightedCompetition: z.number(),
    risk: z.number(),
  }),
  opportunityScore: z.number(),
});

export const opportunityGridResponseSchema = z.object({
  cells: z.array(opportunityCellSchema),
  disclaimer: z.string().optional(),
});

export const locationContextResponseSchema = z.object({
  location: z.object({
    type: z.enum([
      "downtown",
      "airport",
      "resort",
      "business_district",
      "suburban",
    ]),
    scores: z.object({
      transit: z.number(),
      airport: z.number(),
      tourism: z.number(),
      business: z.number(),
    }),
    coordinates: coordinateSchema,
    baseDemand: z.number(),
    locationDemand: z.number(),
    locationSatisfaction: z.number(),
  }),
  basePrice: z.number(),
  segmentAdrNorm: z.number(),
  competitors: z.array(
    z.object({
      stars: z.number().optional(),
      hotelType: z.string().optional(),
      pricePerNight: z.number().optional(),
      coordinates: coordinateSchema,
    }),
  ),
  nearbyHotelCount: z.number(),
  source: z.enum(["stay22", "database", "baseline"]),
  disclaimer: z.string().optional(),
});

export const aiConsultResponseSchema = z.object({
  message: z.string(),
  deltas: z.object({
    hotel: z.record(z.unknown()).optional(),
    simulation: simulateHotelOutputSchema.partial().optional(),
  }),
  disclaimer: z.string().optional(),
});

export type Stay22Hotel = z.infer<typeof stay22HotelSchema>;
export type SimulateHotelOutput = z.infer<typeof simulateHotelOutputSchema>;
export type OpportunityCell = z.infer<typeof opportunityCellSchema>;
export type AiConsultResponse = z.infer<typeof aiConsultResponseSchema>;
export type LocationContext = z.infer<typeof locationContextResponseSchema>;

/** The sandbox hotel configuration sent to POST /simulations. */
export const hotelConfigPayloadSchema = z.object({
  hotelType: z.enum([
    "budget",
    "midscale",
    "upscale",
    "luxury",
    "resort",
    "extended_stay",
  ]),
  rooms: z.number(),
  stars: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  modernity: z.number(),
  amenities: z.array(z.string()),
  targetSegment: z.enum(["leisure", "business", "mixed"]),
  basePrice: z.number(),
  segmentAdrNorm: z.number(),
  location: z.object({
    type: z.enum([
      "downtown",
      "airport",
      "resort",
      "business_district",
      "suburban",
    ]),
    scores: z.object({
      transit: z.number(),
      airport: z.number(),
      tourism: z.number(),
      business: z.number(),
    }),
    coordinates: coordinateSchema,
    baseDemand: z.number(),
    locationDemand: z.number(),
    locationSatisfaction: z.number(),
  }),
  competitors: z.array(z.unknown()),
  baseRating: z.number(),
});

export type HotelConfigPayload = z.infer<typeof hotelConfigPayloadSchema>;

/** A saved sandbox hotel returned by the /saved-hotels endpoints. */
export const savedHotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  isCustom: z.boolean(),
  config: hotelConfigPayloadSchema,
  metrics: simulateHotelOutputSchema.partial().nullable(),
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

export type SavedHotel = z.infer<typeof savedHotelSchema>;
