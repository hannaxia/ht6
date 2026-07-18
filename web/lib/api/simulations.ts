import { fetchJson } from "./client";
import {
  simulationResponseSchema,
  type HotelConfigPayload,
} from "./schemas";

export const simulationsApi = {
  create(
    config: HotelConfigPayload,
    sessionId: string,
    beforeMetrics?: Record<string, unknown> | null,
  ) {
    return fetchJson(
      "/simulations",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          config,
          beforeMetrics: beforeMetrics ?? null,
        }),
      },
      simulationResponseSchema,
    );
  },
};
