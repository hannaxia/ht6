"use client";

import { useEffect, useState } from "react";
import { ConsultantPanel } from "../../components/consultant/ConsultantPanel";
import { DiscoverMap } from "../../components/discover/DiscoverMap";
import { ErrorBanner } from "../../components/shared/ErrorBanner";
import { useAIConsultant } from "../../contexts/AIConsultantContext";
import { ApiError } from "../../lib/api/client";
import { hotelsApi } from "../../lib/api/hotels";
import { locationsApi } from "../../lib/api/locations";
import type { OpportunityCell, Stay22Hotel } from "../../lib/api/schemas";
import { isInOntario } from "../../lib/geo/ontarioBoundary";
import { log } from "../../lib/log";

const CITY = "toronto";

/**
 * A single Ontario-spanning bbox (west,south,east,north) doesn't work: for
 * boxes this large (~2000km diagonal), Stay22 returns whichever properties
 * rank highest overall rather than spreading results across the box —
 * confirmed live, a full-Ontario bbox returned only Minnesota lake cabins,
 * none of which are even inside Ontario. Instead, query several
 * city-sized regions across the province (the size that reliably returns
 * local results) and merge. [west,south,east,north] each.
 */
const ONTARIO_REGIONS: Record<string, string> = {
  toronto: "-79.64,43.58,-79.12,43.85",
  ottawa: "-76.0,45.2,-75.4,45.6",
  hamiltonNiagara: "-80.1,42.9,-79.0,43.4",
  londonWindsor: "-83.2,42.0,-80.9,43.1",
  kingston: "-76.7,44.0,-76.2,44.4",
  barrie: "-80.0,44.2,-79.4,44.6",
  sudburyNorthBay: "-81.3,46.2,-79.2,46.7",
  thunderBay: "-89.6,48.2,-89.0,48.6",
  kenora: "-94.8,49.6,-94.3,49.9",
};

export default function DiscoverPage() {
  const { open } = useAIConsultant();
  const [hotels, setHotels] = useState<Stay22Hotel[]>([]);
  const [cells, setCells] = useState<OpportunityCell[]>([]);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);

  useEffect(() => {
    // React 18 Strict Mode (Next.js dev) double-invokes effects on mount,
    // firing this whole fetch fan-out twice. Without a cancellation guard,
    // whichever invocation resolves last wins the state update — if the
    // second run hits any hiccup (partial region failure, slower network),
    // it can silently overwrite a good first result with a worse one. This
    // matched the exact symptom: markers/heatmap flash correctly, then
    // clear. `cancelled` ensures a stale run's results are dropped instead
    // of applied.
    let cancelled = false;

    Promise.allSettled(
      Object.entries(ONTARIO_REGIONS).map(([name, bbox]) =>
        hotelsApi.list({ bbox }).then((res) => ({ name, hotels: res.hotels })),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const byId = new Map<string, Stay22Hotel>();
        let anySucceeded = false;
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          anySucceeded = true;
          for (const hotel of result.value.hotels) {
            // Ontario regions are hand-picked rectangles, not the exact
            // province boundary — filter out anything that lands outside
            // the real Ontario polygon (e.g. Windsor's box also touches
            // Michigan).
            if (isInOntario(hotel.coordinates.lng, hotel.coordinates.lat)) {
              byId.set(hotel.id, hotel);
            }
          }
        }
        if (!anySucceeded) {
          throw new Error("all region requests failed");
        }
        const merged = [...byId.values()];
        setHotels(merged);
        setHotelError(null);
        log.info("hotels loaded", merged.length);
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        setHotelError(code);
        log.warn("hotel load failed", code);
      });

    locationsApi
      .opportunityGrid({ city: CITY })
      .then((res) => {
        if (cancelled) return;
        setCells(res.cells);
        setGridError(null);
        log.info("opportunity grid loaded", res.cells.length);
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        setGridError(code);
        log.warn("grid load failed", code);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Market Discovery — Ontario</h1>
          <p className="text-sm text-slate-600">
            Hotel markers are Stay22 inventory across Ontario; the
            opportunity heatmap (Toronto only) shows estimated opportunity
            scores (simulation, not real financial data).
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          AI Consultant
        </button>
      </div>

      {hotelError ? (
        <ErrorBanner
          errorCode={hotelError}
          message={
            hotelError === "network_error"
              ? "Could not reach the Innsight API — is it running on port 4000?"
              : "Hotels could not be loaded. If Stay22 is not configured, the map shows no hotels."
          }
        />
      ) : null}
      {hotels.length === 0 && !hotelError ? (
        <p className="text-sm text-slate-500">
          No hotels loaded yet. If this persists, Stay22 may not be
          configured (README → Setup checklist → Stay22), or live
          availability for the current date window may be sparse.
        </p>
      ) : null}
      {gridError ? (
        <ErrorBanner
          errorCode={gridError}
          message={
            gridError === "database_unavailable"
              ? "MongoDB is not configured — the opportunity heatmap needs it (README → Setup checklist → MongoDB Atlas)."
              : "Opportunity grid could not be loaded."
          }
        />
      ) : null}

      <div className="h-[560px]">
        <DiscoverMap hotels={hotels} cells={cells} />
      </div>
      <ConsultantPanel context={{ view: "discover", city: CITY }} />
    </main>
  );
}
