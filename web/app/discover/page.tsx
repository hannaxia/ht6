"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConsultantPanel } from "../../components/consultant/ConsultantPanel";
import { DiscoverMap, type PlacedPin } from "../../components/discover/DiscoverMap";
import { DiscoverSidebar } from "../../components/discover/DiscoverSidebar";
import { ErrorBanner } from "../../components/shared/ErrorBanner";
import { useAIConsultant } from "../../contexts/AIConsultantContext";
import { ApiError } from "../../lib/api/client";
import { hotelsApi } from "../../lib/api/hotels";
import { locationsApi } from "../../lib/api/locations";
import type { OpportunityCell, Stay22Hotel } from "../../lib/api/schemas";
import { log } from "../../lib/log";
import {
  hotelToConfig,
  placedHotelConfig,
  storeSandboxHandoff,
} from "../../lib/sandboxHandoff";

// The opportunity heatmap is scoped to Toronto: it's the only market with
// seeded per-neighbourhood Location data, so it's the only place the score
// actually varies. The "nationwide" grid gives every non-Toronto cell an
// identical generic baseline (~96% of cells collapse to one value), which no
// renderer can make look meaningful — so we show the city that has real
// signal. A denser gridSize (vs the default 20) gives the heatmap a smoother
// continuous field. Extending to more cities = seeding their Location data.
const GRID_SCOPE = "toronto";
const GRID_SIZE = 50;

// Covers all of Canada (west,south,east,north). Hotel markers are now read
// from MongoDB (populated by `pnpm --filter @innsight/api scrape:hotels`)
// instead of calling Stay22 live on every page load, so a single wide query
// is cheap — no per-region fan-out, no Stay22 rate-limit concern.
const CANADA_BBOX = "-141.0,41.6,-52.6,83.1";

export default function DiscoverPage() {
  const router = useRouter();
  const { open } = useAIConsultant();
  const [hotels, setHotels] = useState<Stay22Hotel[]>([]);
  const [cells, setCells] = useState<OpportunityCell[]>([]);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);

  // Sidebar selection state: at most one of these is active at a time.
  const [selectedHotel, setSelectedHotel] = useState<Stay22Hotel | null>(null);
  const [placedPin, setPlacedPin] = useState<PlacedPin | null>(null);
  const [newHotelName, setNewHotelName] = useState("");

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
      .opportunityGrid({ city: GRID_SCOPE, gridSize: GRID_SIZE })
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

  function handleSelectHotel(hotel: Stay22Hotel) {
    setPlacedPin(null);
    setSelectedHotel(hotel);
  }

  function handlePlaceHotel(coords: PlacedPin) {
    setSelectedHotel(null);
    setNewHotelName("");
    setPlacedPin(coords);
  }

  function closeSidebar() {
    setSelectedHotel(null);
    setPlacedPin(null);
  }

  function configureExistingHotel() {
    if (!selectedHotel) return;
    storeSandboxHandoff({
      label: selectedHotel.name,
      origin: "existing",
      config: hotelToConfig(selectedHotel),
    });
    router.push("/sandbox");
  }

  function configurePlacedHotel() {
    if (!placedPin) return;
    const name = newHotelName.trim();
    if (!name) return;
    storeSandboxHandoff({
      label: name,
      origin: "new",
      config: placedHotelConfig(placedPin),
    });
    router.push("/sandbox");
  }

  return (
    <div className="relative h-full w-full">
      <DiscoverMap
        hotels={hotels}
        cells={cells}
        selectedHotelId={selectedHotel?.id ?? null}
        placedPin={placedPin}
        onSelectHotel={handleSelectHotel}
        onPlaceHotel={handlePlaceHotel}
      />

      {/* Floating header / hints over the map. */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-md">
        <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-sm font-bold text-slate-900">
                Market Discovery — Canada
              </h1>
              <p className="mt-0.5 text-xs text-slate-600">
                Click a hotel marker to inspect it, or click anywhere to drop a
                new hotel. Opportunity scores are simulation estimates.
              </p>
            </div>
            <button
              type="button"
              onClick={open}
              className="shrink-0 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
            >
              AI Consultant
            </button>
          </div>

          {hotelError ? (
            <div className="mt-2">
              <ErrorBanner
                errorCode={hotelError}
                message={
                  hotelError === "network_error"
                    ? "Could not reach the Innsight API — is it running on port 4000?"
                    : "Hotels could not be loaded. If Stay22 is not configured, the map shows no hotels."
                }
              />
            </div>
          ) : null}
          {gridError ? (
            <div className="mt-2">
              <ErrorBanner
                errorCode={gridError}
                message={
                  gridError === "database_unavailable"
                    ? "MongoDB is not configured — the opportunity heatmap needs it (README → Setup checklist → MongoDB Atlas)."
                    : "Opportunity grid could not be loaded."
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      <DiscoverSidebar
        selectedHotel={selectedHotel}
        placedPin={placedPin}
        newHotelName={newHotelName}
        onNewHotelNameChange={setNewHotelName}
        onConfigureHotel={configureExistingHotel}
        onConfigurePlaced={configurePlacedHotel}
        onClose={closeSidebar}
      />

      <ConsultantPanel context={{ view: "discover", city: "toronto" }} />
    </div>
  );
}
