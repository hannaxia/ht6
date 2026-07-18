import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { simulationRequestSchema } from "../schemas/simulation.js";
import { DISCLAIMER, SimulationError } from "../simulation/index.js";
import {
  runAndPersistSimulation,
  SimulationOutputInvalidError,
} from "../services/simulationService.js";

export function simulationsRouter(deps: AppDependencies): Router {
  const router = Router();
  router.post("/", async (req, res, next) => {
    const parsed = simulationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Request body failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.mongo.readiness !== "ready") {
      res.status(503).json({
        errorCode: "database_unavailable",
        message: "MongoDB is not available.",
      });
      return;
    }
    try {
      const { result, simulationId } = await runAndPersistSimulation(
        parsed.data,
        deps.simulation,
        deps.mongo,
        req.log,
      );
      res.json({ result, simulationId, disclaimer: DISCLAIMER });
    } catch (err) {
      if (err instanceof SimulationError) {
        req.log.error(
          { code: err.code, input: err.input, config: parsed.data.config },
          "simulation formula error",
        );
        res.status(500).json({
          errorCode: "simulation_output_invalid",
          message: "Simulation produced an out-of-bounds result.",
        });
        return;
      }
      if (err instanceof SimulationOutputInvalidError) {
        res.status(500).json({
          errorCode: "simulation_output_invalid",
          message: "Simulation produced an out-of-bounds result.",
        });
        return;
      }
      next(err);
    }
  });
  return router;
}
