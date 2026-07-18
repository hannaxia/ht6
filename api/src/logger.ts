import { pino, type Logger } from "pino";

export function createLogger(level?: string): Logger {
  return pino({
    level: level ?? process.env.LOG_LEVEL ?? "info",
    base: { service: "innsight-backend" },
    redact: ["req.headers.authorization", 'res.headers["set-cookie"]'],
    formatters: { level: (label) => ({ level: label }) },
  });
}

export const logger = createLogger();

export function createChildLogger(
  bindings: Record<string, unknown>,
): Logger {
  return logger.child(bindings);
}
