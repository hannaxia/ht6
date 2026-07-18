/**
 * In-flight-limited debouncer: at most one in-flight request per
 * minIntervalMs window. Skipped runs resolve to null — the caller retains
 * its previous state.
 */
export function createInFlightDebouncer<T>(minIntervalMs: number) {
  let last = 0;
  let inflight: Promise<T> | null = null;
  return async function run(op: () => Promise<T>): Promise<T | null> {
    const now = Date.now();
    if (inflight || now - last < minIntervalMs) return null;
    inflight = op();
    last = now;
    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  };
}
