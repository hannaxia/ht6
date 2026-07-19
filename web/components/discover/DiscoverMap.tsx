"use client";

import { BitmapLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  OpportunityCell,
  SavedHotel,
  Stay22Hotel,
} from "../../lib/api/schemas";
import { log } from "../../lib/log";
import { HeatmapLegend } from "./HeatmapLegend";
import { HeatmapTooltip } from "./HeatmapTooltip";
import { HotelMarkerTooltip } from "./HotelMarkerTooltip";
import { MapNotConfigured } from "./MapNotConfigured";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
// Matches api/src/cities.ts's toronto.bbox — where the camera lands on entry.
// Frontend duplicates this locally since web/ and api/ are separate deployables.
const TORONTO_BBOX = { north: 43.78, south: 43.58, east: -79.12, west: -79.64 };
// The map loads centered on Toronto, where the opportunity heatmap lives
// (the only market with seeded neighbourhood data) — no fly-in animation.
const TORONTO_CENTER: [number, number] = [
  (TORONTO_BBOX.east + TORONTO_BBOX.west) / 2,
  (TORONTO_BBOX.north + TORONTO_BBOX.south) / 2,
];
const TORONTO_ZOOM = 10.5;

// Red (low opportunity) → green (high). The score is a percentile (0-100),
// so colorDomain below pins the mapping deterministically: 0 = full red,
// 100 = full green, smoothly interpolated between.
const OPPORTUNITY_COLOR_RANGE: [number, number, number][] = [
  [215, 48, 39],
  [252, 141, 89],
  [254, 224, 139],
  [217, 239, 139],
  [145, 207, 96],
  [26, 152, 80],
];

// A percentile score (0-100) → an interpolated red→green colour, applied
// per pixel of the raster below so the mapping is deterministic.
function percentileToColor(score: number): [number, number, number] {
  const stops = OPPORTUNITY_COLOR_RANGE;
  const t = Math.max(0, Math.min(1, score / 100)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** Separable box blur of a WxH array (edge-clamped). */
function boxBlur(a: Float32Array, W: number, H: number, r: number): Float32Array {
  const win = 2 * r + 1;
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) {
        s += a[y * W + Math.min(W - 1, Math.max(0, x + d))]!;
      }
      tmp[y * W + x] = s / win;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      for (let d = -r; d <= r; d++) {
        s += tmp[Math.min(H - 1, Math.max(0, y + d)) * W + x]!;
      }
      out[y * W + x] = s / win;
    }
  }
  return out;
}

/**
 * Interpolates the discrete opportunity cells into a smooth, continuous
 * raster and returns it as a canvas + geographic bounds for a BitmapLayer.
 * The cells are a regular grid (minus water), so we bin them back into a 2D
 * array and run a normalised box blur — blurring the values and a coverage
 * mask with the same kernel, then dividing — which both smooths across cells
 * and fills the water gaps without letting them drag colours toward zero.
 * The GPU then bilinearly samples this small texture over the map, giving a
 * genuinely continuous gradient (not overlapping discs). Reliable because
 * BitmapLayer is a plain textured quad, unlike the GPU HeatmapLayer that
 * refused to composite in MapboxOverlay here.
 */
function buildOpportunityBitmap(
  cells: OpportunityCell[],
): { image: HTMLCanvasElement; bounds: [number, number, number, number] } | null {
  if (typeof document === "undefined" || cells.length === 0) return null;
  const halfLat = cells[0]!.cellHalfDegLat;
  const halfLng = cells[0]!.cellHalfDegLng;
  const sizeLat = halfLat * 2;
  const sizeLng = halfLng * 2;
  if (!(sizeLat > 0) || !(sizeLng > 0)) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of cells) {
    minLat = Math.min(minLat, c.coordinates.lat);
    maxLat = Math.max(maxLat, c.coordinates.lat);
    minLng = Math.min(minLng, c.coordinates.lng);
    maxLng = Math.max(maxLng, c.coordinates.lng);
  }
  const cols = Math.round((maxLng - minLng) / sizeLng) + 1;
  const rows = Math.round((maxLat - minLat) / sizeLat) + 1;
  if (cols < 2 || rows < 2 || cols * rows > 500_000) return null;

  const val = new Float32Array(cols * rows);
  const mask = new Float32Array(cols * rows);
  for (const c of cells) {
    const col = Math.round((c.coordinates.lng - minLng) / sizeLng);
    const row = Math.round((c.coordinates.lat - minLat) / sizeLat);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const idx = row * cols + col;
    val[idx] = c.opportunityScore;
    mask[idx] = 1;
  }

  // Normalised blur: blur value*mask and mask with the same kernel, divide.
  let v: Float32Array = val;
  let m: Float32Array = mask;
  for (let pass = 0; pass < 2; pass++) {
    v = boxBlur(v, cols, rows, 2);
    m = boxBlur(m, cols, rows, 2);
  }

  const img = new Uint8ClampedArray(cols * rows * 4);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      // Flip vertically: raster row 0 is the south edge → canvas bottom.
      const o = ((rows - 1 - row) * cols + col) * 4;
      const coverage = m[idx]!;
      if (coverage > 0.12) {
        const [r, g, b] = percentileToColor(v[idx]! / coverage);
        img[o] = r;
        img[o + 1] = g;
        img[o + 2] = b;
        // Feather the coastline/edges by fading alpha with coverage.
        img[o + 3] = Math.min(210, Math.round(coverage * 260));
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  canvas.getContext("2d")!.putImageData(new ImageData(img, cols, rows), 0, 0);
  return {
    image: canvas,
    bounds: [minLng - halfLng, minLat - halfLat, maxLng + halfLng, maxLat + halfLat],
  };
}

export interface PlacedPin {
  lat: number;
  lng: number;
}

interface Hover {
  x: number;
  y: number;
  hotel?: Stay22Hotel;
  cell?: OpportunityCell;
  saved?: SavedHotel;
}

export function DiscoverMap({
  hotels,
  cells,
  savedHotels = [],
  selectedHotelId,
  selectedSavedId,
  placedPin,
  onSelectHotel,
  onSelectSaved,
  onPlaceHotel,
}: {
  hotels: Stay22Hotel[];
  cells: OpportunityCell[];
  savedHotels?: SavedHotel[];
  selectedHotelId?: string | null;
  selectedSavedId?: string | null;
  placedPin?: PlacedPin | null;
  onSelectHotel?: (hotel: Stay22Hotel) => void;
  onSelectSaved?: (saved: SavedHotel) => void;
  onPlaceHotel?: (coords: PlacedPin) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // Keep the latest callbacks in refs so the overlay click handler (registered
  // once) always sees current values without re-registering.
  const onSelectHotelRef = useRef(onSelectHotel);
  const onPlaceHotelRef = useRef(onPlaceHotel);
  const onSelectSavedRef = useRef(onSelectSaved);
  onSelectHotelRef.current = onSelectHotel;
  onPlaceHotelRef.current = onPlaceHotel;
  onSelectSavedRef.current = onSelectSaved;

  // Smooth interpolated raster of the opportunity field, rebuilt only when
  // the cells change (not on every hover/selection re-render).
  const bitmap = useMemo(() => buildOpportunityBitmap(cells), [cells]);

  // Never touch the Mapbox SDK without a token.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: TORONTO_CENTER,
      zoom: TORONTO_ZOOM,
    });
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay);
    mapRef.current = map;
    overlayRef.current = overlay;

    // Lock orientation: no rotating (drag/touch) and no 3D tilt, so the map
    // always stays flat and north-up.
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.setMaxPitch(0);

    log.info("mapbox map initialized");

    // Instantly snap to precisely frame the Toronto bbox (accounting for the
    // actual container size/padding) — no animated camera movement.
    map.once("load", () => {
      map.fitBounds(
        [
          [TORONTO_BBOX.west, TORONTO_BBOX.south],
          [TORONTO_BBOX.east, TORONTO_BBOX.north],
        ],
        { padding: { top: 60, right: 60, bottom: 60, left: 0 }, duration: 0 },
      );
    });
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // All layers live in the single deck.gl overlay so hover/click stay unified.
  useEffect(() => {
    if (!overlayRef.current) return;
    const placedLayerData = placedPin ? [placedPin] : [];
    overlayRef.current.setProps({
      getCursor: ({ isDragging, isHovering }) =>
        isDragging ? "grabbing" : isHovering ? "pointer" : "crosshair",
      onClick: (info) => {
        // Clicking a saved (custom) hotel marker selects it.
        if (info.layer?.id === "saved-hotels" && info.object) {
          onSelectSavedRef.current?.(info.object as SavedHotel);
          return;
        }
        // Clicking an existing hotel marker selects it.
        if (info.layer?.id === "hotels" && info.object) {
          onSelectHotelRef.current?.(info.object as Stay22Hotel);
          return;
        }
        // Clicking anywhere else drops a new-hotel pin at that coordinate.
        const lng = info.coordinate?.[0];
        const lat = info.coordinate?.[1];
        if (lng !== undefined && lat !== undefined) {
          onPlaceHotelRef.current?.({ lat, lng });
        }
      },
      layers: [
        // Continuous opportunity field: the interpolated raster (see
        // buildOpportunityBitmap) drawn as a plain textured quad, GPU
        // bilinear-sampled into a smooth red→green gradient.
        ...(bitmap
          ? [
              new BitmapLayer({
                id: "opportunity-field",
                image: bitmap.image,
                bounds: bitmap.bounds,
                opacity: 0.62,
                pickable: false,
              }),
            ]
          : []),
        // Invisible but pickable — the raster can't surface a specific cell
        // on hover, so this transparent scatter over the same points supplies
        // the per-cell tooltip.
        new ScatterplotLayer<OpportunityCell>({
          id: "opportunity-hover",
          data: cells,
          pickable: true,
          radiusUnits: "meters",
          getRadius: 500,
          radiusMinPixels: 4,
          radiusMaxPixels: 60,
          getPosition: (d) => [d.coordinates.lng, d.coordinates.lat],
          getFillColor: [0, 0, 0, 0],
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
          // Existing Stay22 hotels render as blue (selected → amber).
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
        // Saved (custom) hotels render as red markers, above the base layer.
        new ScatterplotLayer<SavedHotel>({
          id: "saved-hotels",
          data: savedHotels,
          pickable: true,
          radiusMinPixels: 6,
          radiusMaxPixels: 16,
          stroked: true,
          lineWidthMinPixels: 2,
          getPosition: (d) => [d.coordinates.lng, d.coordinates.lat],
          getRadius: (d) => (d.id === selectedSavedId ? 14 : 9),
          getFillColor: (d) =>
            d.id === selectedSavedId ? [185, 28, 28, 255] : [220, 38, 38, 230],
          getLineColor: [255, 255, 255, 255],
          updateTriggers: {
            getFillColor: selectedSavedId,
            getRadius: selectedSavedId,
          },
          onHover: (info) =>
            setHover(
              info.object
                ? { x: info.x, y: info.y, saved: info.object }
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
      saved: savedHotels.length,
      placed: placedLayerData.length,
    });
  }, [hotels, cells, savedHotels, selectedHotelId, selectedSavedId, placedPin]);

  if (!MAPBOX_TOKEN) return <MapNotConfigured />;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {cells.length > 0 ? <HeatmapLegend /> : null}
      {hover ? (
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: hover.x + 8, top: hover.y + 8 }}
        >
          {hover.hotel ? <HotelMarkerTooltip hotel={hover.hotel} /> : null}
          {hover.cell ? <HeatmapTooltip cell={hover.cell} /> : null}
          {hover.saved ? (
            <div className="pointer-events-none w-40 rounded border border-slate-200 bg-white p-2 text-xs shadow">
              <p className="font-medium text-slate-800">{hover.saved.name}</p>
              <p className="text-slate-600">
                {hover.saved.config.stars}★{" "}
                {hover.saved.config.hotelType.replace(/_/g, " ")}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-red-600">
                Saved hotel
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
