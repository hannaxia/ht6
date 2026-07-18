export type SimulationErrorCode =
  | "adr_non_positive"
  | "occupancy_non_finite"
  | "rooms_invalid"
  | "investment_invalid"
  | "investment_non_positive";

export class SimulationError extends Error {
  constructor(
    public readonly code: SimulationErrorCode,
    public readonly input: Record<string, unknown>,
  ) {
    super(`simulation error: ${code}`);
    this.name = "SimulationError";
  }
}
