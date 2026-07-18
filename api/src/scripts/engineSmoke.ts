/**
 * Simulation-engine smoke checks: runs the engine against a baseline Toronto
 * hotel and asserts the core domain invariants from CLAUDE.md. Run with:
 *   pnpm --filter @innsight/api smoke
 * Exits non-zero on any failure.
 */
import { loadConfig } from "@innsight/config";
import { pino } from "pino";
import { simulateHotelOutputSchema } from "../schemas/simulation.js";
import { createSimulationEngine } from "../simulation/index.js";

const logger = pino({ level: "warn" });
const config = loadConfig(logger);
const engine = createSimulationEngine(config, logger);

let failures = 0;
function check(name: string, pass: boolean, detail?: string) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
}

const base = {
  hotelType: "midscale" as const,
  rooms: 150,
  stars: 4 as const,
  modernity: 0.7,
  renovationDelta: 0,
  amenities: ["wifi", "breakfast"],
  targetSegment: "mixed" as const,
  basePrice: 180,
  segmentAdrNorm: 200,
  location: {
    type: "downtown" as const,
    scores: { transit: 0.8, airport: 0.4, tourism: 0.7, business: 0.7 },
    coordinates: { lat: 43.6532, lng: -79.3832 },
    baseDemand: 68,
    locationDemand: 6,
    locationSatisfaction: 0.15,
  },
  competitors: [],
  baseRating: 3.5,
};

const out = engine.simulateHotel(base);
console.log("baseline metrics (all simulation estimates):", {
  adr: `$${out.adr.toFixed(2)}`,
  occupancy: `${out.occupancy.toFixed(1)}%`,
  revenue: `$${Math.round(out.revenue).toLocaleString()}`,
  rating: out.rating.toFixed(2),
  investment: `$${Math.round(out.investment).toLocaleString()}`,
  roi: `${(out.roi * 100).toFixed(1)}%`,
  payback: `${out.paybackYears.toFixed(1)}y`,
});

check(
  "output passes bounds schema",
  simulateHotelOutputSchema.safeParse(out).success,
);

const withCoworking = engine.simulateHotel({
  ...base,
  amenities: [...base.amenities, "coworking"],
});
check(
  "coworking in downtown raises ADR",
  withCoworking.adr > out.adr,
  `$${out.adr.toFixed(2)} → $${withCoworking.adr.toFixed(2)}`,
);

check(
  "ADR is invariant to baseRating (no circular dependency)",
  engine.simulateHotel({ ...base, baseRating: 1.0 }).adr === out.adr,
);

const zeroRooms = engine.simulateHotel({ ...base, rooms: 0, amenities: [] });
check(
  "zero rooms → zero revenue + infinite payback, no throw",
  zeroRooms.revenue === 0 &&
    zeroRooms.paybackYears === Number.POSITIVE_INFINITY,
);

const maxed = engine.simulateHotel({
  ...base,
  amenities: Object.keys(config.amenityImpactTable),
});
check(
  "aggregated amenity impact is capped at ±25pp",
  Math.abs(maxed.intermediates.amenityImpactPct) <= config.amenityImpactCap,
  `${maxed.intermediates.amenityImpactPct}pp with every amenity enabled`,
);

const sameSegment = engine.simulateHotel({
  ...base,
  competitors: [
    {
      stars: 4,
      hotelType: "midscale" as const,
      pricePerNight: 200,
      coordinates: { lat: 43.654, lng: -79.384 },
    },
  ],
});
check(
  "same-segment competitor lowers occupancy",
  sameSegment.occupancy < out.occupancy,
  `${out.occupancy.toFixed(1)}% → ${sameSegment.occupancy.toFixed(1)}%`,
);

const budgetCompetitor = engine.simulateHotel({
  ...base,
  competitors: [
    {
      stars: 1,
      hotelType: "budget" as const,
      pricePerNight: 60,
      coordinates: { lat: 43.654, lng: -79.384 },
    },
  ],
});
check(
  "budget motel pressures a 4-star less than a same-segment rival",
  budgetCompetitor.intermediates.competitionPressure <
    sameSegment.intermediates.competitionPressure,
  `${budgetCompetitor.intermediates.competitionPressure.toFixed(2)}pp vs ${sameSegment.intermediates.competitionPressure.toFixed(2)}pp`,
);

const overpriced = engine.simulateHotel({ ...base, basePrice: 500 });
check(
  "overpricing vs segment norm lowers rating",
  overpriced.rating < out.rating,
  `${out.rating.toFixed(2)} → ${overpriced.rating.toFixed(2)}`,
);

const renovated = engine.simulateHotel({
  ...base,
  modernity: 1,
  renovationDelta: 1,
});
check(
  "full renovation raises ADR and investment",
  renovated.adr > out.adr && renovated.investment > out.investment,
);

process.exit(failures === 0 ? 0 : 1);
