import express from "express";
import type { Logger } from "pino";
import type { AIConsultant } from "./ai/consultant.js";
import type { MongoConnection } from "./db/mongo.js";
import type { Env } from "./env.js";
import { corsMiddleware } from "./middleware/cors.js";
import {
  errorHandlerMiddleware,
  notFoundHandler,
} from "./middleware/errorHandler.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { requestLoggerMiddleware } from "./middleware/requestLogger.js";
import { aiRouter } from "./routes/ai.js";
import { healthRouter } from "./routes/health.js";
import { hotelsRouter } from "./routes/hotels.js";
import { locationsRouter } from "./routes/locations.js";
import { simulationsRouter } from "./routes/simulations.js";
import type { SimulationEngine } from "./simulation/index.js";
import type { Stay22Client } from "./stay22/client.js";

export interface AppDependencies {
  env: Env;
  logger: Logger;
  mongo: MongoConnection;
  stay22: Stay22Client;
  simulation: SimulationEngine;
  ai: AIConsultant;
}

export function createApp(deps: AppDependencies): express.Express {
  const app = express();
  app.use(corsMiddleware(deps.env));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestIdMiddleware(deps.logger));
  app.use(requestLoggerMiddleware(deps.logger));
  app.use("/health", healthRouter(deps));
  app.use("/hotels", hotelsRouter(deps));
  app.use("/locations", locationsRouter(deps));
  app.use("/simulations", simulationsRouter(deps));
  app.use("/ai", aiRouter(deps));
  app.use(notFoundHandler);
  app.use(errorHandlerMiddleware(deps.logger));
  return app;
}
