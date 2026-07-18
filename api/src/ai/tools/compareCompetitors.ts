import { z } from "zod";
import { hotelConfigSchema } from "../../schemas/simulation.js";
import * as competition from "../../simulation/competition.js";
import { competitionWeighting } from "@innsight/config";
import type { Tool } from "./index.js";

const argsSchema = z.object({
  hotel: hotelConfigSchema,
  radiusKm: z.number().positive().lte(50),
});

const competitorSummarySchema = z.object({
  name: z.string(),
  stars: z.number().optional(),
  pricePerNight: z.number().optional(),
  distanceKm: z.number(),
  source: z.literal("Stay22"),
});

const resultSchema = z.object({
  competitors: z.array(competitorSummarySchema),
  segmentPressure: z.number().finite(),
});

export const compareCompetitorsTool: Tool<
  z.infer<typeof argsSchema>,
  z.infer<typeof resultSchema>
> = {
  name: "compareCompetitors",
  description:
    "List nearby Stay22 competitors and estimated segment-weighted pressure.",
  argsSchema,
  resultSchema,
  async handler(args, ctx) {
    const center = args.hotel.location.coordinates;
    const hotels = await ctx.stay22.searchByRadius(center, args.radiusKm);
    const competitors = hotels.map((h) => ({
      name: h.name,
      stars: h.stars,
      pricePerNight: h.price?.per === "night" ? h.price.amount : undefined,
      distanceKm:
        Math.round(competition.haversineKm(center, h.coordinates) * 100) / 100,
      source: "Stay22" as const,
    }));
    const segmentPressure = competition.pressure(
      args.hotel,
      hotels.map((h) => ({
        stars: h.stars,
        pricePerNight: h.price?.per === "night" ? h.price.amount : undefined,
        coordinates: h.coordinates,
      })),
      competitionWeighting,
    );
    ctx.logger.info(
      {
        tool: "compareCompetitors",
        competitors: competitors.length,
        segmentPressure,
      },
      "compareCompetitors executed",
    );
    return { competitors, segmentPressure };
  },
};
