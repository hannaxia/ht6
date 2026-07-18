import { SimulationError } from "./errors.js";

/**
 * Revenue = rooms × ADR × (occupancy/100) × 365 — standard RevPAR annualization.
 * Room revenue only (no F&B/spa/events). rooms = 0 → 0 without error.
 */
export function revenueFormula(
  rooms: number,
  adr: number,
  occupancyPct: number,
): number {
  if (!Number.isInteger(rooms) || rooms < 0) {
    throw new SimulationError("rooms_invalid", { rooms });
  }
  return rooms * adr * (occupancyPct / 100) * 365;
}
