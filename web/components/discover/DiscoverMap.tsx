"use client";

import { GridCellLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import type { OpportunityCell, Stay22Hotel } from "../../lib/api/schemas";
import { log } from "../../lib/log";
import { HeatmapTooltip } from "./HeatmapTooltip";
import { HotelMarkerTooltip } from "./HotelMarkerTooltip";
import { MapNotConfigured } from "./MapNotConfigured";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
// Centered so all of Ontario is visible at initial load, zoomed out enough
// to see hotel markers province-wide; the opportunity heatmap itself stays
// Toronto-scoped and will appear as a small cluster of cells near Toronto.
const ONTARIO_CENTER: [number, number] = [-84.5, 49.5];
const ONTARIO_ZOOM = 4.4;
// Matches api/src/cities.ts's toronto.bbox — the opportunity heatmap's extent.
// Frontend duplicates this locally since web/ and api/ are separate deployables.
const TORONTO_BBOX = { north: 43.78, south: 43.58, east: -79.12, west: -79.64 };

export interface PlacedPin {
  lat: number;
  lng: number;
}

interface Hover {
  x: number;
  y: number;
  hotel?: Stay22Hotel;
  cell?: OpportunityCell;
}

/** Green (high) → red (low) for opportunity scores. */
function scoreColor(score: number): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, score / 100));
  return [Math.round(220 * (1 - t)), Math.round(180 * t), 60, 120];
}

export function DiscoverMap({
  hotels,
  cells,
  selectedHotelId,
  placedPin,
  onSelectHotel,
  onPlaceHotel,
}: {
  hotels: Stay22Hotel[];
  cells: OpportunityCell[];
  selectedHotelId?: string | null;
  placedPin?: PlacedPin | null;
  onSelectHotel?: (hotel: Stay22Hotel) => void;
  onPlaceHotel?: (coords: PlacedPin) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // Keep the latest callbacks/props in refs so the overlay click handler
  // (registered in a separate effect) always sees current values without
  // re-registering on every render.
  const onSelectHotelRef = useRef(onSelectHotel);
  const onPlaceHotelRef = useRef(onPlaceHotel);
  onSelectHotelRef.current = onSelectHotel;
  onPlaceHotelRef.current = onPlaceHotel;

  // Never touch the Mapbox SDK without a token.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: ONTARIO_CENTER,
      zoom: ONTARIO_ZOOM,
    });
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay);
    mapRef.current = map;
    overlayRef.current = overlay;
    log.info("mapbox map initialized");
    // Smoothly draw the eye from the wide Ontario view into the Toronto
    // heatmap on first entry. No `essential: true` so prefers-reduced-motion
    // users get an instant snap instead of a forced animation.
    map.once("load", () => {
      map.fitBounds(
        [
          [TORONTO_BBOX.west, TORONTO_BBOX.south],
          [TORONTO_BBOX.east, TORONTO_BBOX.north],
        ],
        { padding: 60, duration: 3000 },
      );
    });
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    const placedLayerData = placedPin ? [placedPin] : [];
    overlayRef.current.setProps({
      getCursor: ({ isDragging, isHovering }) =>
        isDragging ? "grabbing" : isHovering ? "pointer" : "crosshair",
      onClick: (info) => {
        // Clicking an existing hotel marker selects it.
        if (info.layer?.id === "hotels" && info.object) {
          onSelectHotelRef.current?.(info.object as Stay22Hotel);
          return;
        }
        // Clicking anywhere else on the map drops a new-hotel pin there.
        const lng = info.coordinate?.[0];
        const lat = info.coordinate?.[1];
        if (lng !== undefined && lat !== undefined) {
          onPlaceHotelRef.current?.({ lat, lng });
        }
      },
      layers: [
        new GridCellLayer<OpportunityCell>({
          id: "opportunity-grid",
          data: cells,
          cellSize: 900,
          extruded: false,
          pickable: true,
          getPosition: (d) => [d.coordinates.lng, d.coordinates.lat],
          getFillColor: (d) => scoreColor(d.opportunityScore),
          onHover: (info) =>
            setHover(
              info.object
                ? { x: info.x, y: info.y, cell: info.object }
                : null,
            ),
        }),
        new ScatterplotLayer<Stay22Hotel>({
          id: "hotels",
          data: hotels,
          pickable: true,
          radiusMinPixels: 4,
          radiusMaxPixels: 12,
          getPosition: (d) => [d.coordinates.lng, d.coordinates.lat],
          getRadius: (d) => (d.id === selectedHotelId ? 12 : 6),
          getFillColor: (d) =>
            d.id === selectedHotelId
              ? [217, 119, 6, 255]
              : [30, 64, 175, 200],
          updateTriggers: {
            getFillColor: selectedHotelId,
            getRadius: selectedHotelId,
          },
          onHover: (info) =>
            setHover(
              info.object
                ? { x: info.x, y: info.y, hotel: info.object }
                : null,
            ),
        }),
        new ScatterplotLayer<PlacedPin>({
          id: "placed-pin",
          data: placedLayerData,
          pickable: false,
          radiusMinPixels: 8,
          radiusMaxPixels: 16,
          stroked: true,
          lineWidthMinPixels: 2,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: 12,
          getFillColor: [16, 185, 129, 230],
          getLineColor: [255, 255, 255, 255],
        }),
      ],
    });
    log.debug("deck.gl layers updated", {
      hotels: hotels.length,
      cells: cells.length,
      placed: placedLayerData.length,
    });
  }, [hotels, cells, selectedHotelId, placedPin]);

  if (!MAPBOX_TOKEN) return <MapNotConfigured />;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {hover ? (
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: hover.x + 8, top: hover.y + 8 }}
        >
          {hover.hotel ? <HotelMarkerTooltip hotel={hover.hotel} /> : null}
          {hover.cell ? <HeatmapTooltip cell={hover.cell} /> : null}
        </div>
      ) : null}
    </div>
  );
}
