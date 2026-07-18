import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { AiNotConfiguredError } from "../ai/consultant.js";
import { aiConsultRequestSchema } from "../schemas/ai.js";

export function aiRouter(deps: AppDependencies): Router {
  const router = Router();
  router.post("/consult", async (req, res, next) => {
    const parsed = aiConsultRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Request body failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.ai.readiness !== "ready") {
      res.status(503).json({
        errorCode: "ai_not_configured",
        message: "Gemini is not configured. See the README setup checklist.",
      });
      return;
    }
    try {
      const response = await deps.ai.consult(parsed.data, req.log);
      res.json(response);
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        res.status(503).json({
          errorCode: "ai_not_configured",
          message: "Gemini is not configured. See the README setup checklist.",
        });
        return;
      }
      next(err);
    }
  });
  return router;
}
