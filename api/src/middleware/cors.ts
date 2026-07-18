import cors from "cors";
import type { RequestHandler } from "express";
import type { Env } from "../env.js";

export function corsMiddleware(env: Env): RequestHandler {
  return cors({
    origin: env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
}
