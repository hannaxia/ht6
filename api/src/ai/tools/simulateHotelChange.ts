import { z } from "zod";
import {
  hotelConfigSchema,
  simulateHotelOutputSchema,
} from "../../schemas/simulation.js";
import type { SimulateHotelOutput } from "../../simulation/index.js";
import type { Tool } from "./index.js";

const argsSchema = z.object({
  base: hotelConfigSchema,
  changes: hotelConfigSchema.partial(),
});

const resultSchema = z.object({
  before: simulateHotelOutputSchema,
  after: simulateHotelOutputSchema,
});

export const simulateHotelChangeTool: Tool<
  z.infer<typeof argsSchema>,
  { before: SimulateHotelOutput; after: SimulateHotelOutput }
> = {
  name: "simulateHotelChange",
  description: "Simulate a hotel before and after configuration changes.",
  argsSchema,
  resultSchema,
  async handler(args, ctx) {
    const before = ctx.engine.simulateHotel(args.base);
    const after = ctx.engine.simulateHotel({ ...args.base, ...args.changes });
    ctx.logger.info(
      {
        tool: "simulateHotelChange",
        changedFields: Object.keys(args.changes),
        adrBefore: before.adr,
        adrAfter: after.adr,
      },
      "simulateHotelChange executed",
    );
    return { before, after };
  },
};
