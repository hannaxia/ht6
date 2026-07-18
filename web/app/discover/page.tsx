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
import { log } from "../../lib/log";

const CITY = "toronto";

// Same Toronto bounding box as api/src/services/locationService.ts
// (west,south,east,north). Searching by bbox instead of city name spreads
// Stay22 results across the whole city instead of clustering around one
// geocoded point.
const CITY_BBOX = "-79.64,43.58,-79.12,43.85";

export default function DiscoverPage() {
  const { open } = useAIConsultant();
  const [hotels, setHotels] = useState<Stay22Hotel[]>([]);
  const [cells, setCells] = useState<OpportunityCell[]>([]);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);

  useEffect(() => {
    hotelsApi
      .list({ bbox: CITY_BBOX })
      .then((res) => {
        setHotels(res.hotels);
        log.info("hotels loaded", res.hotels.length);
      })
      .catch((err) => {
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        setHotelError(code);
        log.warn("hotel load failed", code);
      });
    locationsApi
      .opportunityGrid({ city: CITY })
      .then((res) => {
        setCells(res.cells);
        log.info("opportunity grid loaded", res.cells.length);
      })
      .catch((err) => {
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        setGridError(code);
        log.warn("grid load failed", code);
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Market Discovery — Toronto</h1>
          <p className="text-sm text-slate-600">
            Hotel markers are Stay22 inventory; the heatmap shows estimated
            opportunity scores (simulation, not real financial data).
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
          No hotels loaded — Stay22 may not be configured yet (README → Setup
          checklist → Stay22).
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
