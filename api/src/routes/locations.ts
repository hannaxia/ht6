import { Router } from "express";
import type { AppDependencies } from "../app.js";
import {
  locationContextQuerySchema,
  opportunityGridQuerySchema,
} from "../schemas/grid.js";
import { DISCLAIMER } from "../simulation/index.js";
import {
  computeCityOpportunityGrid,
  computeNationwideOpportunityGrid,
  resolveLocationContext,
  UnknownCityError,
} from "../services/locationService.js";

// Special `city` value requesting the grid over every place with scraped
// hotel inventory, instead of a single hardcoded city.
const NATIONWIDE_CITY_VALUE = "nationwide";

export function locationsRouter(deps: AppDependencies): Router {
  const router = Router();

  // Resolve one coordinate's market/location context, used to seed a sandbox
  // hotel (placed pin or selected existing hotel) from real surroundings.
  router.get("/context", async (req, res, next) => {
    const parsed = locationContextQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Query parameters failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    try {
      // Degrades gracefully to baseline figures without DB/Stay22, so this is
      // intentionally not gated on mongo readiness.
      const ctx = await resolveLocationContext(
        { lat: parsed.data.lat, lng: parsed.data.lng },
        deps.mongo,
        deps.stay22,
        req.log,
        { excludeHotelId: parsed.data.excludeHotelId },
      );
      res.json({ ...ctx, disclaimer: DISCLAIMER });
    } catch (err) {
      next(err);
    }
  });

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
      if (parsed.data.city.toLowerCase() === NATIONWIDE_CITY_VALUE) {
        const forceRecompute = req.query.refresh === "true";
        const { cells, cached } = await computeNationwideOpportunityGrid(
          deps.simulation,
          deps.mongo,
          req.log,
          forceRecompute,
        );
        res.json({ cells, disclaimer: DISCLAIMER, cached });
        return;
      }
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
