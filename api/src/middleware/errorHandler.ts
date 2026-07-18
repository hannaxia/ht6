import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Logger } from "pino";

/** Route-level error with a stable errorCode and HTTP status. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    message?: string,
  ) {
    super(message ?? errorCode);
    this.name = "HttpError";
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    errorCode: "not_found",
    message: "The requested resource does not exist.",
  });
};

export function errorHandlerMiddleware(logger: Logger): ErrorRequestHandler {
  return (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (err instanceof HttpError) {
      req.log?.warn(
        { errorCode: err.errorCode, status: err.status },
        err.message,
      );
      res
        .status(err.status)
        .json({ errorCode: err.errorCode, message: err.message });
      return;
    }
    const stack = err instanceof Error ? err.stack : undefined;
    (req.log ?? logger).error(
      { err, stack, requestId: req.id },
      "unhandled error in route handler",
    );
    res.status(500).json({
      errorCode: "internal_error",
      message: "Unexpected server error",
    });
  };
}
