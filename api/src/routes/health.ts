import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { buildHealthResponse } from "../services/healthService.js";

export function healthRouter(deps: AppDependencies): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    res.json(
      await buildHealthResponse(
        deps.mongo,
        deps.stay22,
        deps.ai.readiness,
        deps.mlClient,
      ),
    );
  });
  return router;
}
