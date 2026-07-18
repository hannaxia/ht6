import type { Logger } from "pino";
import type { MongoConnection } from "../db/mongo.js";
import {
  simulateHotelOutputSchema,
  type SimulationRequest,
} from "../schemas/simulation.js";
import type {
  SimulateHotelOutput,
  SimulationEngine,
} from "../simulation/index.js";

export class SimulationOutputInvalidError extends Error {
  constructor(public readonly issues: unknown) {
    super("simulation output failed bounds validation");
    this.name = "SimulationOutputInvalidError";
  }
}

/**
 * Runs the engine, bounds-validates the output, persists a Simulations doc.
 * Throws SimulationOutputInvalidError when the engine's output violates the
 * bounds schema (defense in depth on top of in-formula checks).
 */
export async function runAndPersistSimulation(
  request: SimulationRequest,
  engine: SimulationEngine,
  mongo: MongoConnection,
  logger: Logger,
): Promise<{ result: SimulateHotelOutput; simulationId: string }> {
  const output = engine.simulateHotel({
    ...request.config,
    competitors: request.config.competitors ?? [],
  });

  const validated = simulateHotelOutputSchema.safeParse(output);
  if (!validated.success) {
    logger.error(
      { input: request.config, issues: validated.error.issues },
      "simulation output failed bounds validation",
    );
    throw new SimulationOutputInvalidError(validated.error.issues);
  }

  const doc = await mongo.models.Simulation.create({
    sessionId: request.sessionId,
    startingHotelId: request.startingHotelId ?? null,
    changes: request.changes ?? {},
    beforeMetrics: request.beforeMetrics ?? null,
    afterMetrics: validated.data,
  });
  logger.info(
    { simulationId: String(doc._id), sessionId: request.sessionId },
    "simulation persisted",
  );
  return { result: validated.data, simulationId: String(doc._id) };
}
