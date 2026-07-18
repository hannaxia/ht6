/**
 * Static USD->CAD rate used to convert the ML models' predictions (trained
 * on USD-denominated Airbnb data) into CAD for display — a fixed
 * approximation, not a live FX rate. Applies ONLY to values sourced from
 * the ML service (api/src/ml/mlClient.ts / api/src/simulation/index.ts).
 * The deterministic formula's own config values (cost.ts, cities.ts) are
 * treated as CAD-native already — they were always arbitrary hackathon
 * placeholders, never tied to a real currency, so there's nothing to
 * convert there.
 */
// placeholder — tune later, or replace with a live FX API call
export const usdToCadRate = 1.37;
