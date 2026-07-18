import type { Logger } from "pino";
import type { z } from "zod";
import type { MongoConnection } from "../../db/mongo.js";
import type { SimulationEngine } from "../../simulation/index.js";
import type { Stay22Client } from "../../stay22/client.js";
import { analyzeLocationTool } from "./analyzeLocation.js";
import { calculateRevenueTool } from "./calculateRevenue.js";
import { compareCompetitorsTool } from "./compareCompetitors.js";
import { generateInvestmentReportTool } from "./generateInvestmentReport.js";
import { simulateHotelChangeTool } from "./simulateHotelChange.js";

export interface ToolContext {
  engine: SimulationEngine;
  mongo: MongoConnection;
  stay22: Stay22Client;
  logger: Logger;
}

export interface Tool<Args = unknown, Result = unknown> {
  name: string;
  description: string;
  // Input type is `any` because zod schemas with .default() accept looser
  // input than they output; the parse result is still strictly typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  argsSchema: z.ZodType<Args, z.ZodTypeDef, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resultSchema: z.ZodType<unknown, z.ZodTypeDef, any>;
  handler(args: Args, ctx: ToolContext): Promise<Result>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: Tool<any, any>[] = [
  simulateHotelChangeTool,
  calculateRevenueTool,
  analyzeLocationTool,
  compareCompetitorsTool,
  generateInvestmentReportTool,
];
