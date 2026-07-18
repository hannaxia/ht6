import type { HotelConfigInput } from "../schemas/simulation.js";
import type { SimulateHotelOutput } from "../simulation/index.js";
import type { PersonaId } from "./personas.js";

const ADR_THRESHOLD = 5; // USD
const RATING_THRESHOLD = 0.05;
const OCCUPANCY_THRESHOLD = 1; // percentage points
const ROOMS_THRESHOLD = 10;

function amenitiesChanged(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  const setA = new Set(a);
  return b.some((amenity) => !setA.has(amenity));
}

/**
 * Deterministic relevance filter: only personas plausibly affected by what
 * actually changed get asked to react. `before` is null on a hotel's first
 * simulation — in that case everyone reacts to the initial configuration.
 */
export function determineRelevantPersonas(
  before: HotelConfigInput | null,
  after: HotelConfigInput,
  beforeMetrics: SimulateHotelOutput | null,
  afterMetrics: SimulateHotelOutput,
): PersonaId[] {
  if (!before || !beforeMetrics) {
    return ["guest", "staff", "resident", "competitor"];
  }

  const relevant = new Set<PersonaId>();
  const amenitiesMoved = amenitiesChanged(before.amenities, after.amenities);
  const adrMoved = Math.abs(afterMetrics.adr - beforeMetrics.adr) > ADR_THRESHOLD;
  const ratingMoved =
    Math.abs(afterMetrics.rating - beforeMetrics.rating) > RATING_THRESHOLD;
  const occupancyMoved =
    Math.abs(afterMetrics.occupancy - beforeMetrics.occupancy) >
    OCCUPANCY_THRESHOLD;
  const renovationIncreased = after.renovationDelta > before.renovationDelta;
  const roomsMoved =
    Math.abs(after.rooms - before.rooms) >= ROOMS_THRESHOLD;
  const positioningChanged =
    before.hotelType !== after.hotelType || before.stars !== after.stars;

  if (amenitiesMoved || adrMoved || ratingMoved) relevant.add("guest");
  if (amenitiesMoved || renovationIncreased || roomsMoved) relevant.add("staff");
  if (renovationIncreased || roomsMoved || positioningChanged) {
    relevant.add("resident");
  }
  if (adrMoved || occupancyMoved || positioningChanged || amenitiesMoved) {
    relevant.add("competitor");
  }

  // A no-op click shouldn't feel broken — fall back to the guest.
  if (relevant.size === 0) relevant.add("guest");
  const order: PersonaId[] = ["guest", "staff", "resident", "competitor"];
  return order.filter((id) => relevant.has(id));
}

function fmtAmenities(amenities: string[]): string {
  return amenities.length > 0 ? amenities.join(", ") : "none";
}

function fmtHotel(config: HotelConfigInput, metrics: SimulateHotelOutput): string {
  return (
    `${config.rooms}-room ${config.stars}-star ${config.hotelType} hotel, ` +
    `amenities: ${fmtAmenities(config.amenities)}. Estimated ADR $${metrics.adr.toFixed(0)}/night, ` +
    `estimated occupancy ${metrics.occupancy.toFixed(0)}%, estimated guest rating ${metrics.rating.toFixed(1)}/5.`
  );
}

/** Plain-language before/after summary fed to every persona as context. */
export function buildContextPrompt(
  before: HotelConfigInput | null,
  after: HotelConfigInput,
  beforeMetrics: SimulateHotelOutput | null,
  afterMetrics: SimulateHotelOutput,
): string {
  if (!before || !beforeMetrics) {
    return `A new hotel was just configured in the simulator: ${fmtHotel(after, afterMetrics)} React to this hotel as proposed.`;
  }
  return (
    `A hotel's configuration just changed in the simulator.\n` +
    `Before: ${fmtHotel(before, beforeMetrics)}\n` +
    `After: ${fmtHotel(after, afterMetrics)}\n` +
    `React to this specific change.`
  );
}
