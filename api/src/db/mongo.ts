import mongoose from "mongoose";
import type { Logger } from "pino";
import type { Env } from "../env.js";
import { HotelSchema, type HotelModel } from "./models/Hotel.js";
import { LocationSchema, type LocationModel } from "./models/Location.js";
import {
  OpportunityGridCacheSchema,
  type OpportunityGridCacheModel,
} from "./models/OpportunityGridCache.js";
import {
  SimulationSchema,
  type SimulationModel,
} from "./models/Simulation.js";

export type Readiness = "ready" | "not_configured" | "error";

export interface MongoModels {
  Hotel: HotelModel;
  Location: LocationModel;
  Simulation: SimulationModel;
  OpportunityGridCache: OpportunityGridCacheModel;
}

export interface MongoConnection {
  readiness: Readiness;
  models: MongoModels;
  close(): Promise<void>;
}

function buildModels(): MongoModels {
  return {
    Hotel: mongoose.model("Hotel", HotelSchema),
    Location: mongoose.model("Location", LocationSchema),
    Simulation: mongoose.model("Simulation", SimulationSchema),
    OpportunityGridCache: mongoose.model(
      "OpportunityGridCache",
      OpportunityGridCacheSchema,
    ),
  };
}

/**
 * Model stubs whose every method throws, so accidental DB use while degraded
 * surfaces at the boundary instead of silently succeeding.
 */
function buildDetachedModels(): MongoModels {
  const detached = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined; // not a thenable
        return () => {
          throw new Error(
            "MongoDB is not available (not_configured or error) — this model must not be used while degraded",
          );
        };
      },
    },
  );
  return {
    Hotel: detached as HotelModel,
    Location: detached as LocationModel,
    Simulation: detached as SimulationModel,
    OpportunityGridCache: detached as OpportunityGridCacheModel,
  };
}

export async function connectMongo(
  env: Env,
  logger: Logger,
): Promise<MongoConnection> {
  if (!env.MONGODB_URI) {
    logger.warn(
      { variable: "MONGODB_URI" },
      "MongoDB not configured; running in degraded mode",
    );
    return {
      readiness: "not_configured",
      models: buildDetachedModels(),
      close: async () => {},
    };
  }
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5_000,
    });
    await mongoose.connection.db?.admin().ping();
    logger.info("MongoDB connected");
    return {
      readiness: "ready",
      models: buildModels(),
      close: () => mongoose.disconnect(),
    };
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    return {
      readiness: "error",
      models: buildDetachedModels(),
      close: async () => {},
    };
  }
}
