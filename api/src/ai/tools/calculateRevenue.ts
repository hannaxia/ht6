import { z } from "zod";
import { hotelConfigSchema } from "../../schemas/simulation.js";
import type { Tool } from "./index.js";

const argsSchema = z.object({ config: hotelConfigSchema });

const resultSchema = z.object({
  revenue: z.number().finite().nonnegative(),
  breakdown: z.object({
    rooms: z.number(),
    adr: z.number(),
    occupancyPct: z.number(),
    nightsPerYear: z.literal(365),
  }),
  disclaimer: z.string(),
});

export const calculateRevenueTool: Tool<
  z.infer<typeof argsSchema>,
  z.infer<typeof resultSchema>
> = {
  name: "calculateRevenue",
  description: "Compute estimated annual room revenue for a configuration.",
  argsSchema,
  resultSchema,
  async handler(args, ctx) {
    const output = await ctx.engine.simulateHotel(args.config);
    ctx.logger.info(
      { tool: "calculateRevenue", revenue: output.revenue },
      "calculateRevenue executed",
    );
    return {
      revenue: output.revenue,
      breakdown: {
        rooms: args.config.rooms,
        adr: output.adr,
        occupancyPct: output.occupancy,
        nightsPerYear: 365,
      },
      disclaimer: output.disclaimer,
    };
  },
};
