/**
 * Gated debug logger — the only place feature code may reach console.
 * debug/info are emitted only when NEXT_PUBLIC_DEBUG === "true";
 * warn/error always pass through.
 */
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === "true";

export const log = {
  debug: (...args: unknown[]): void => {
    if (DEBUG) console.debug("[innsight]", ...args);
  },
  info: (...args: unknown[]): void => {
    if (DEBUG) console.info("[innsight]", ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn("[innsight]", ...args);
  },
  error: (...args: unknown[]): void => {
    console.error("[innsight]", ...args);
  },
};
