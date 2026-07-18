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

// Special value requesting the opportunity grid over every place with
// scraped hotel inventory (see api/src/routes/locations.ts), instead of a
// single hardcoded city.
const GRID_SCOPE = "nationwide";

// Covers all of Canada (west,south,east,north). Hotel markers are now read
// from MongoDB (populated by `pnpm --filter @innsight/api scrape:hotels`)
// instead of calling Stay22 live on every page load, so a single wide query
// is cheap — no per-region fan-out, no Stay22 rate-limit concern.
const CANADA_BBOX = "-141.0,41.6,-52.6,83.1";

export default function DiscoverPage() {
  const { open } = useAIConsultant();
  const [hotels, setHotels] = useState<Stay22Hotel[]>([]);
  const [cells, setCells] = useState<OpportunityCell[]>([]);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);

  useEffect(() => {
    // Guards against React 18 Strict Mode's dev-mode double effect
    // invocation overwriting a good result with a stale one.
    let cancelled = false;

    hotelsApi
      .list({ bbox: CANADA_BBOX })
      .then((res) => {
        if (cancelled) return;
        setHotels(res.hotels);
        setHotelError(null);
        log.info("hotels loaded", res.hotels.length);
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        setHotelError(code);
        log.warn("hotel load failed", code);
      });

    locationsApi
      .opportunityGrid({ city: GRID_SCOPE })
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
          <h1 className="text-xl font-bold">Market Discovery — Canada</h1>
          <p className="text-sm text-slate-600">
            Hotel markers are Stay22 inventory across Canada (periodically
            refreshed); the opportunity heatmap covers every place with
            hotel inventory and shows estimated opportunity scores
            (simulation, not real financial data — Toronto uses real local
            input data, other areas use generic baseline assumptions).
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
      <ConsultantPanel context={{ view: "discover", city: "toronto" }} />
    </main>
  );
}
