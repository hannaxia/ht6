"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import type { OpportunityCell, Stay22Hotel } from "../../lib/api/schemas";
import { log } from "../../lib/log";
import { HeatmapTooltip } from "./HeatmapTooltip";
import { HotelMarkerTooltip } from "./HotelMarkerTooltip";
import { MapNotConfigured } from "./MapNotConfigured";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
// Centered so all of Canada is visible at initial load, zoomed out enough
// to see hotel markers coast-to-coast; the opportunity heatmap itself stays
// Toronto-scoped and will appear as a small cluster of cells near Toronto.
const CANADA_CENTER: [number, number] = [-96.0, 62.0];
const CANADA_ZOOM = 2.8;

const HOTELS_SOURCE_ID = "hotels-source";
const HOTELS_LAYER_ID = "hotels-layer";
const GRID_SOURCE_ID = "opportunity-grid-source";
const GRID_LAYER_ID = "opportunity-grid-layer";
// Half the grid cell "diameter" in degrees, used to draw each opportunity
// cell as a small square polygon around its center point.
const GRID_CELL_HALF_DEG = 0.004;

interface Hover {
  x: number;
  y: number;
  hotel?: Stay22Hotel;
  cell?: OpportunityCell;
}

function hotelsToGeoJson(hotels: Stay22Hotel[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: hotels.map((hotel) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [hotel.coordinates.lng, hotel.coordinates.lat],
      },
      // Stash the full hotel as a JSON string in properties — Mapbox
      // feature properties must be serializable, and this lets the hover
      // handler reconstruct the exact object the tooltip component expects.
      properties: { hotel: JSON.stringify(hotel) },
    })),
  };
}

function cellsToGeoJson(cells: OpportunityCell[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => {
      const { lng, lat } = cell.coordinates;
      const d = GRID_CELL_HALF_DEG;
      return {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [lng - d, lat - d],
              [lng + d, lat - d],
              [lng + d, lat + d],
              [lng - d, lat + d],
              [lng - d, lat - d],
            ],
          ],
        },
        properties: {
          opportunityScore: cell.opportunityScore,
          cell: JSON.stringify(cell),
        },
      };
    }),
  };
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
  const [hover, setHover] = useState<Hover | null>(null);
  const [pinned, setPinned] = useState<Hover | null>(null);

  // Never touch the Mapbox SDK without a token.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: CANADA_CENTER,
      zoom: CANADA_ZOOM,
      // Kept as the 3D globe. Note: deck.gl (used previously for these
      // layers) does not support Mapbox's globe projection — Mapbox
      // doesn't expose the camera/projection internals deck.gl needs, so
      // deck.gl markers visibly "float" off the sphere as it rotates
      // (open upstream issue: visgl/deck.gl#7920). Native Mapbox GL
      // GeoJSON layers (below) are rendered by Mapbox itself and stay
      // correctly pinned to the globe at every rotation/zoom.
      projection: "globe",
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(GRID_SOURCE_ID, {
        type: "geojson",
        data: cellsToGeoJson(cells),
      });
      map.addLayer({
        id: GRID_LAYER_ID,
        type: "fill",
        source: GRID_SOURCE_ID,
        paint: {
          // Red (low) → green (high) opportunity score, matching the
          // previous deck.gl scoreColor mapping.
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "opportunityScore"],
            0,
            "rgba(220,60,60,0.47)",
            100,
            "rgba(20,180,60,0.47)",
          ],
        },
      });

      map.addSource(HOTELS_SOURCE_ID, {
        type: "geojson",
        data: hotelsToGeoJson(hotels),
      });
      map.addLayer({
        id: HOTELS_LAYER_ID,
        type: "circle",
        source: HOTELS_SOURCE_ID,
        paint: {
          "circle-radius": 5,
          "circle-color": "rgba(30,64,175,0.9)",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });

      const setPointer = (isHover: boolean) => {
        map.getCanvas().style.cursor = isHover ? "pointer" : "";
      };

      map.on("mousemove", HOTELS_LAYER_ID, (e) => {
        setPointer(true);
        const feature = e.features?.[0];
        const raw = feature?.properties?.hotel;
        if (typeof raw === "string") {
          setHover({
            x: e.point.x,
            y: e.point.y,
            hotel: JSON.parse(raw) as Stay22Hotel,
          });
        }
      });
      map.on("mouseleave", HOTELS_LAYER_ID, () => {
        setPointer(false);
        setHover(null);
      });

      map.on("mousemove", GRID_LAYER_ID, (e) => {
        setPointer(true);
        const feature = e.features?.[0];
        const raw = feature?.properties?.cell;
        if (typeof raw === "string") {
          setHover({
            x: e.point.x,
            y: e.point.y,
            cell: JSON.parse(raw) as OpportunityCell,
          });
        }
      });
      map.on("mouseleave", GRID_LAYER_ID, () => {
        setPointer(false);
        setHover(null);
      });

      log.info("mapbox map initialized");
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep the GeoJSON sources in sync when hotels/cells props change.
  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({
      onClick: (info) => {
        if (info.layer?.id === "hotels" && info.object) {
          setPinned({
            x: info.x,
            y: info.y,
            hotel: info.object as Stay22Hotel,
          });
        } else {
          setPinned(null);
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
      {pinned?.hotel ? (
        <div
          className="absolute z-10"
          style={{ left: pinned.x + 8, top: pinned.y + 8 }}
        >
          <HotelMarkerTooltip hotel={pinned.hotel} />
        </div>
      ) : null}
      {hover ? (
        <div
          className="absolute z-20"
          style={{ left: hover.x + 8, top: hover.y + 8 }}
        >
          {hover.hotel ? <HotelMarkerTooltip hotel={hover.hotel} /> : null}
          {hover.cell ? <HeatmapTooltip cell={hover.cell} /> : null}
        </div>
      ) : null}
    </div>
  );
}
