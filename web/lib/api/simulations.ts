import { fetchJson } from "./client";
import {
  simulationResponseSchema,
  type HotelConfigPayload,
  type InvestmentMode,
} from "./schemas";

export const simulationsApi = {
  create(
    config: HotelConfigPayload,
    sessionId: string,
    options?: {
      beforeMetrics?: Record<string, unknown> | null;
      investmentMode?: InvestmentMode;
      startingConfig?: HotelConfigPayload;
      baselineAnnualOperatingProfit?: number;
    },
  ) {
    return fetchJson(
      "/simulations",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          config,
          beforeMetrics: options?.beforeMetrics ?? null,
          investmentMode: options?.investmentMode ?? "new_build",
          startingConfig: options?.startingConfig,
          baselineAnnualOperatingProfit: options?.baselineAnnualOperatingProfit,
        }),
      },
      simulationResponseSchema,
    );
  },
};
