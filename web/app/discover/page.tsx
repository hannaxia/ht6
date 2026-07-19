"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DiscoverMap, type PlacedPin } from "../../components/discover/DiscoverMap";
import { DiscoverSidebar } from "../../components/discover/DiscoverSidebar";
import { ErrorBanner } from "../../components/shared/ErrorBanner";
import { useSession } from "../../contexts/SessionContext";
import { ApiError } from "../../lib/api/client";
import { hotelsApi } from "../../lib/api/hotels";
import { locationsApi } from "../../lib/api/locations";
import { savedHotelsApi } from "../../lib/api/savedHotels";
import type {
  HotelConfigPayload,
  OpportunityCell,
  SavedHotel,
  Stay22Hotel,
} from "../../lib/api/schemas";
import { log } from "../../lib/log";
import {
  applyLocationContext,
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
  const { sessionId, isAuthenticated } = useSession();
  const [hotels, setHotels] = useState<Stay22Hotel[]>([]);
  const [cells, setCells] = useState<OpportunityCell[]>([]);
  const [savedHotels, setSavedHotels] = useState<SavedHotel[]>([]);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);

  // Sidebar selection state: at most one of these is active at a time.
  const [selectedHotel, setSelectedHotel] = useState<Stay22Hotel | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedHotel | null>(null);
  const [placedPin, setPlacedPin] = useState<PlacedPin | null>(null);
  const [newHotelName, setNewHotelName] = useState("");
  // True while fetching location context before navigating to the sandbox.
  const [configuring, setConfiguring] = useState(false);
  // The intro card is dismissible via its X button.
  const [showIntro, setShowIntro] = useState(true);

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

  // Load the logged-in user's saved hotels (red markers). If arriving from the
  // profile's "View on map" (?focus=<id>), open that hotel's sidebar once
  // loaded.
  useEffect(() => {
    if (!isAuthenticated || sessionId === "ssr") {
      setSavedHotels([]);
      return;
    }
    let cancelled = false;
    savedHotelsApi
      .list(sessionId)
      .then((res) => {
        if (cancelled) return;
        setSavedHotels(res.savedHotels);
        log.info("saved hotels loaded", res.savedHotels.length);
        const focusId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("focus")
            : null;
        if (focusId) {
          const match = res.savedHotels.find((h) => h.id === focusId);
          if (match) {
            setSelectedHotel(null);
            setPlacedPin(null);
            setSelectedSaved(match);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        log.warn("saved hotels load failed", code);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionId]);

  function handleSelectHotel(hotel: Stay22Hotel) {
    setConfiguring(false);
    setPlacedPin(null);
    setSelectedSaved(null);
    setSelectedHotel(hotel);
  }

  function handleSelectSaved(saved: SavedHotel) {
    setConfiguring(false);
    setPlacedPin(null);
    setSelectedHotel(null);
    setSelectedSaved(saved);
  }

  function handlePlaceHotel(coords: PlacedPin) {
    setConfiguring(false);
    setSelectedHotel(null);
    setSelectedSaved(null);
    setNewHotelName("");
    setPlacedPin(coords);
  }

  function closeSidebar() {
    setConfiguring(false);
    setSelectedHotel(null);
    setSelectedSaved(null);
    setPlacedPin(null);
  }

  // Enrich a config with the coordinate's real market context (nearby
  // inventory pricing, competitors, seeded location scores). Best-effort:
  // if the lookup fails, fall back to the un-enriched config so the user can
  // still proceed to the sandbox.
  async function enrichWithContext(
    base: HotelConfigPayload,
    coords: PlacedPin,
    opts: { excludeHotelId?: string; keepBasePrice?: boolean },
  ): Promise<HotelConfigPayload> {
    try {
      const ctx = await locationsApi.context({
        lat: coords.lat,
        lng: coords.lng,
        excludeHotelId: opts.excludeHotelId,
      });
      return applyLocationContext(base, ctx, {
        keepBasePrice: opts.keepBasePrice,
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.errorCode : "internal_error";
      log.warn("location context lookup failed; using base config", code);
      return base;
    }
  }

  async function configureExistingHotel() {
    if (!selectedHotel || configuring) return;
    setConfiguring(true);
    // Room count isn't something Stay22 provides — run alongside the market
    // context lookup rather than after it, so this doesn't add extra
    // latency on top of an already-async step. Best-effort: a failed/
    // unconfident lookup (network error, or Gemini not configured) just
    // leaves the config's default room count untouched.
    const [config, roomEstimate] = await Promise.all([
      enrichWithContext(hotelToConfig(selectedHotel), selectedHotel.coordinates, {
        excludeHotelId: selectedHotel.id,
        keepBasePrice: !!selectedHotel.price,
      }),
      hotelsApi.estimateRooms(selectedHotel.id).catch((err) => {
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        log.warn("room estimate lookup failed; using default room count", code);
        return null;
      }),
    ]);
    if (roomEstimate?.rooms) {
      config.rooms = roomEstimate.rooms;
    }
    storeSandboxHandoff({
      label: selectedHotel.name,
      origin: "existing",
      config,
      isCustom: false,
    });
    router.push("/sandbox");
  }

  async function configurePlacedHotel() {
    if (!placedPin || configuring) return;
    const name = newHotelName.trim();
    if (!name) return;
    setConfiguring(true);
    const config = await enrichWithContext(
      placedHotelConfig(placedPin),
      placedPin,
      {},
    );
    storeSandboxHandoff({ label: name, origin: "new", config, isCustom: true });
    router.push("/sandbox");
  }

  function configureSavedHotel() {
    if (!selectedSaved) return;
    storeSandboxHandoff({
      label: selectedSaved.name,
      origin: "saved",
      config: selectedSaved.config,
      savedHotelId: selectedSaved.id,
      isCustom: selectedSaved.isCustom,
    });
    router.push("/sandbox");
  }

  return (
    <div className="relative h-full w-full">
      <DiscoverMap
        hotels={hotels}
        cells={cells}
        savedHotels={savedHotels}
        selectedHotelId={selectedHotel?.id ?? null}
        selectedSavedId={selectedSaved?.id ?? null}
        placedPin={placedPin}
        onSelectHotel={handleSelectHotel}
        onSelectSaved={handleSelectSaved}
        onPlaceHotel={handlePlaceHotel}
      />

      {/* Floating header / hints over the map. */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-md">
        {showIntro ? (
          <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-sm font-bold text-slate-900">
                  Market Discovery
                </h1>
                <p className="mt-0.5 text-xs text-slate-600">
                  Each dot represents a hotel. Click a hotel to inspect it, or
                  click anywhere to drop a new hotel. The heatmap shows areas
                  with higher and lower opportunity for a new hotel, based on
                  factors like competition.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIntro(false)}
                aria-label="Dismiss"
                title="Dismiss"
                className="-mr-1 -mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            aria-label="About Market Discovery"
            title="About Market Discovery"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-sm font-bold text-slate-600 shadow-sm backdrop-blur hover:bg-slate-100 hover:text-slate-900"
          >
            i
          </button>
        )}

        {hotelError ? (
          <div className="pointer-events-auto mt-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
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
          <div className="pointer-events-auto mt-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
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

      <DiscoverSidebar
        selectedHotel={selectedHotel}
        selectedSaved={selectedSaved}
        placedPin={placedPin}
        newHotelName={newHotelName}
        busy={configuring}
        onNewHotelNameChange={setNewHotelName}
        onConfigureHotel={configureExistingHotel}
        onConfigureSaved={configureSavedHotel}
        onConfigurePlaced={configurePlacedHotel}
        onClose={closeSidebar}
      />
    </div>
  );
}
