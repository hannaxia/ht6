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
const TORONTO_CENTER: [number, number] = [-79.3832, 43.6532];

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
}: {
  hotels: Stay22Hotel[];
  cells: OpportunityCell[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // Never touch the Mapbox SDK without a token.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: TORONTO_CENTER,
      zoom: 11,
    });
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay);
    mapRef.current = map;
    overlayRef.current = overlay;
    log.info("mapbox map initialized");
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({
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
          radiusMaxPixels: 10,
          getPosition: (d) => [d.coordinates.lng, d.coordinates.lat],
          getFillColor: [30, 64, 175, 200],
          onHover: (info) =>
            setHover(
              info.object
                ? { x: info.x, y: info.y, hotel: info.object }
                : null,
            ),
        }),
      ],
    });
    log.debug("deck.gl layers updated", {
      hotels: hotels.length,
      cells: cells.length,
    });
  }, [hotels, cells]);

  if (!MAPBOX_TOKEN) return <MapNotConfigured />;

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded border border-slate-200">
      <div ref={containerRef} className="h-full w-full" />
      {hover ? (
        <div
          className="absolute z-10"
          style={{ left: hover.x + 8, top: hover.y + 8 }}
        >
          {hover.hotel ? <HotelMarkerTooltip hotel={hover.hotel} /> : null}
          {hover.cell ? <HeatmapTooltip cell={hover.cell} /> : null}
        </div>
      ) : null}
    </div>
  );
}
