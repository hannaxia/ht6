import { z } from "zod";
import { hotelConfigSchema } from "../../schemas/simulation.js";
import type { Tool } from "./index.js";

const argsSchema = z.object({ config: hotelConfigSchema });

const resultSchema = z.object({
  investment: z.number().finite().nonnegative(),
  annualOperatingProfit: z.number().finite().nonnegative(),
  roi: z.number().finite().nonnegative(),
  paybackYears: z.union([
    z.number().finite().positive(),
    z.literal(Number.POSITIVE_INFINITY),
  ]),
  narrativeSummary: z.string(),
});

export const generateInvestmentReportTool: Tool<
  z.infer<typeof argsSchema>,
  z.infer<typeof resultSchema>
> = {
  name: "generateInvestmentReport",
  description: "Produce an estimated investment report for a configuration.",
  argsSchema,
  resultSchema,
  async handler(args, ctx) {
    const output = await ctx.engine.simulateHotel(args.config);
    const paybackText = Number.isFinite(output.paybackYears)
      ? `${output.paybackYears.toFixed(1)} years`
      : "never (zero estimated operating profit)";
    ctx.logger.info(
      { tool: "generateInvestmentReport", investment: output.investment },
      "generateInvestmentReport executed",
    );
    return {
      investment: output.investment,
      annualOperatingProfit: output.annualOperatingProfit,
      roi: output.roi,
      paybackYears: output.paybackYears,
      narrativeSummary:
        `Estimated investment of $${Math.round(output.investment).toLocaleString()} CAD ` +
        `for a ${args.config.rooms}-room ${args.config.stars}-star ${args.config.hotelType} hotel. ` +
        `Estimated annual operating profit $${Math.round(output.annualOperatingProfit).toLocaleString()} CAD ` +
        `(ROI ${(output.roi * 100).toFixed(1)}%, payback ${paybackText}). ` +
        `All figures are simulation estimates, not real financial data.`,
    };
  },
};
