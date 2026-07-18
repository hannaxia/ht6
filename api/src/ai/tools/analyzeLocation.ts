import { z } from "zod";
import { coordinateSchema } from "../../schemas/common.js";
import { opportunityCellSchema } from "../../schemas/grid.js";
import { computeCityOpportunityGrid } from "../../services/locationService.js";
import type { Tool } from "./index.js";

const argsSchema = z.object({
  city: z.string().min(1),
  coordinates: coordinateSchema.optional(),
});

const resultSchema = z.object({
  city: z.string(),
  cellCount: z.number().int().nonnegative(),
  topCells: z.array(opportunityCellSchema),
  focusCell: opportunityCellSchema.nullable(),
});

export const analyzeLocationTool: Tool<
  z.infer<typeof argsSchema>,
  z.infer<typeof resultSchema>
> = {
  name: "analyzeLocation",
  description: "Analyze a city's estimated opportunity grid.",
  argsSchema,
  resultSchema,
  async handler(args, ctx) {
    const cells = await computeCityOpportunityGrid(
      args.city,
      12,
      ctx.engine,
      ctx.mongo,
      ctx.stay22,
      ctx.logger,
    );
    const sorted = [...cells].sort(
      (a, b) => b.opportunityScore - a.opportunityScore,
    );
    let focusCell = null;
    if (args.coordinates) {
      const { lat, lng } = args.coordinates;
      focusCell =
        [...cells].sort(
          (a, b) =>
            (a.coordinates.lat - lat) ** 2 +
            (a.coordinates.lng - lng) ** 2 -
            ((b.coordinates.lat - lat) ** 2 + (b.coordinates.lng - lng) ** 2),
        )[0] ?? null;
    }
    ctx.logger.info(
      { tool: "analyzeLocation", city: args.city, cells: cells.length },
      "analyzeLocation executed",
    );
    return {
      city: args.city,
      cellCount: cells.length,
      topCells: sorted.slice(0, 5),
      focusCell,
    };
  },
};
