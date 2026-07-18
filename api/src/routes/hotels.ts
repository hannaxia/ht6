import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { hotelsQuerySchema } from "../schemas/hotel.js";
import { searchHotels } from "../services/hotelService.js";

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
    try {
      const hotels = await searchHotels(deps.stay22, parsed.data, req.log);
      res.json({ hotels, source: "Stay22" });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
