import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Logger } from "pino";

/**
 * Emits exactly one structured completion entry per request — method, path,
 * status, duration — whether or not the handler threw.
 */
export function requestLoggerMiddleware(logger: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - start) / 1_000_000;
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          requestId: req.id,
        },
        "request completed",
      );
    });
    next();
  };
}
