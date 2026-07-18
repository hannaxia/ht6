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

/** The sandbox hotel configuration sent to POST /simulations. */
export interface HotelConfigPayload {
  hotelType:
    | "budget"
    | "midscale"
    | "upscale"
    | "luxury"
    | "resort"
    | "extended_stay";
  rooms: number;
  stars: 1 | 2 | 3 | 4 | 5;
  modernity: number;
  renovationDelta: number;
  amenities: string[];
  targetSegment: "leisure" | "business" | "mixed";
  basePrice: number;
  segmentAdrNorm: number;
  location: {
    type:
      | "downtown"
      | "airport"
      | "resort"
      | "business_district"
      | "suburban";
    scores: {
      transit: number;
      airport: number;
      tourism: number;
      business: number;
    };
    coordinates: { lat: number; lng: number };
    baseDemand: number;
    locationDemand: number;
    locationSatisfaction: number;
  };
  competitors: unknown[];
  baseRating: number;
}
