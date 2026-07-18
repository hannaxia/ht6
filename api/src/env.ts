import { z } from "zod";
import type { Logger } from "pino";

const envSchema = z.object({
  STAY22_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  MONGODB_URI: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).optional(),
  FRONTEND_ORIGIN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

const DEGRADABLE_KEYS = [
  "STAY22_API_KEY",
  "GEMINI_API_KEY",
  "MONGODB_URI",
] as const;

/**
 * Parses process.env. Never throws — missing integration keys produce one
 * structured warn each and the backend continues in degraded mode.
 */
export function loadEnv(logger?: Logger): Env {
  const cleaned = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = envSchema.safeParse(cleaned);
  const env: Env = parsed.success ? parsed.data : {};
  if (!parsed.success && logger) {
    logger.warn(
      { issues: parsed.error.issues },
      "some environment variables failed validation and were ignored",
    );
  }
  if (logger) {
    for (const key of DEGRADABLE_KEYS) {
      if (!env[key]) {
        logger.warn(
          { variable: key },
          `${key} is not set — the dependent integration runs in degraded mode`,
        );
      }
    }
  }
  return env;
}

export function isConfigured(env: Env, key: keyof Env): boolean {
  return env[key] !== undefined && env[key] !== "";
}
