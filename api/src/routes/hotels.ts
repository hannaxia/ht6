import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { hotelsQuerySchema } from "../schemas/hotel.js";
import { searchHotelsFromDb } from "../services/hotelService.js";

export function hotelsRouter(deps: AppDependencies): Router {
  const router = Router();
  router.get("/", async (req, res, next) => {
    const parsed = hotelsQuerySchema.safeParse(req.query);
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
      // Served from the Hotels collection (populated by
      // `pnpm --filter @innsight/api scrape:hotels`), not a live Stay22
      // call — keeps page loads fast and off Stay22's rate limit.
      const hotels = await searchHotelsFromDb(deps.mongo, parsed.data, req.log);
      res.json({ hotels, source: "Stay22" });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
