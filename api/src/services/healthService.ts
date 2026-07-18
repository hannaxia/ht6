import type { MongoConnection, Readiness } from "../db/mongo.js";
import type { Stay22Client } from "../stay22/client.js";

export interface HealthResponse {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  dependencies: {
    mongodb: Readiness;
    stay22: Readiness;
    gemini: Readiness;
  };
}

export function buildHealthResponse(
  mongo: MongoConnection,
  stay22: Stay22Client,
  geminiReadiness: Readiness,
): HealthResponse {
  const dependencies = {
    mongodb: mongo.readiness,
    stay22: stay22.readiness,
    gemini: geminiReadiness,
  };
  const allReady = Object.values(dependencies).every((d) => d === "ready");
  return {
    status: allReady ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
    dependencies,
  };
}
