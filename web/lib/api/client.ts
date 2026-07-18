import type { z } from "zod";
import { log } from "../log";
import { errorEnvelopeSchema } from "./schemas";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export interface ApiErrorShape {
  errorCode: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly errorCode: string;
  public readonly details?: unknown;
  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = "ApiError";
    this.errorCode = shape.errorCode;
    this.details = shape.details;
  }
}

/**
 * Issues a JSON request against the backend and validates the response with
 * the route's zod schema. All backend traffic flows through here — validation
 * failures never reach feature components as unvalidated data.
 */
export async function fetchJson<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  log.debug("fetch", init.method ?? "GET", url);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch (err) {
    log.warn("network error", url, err);
    throw new ApiError({
      errorCode: "network_error",
      message: "Could not reach the Innsight API. Is it running?",
    });
  }
  if (!res.ok) {
    const body = errorEnvelopeSchema.safeParse(
      await res.json().catch(() => ({})),
    );
    throw new ApiError(
      body.success
        ? body.data
        : { errorCode: "internal_error", message: `HTTP ${res.status}` },
    );
  }
  const raw: unknown = await res.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    log.warn("response validation failed", url, parsed.error.issues);
    throw new ApiError({
      errorCode: "response_validation_failed",
      message: "Backend response did not match the expected shape.",
      details: parsed.error.issues,
    });
  }
  log.debug("fetch ok", url);
  return parsed.data;
}
