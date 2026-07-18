import type { NextFunction, Request, RequestHandler, Response } from "express";
import { nanoid } from "nanoid";
import type { Logger } from "pino";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
    }
  }
}

export function requestIdMiddleware(logger: Logger): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.id = nanoid();
    req.log = logger.child({
      requestId: req.id,
      route: req.path,
      method: req.method,
    });
    next();
  };
}
