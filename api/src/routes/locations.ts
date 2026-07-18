import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { opportunityGridQuerySchema } from "../schemas/grid.js";
import { DISCLAIMER } from "../simulation/index.js";
import {
  computeCityOpportunityGrid,
  UnknownCityError,
} from "../services/locationService.js";

export function locationsRouter(deps: AppDependencies): Router {
  const router = Router();
  router.get("/opportunity-grid", async (req, res, next) => {
    const parsed = opportunityGridQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Query parameters failed validation.",
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
      const cells = await computeCityOpportunityGrid(
        parsed.data.city,
        parsed.data.gridSize,
        deps.simulation,
        deps.mongo,
        deps.stay22,
        req.log,
      );
      res.json({ cells, disclaimer: DISCLAIMER });
    } catch (err) {
      if (err instanceof UnknownCityError) {
        res.status(400).json({
          errorCode: "invalid_request",
          message: err.message,
        });
        return;
      }
      next(err);
    }
  });
  return router;
}
