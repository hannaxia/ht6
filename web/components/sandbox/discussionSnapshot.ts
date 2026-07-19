import type { HotelConfigPayload, SimulateHotelOutput } from "../../lib/api/schemas";
import type { DiscussionRequest } from "../../lib/api/discussion";

function label(token: string): string {
  return token
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const LOCATION_LABELS: Record<string, string> = {
  downtown: "Downtown",
  airport: "Airport",
  resort: "Resort area",
  business_district: "Business district",
  suburban: "Suburban",
};

/** Human-readable list of what changed between two configs. */
export function describeChanges(
  before: HotelConfigPayload | null,
  after: HotelConfigPayload,
): string[] {
  if (!before) return [];
  const changes: string[] = [];

  const beforeAmenities = new Set(before.amenities);
  const afterAmenities = new Set(after.amenities);
  for (const a of after.amenities) {
    if (!beforeAmenities.has(a)) changes.push(`Added ${label(a)}`);
  }
  for (const a of before.amenities) {
    if (!afterAmenities.has(a)) changes.push(`Removed ${label(a)}`);
  }

  if (after.modernity > before.modernity) changes.push("Renovated rooms");
  else if (after.modernity < before.modernity)
    changes.push("Reduced modernity");

  if (after.hotelType !== before.hotelType)
    changes.push(`Changed hotel type to ${label(after.hotelType)}`);
  if (after.stars !== before.stars)
    changes.push(`Changed to ${after.stars}-star positioning`);

  if (after.rooms > before.rooms)
    changes.push(`Increased room count to ${after.rooms}`);
  else if (after.rooms < before.rooms)
    changes.push(`Reduced room count to ${after.rooms}`);

  if (after.targetSegment !== before.targetSegment)
    changes.push(`Retargeted to ${label(after.targetSegment)} travelers`);

  if (Math.abs(after.basePrice - before.basePrice) > 0.5)
    changes.push(
      after.basePrice > before.basePrice
        ? "Raised base pricing"
        : "Lowered base pricing",
    );

  return changes;
}

function pctDelta(current: number, previous: number): number | undefined {
  if (!Number.isFinite(previous) || previous === 0) return undefined;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * Assembles the structured snapshot sent to the discussion agents. Deltas are
 * measured against the baseline of the previous discussion, so they describe
 * the net effect of everything the user changed since the agents last spoke.
 */
export function buildDiscussionRequest(
  hotelName: string | null,
  config: HotelConfigPayload,
  metrics: SimulateHotelOutput,
  prevConfig: HotelConfigPayload | null,
  prevMetrics: SimulateHotelOutput | null,
): DiscussionRequest {
  return {
    hotel_name: hotelName ?? undefined,
    location: LOCATION_LABELS[config.location.type] ?? config.location.type,
    hotel_type: label(config.hotelType),
    amenities: config.amenities.map(label),
    recent_changes: describeChanges(prevConfig, config),
    predictions: {
      adr: Number(metrics.adr.toFixed(0)),
      adr_delta_percent: prevMetrics
        ? pctDelta(metrics.adr, prevMetrics.adr)
        : undefined,
      occupancy: Number(metrics.occupancy.toFixed(1)),
      occupancy_delta_percent: prevMetrics
        ? pctDelta(metrics.occupancy, prevMetrics.occupancy)
        : undefined,
      annual_revenue: Number(metrics.revenue.toFixed(0)),
      revenue_delta_percent: prevMetrics
        ? pctDelta(metrics.revenue, prevMetrics.revenue)
        : undefined,
      guest_rating: Number(metrics.rating.toFixed(2)),
      rating_delta: prevMetrics
        ? Number((metrics.rating - prevMetrics.rating).toFixed(2))
        : undefined,
    },
  };
}
