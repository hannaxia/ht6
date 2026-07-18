import type { LocationScores } from "./types.js";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Pure function of the four location scores only.
 * Maps 0..1 scores to a multiplier around 1.0 (roughly 0.80..1.40).
 */
export function locationMultiplier(scores: LocationScores): number {
  const blended =
    0.3 * clamp01(scores.transit) +
    0.15 * clamp01(scores.airport) +
    0.3 * clamp01(scores.tourism) +
    0.25 * clamp01(scores.business);
  return 0.8 + 0.6 * blended;
}
