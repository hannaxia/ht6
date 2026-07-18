const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const STAR_BASE: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.65,
  2: 0.8,
  3: 1.0,
  4: 1.25,
  5: 1.55,
};

/**
 * Deterministic function of user-set stars + modernity ONLY.
 * MUST NOT depend on predicted rating (rating is computed after ADR).
 */
export function qualityMultiplier(
  stars: 1 | 2 | 3 | 4 | 5,
  modernity: number,
): number {
  const modernityBoost = 0.85 + 0.3 * clamp01(modernity); // 0.85..1.15
  return STAR_BASE[stars] * modernityBoost;
}
