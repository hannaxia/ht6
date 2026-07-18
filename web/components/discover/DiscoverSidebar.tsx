"use client";

import type { Stay22Hotel } from "../../lib/api/schemas";
import type { PlacedPin } from "./DiscoverMap";
import { Stay22Attribution } from "../shared/Stay22Attribution";

/**
 * Right-hand panel over the fullscreen map. Shows details for a selected
 * existing hotel, or a naming form for a user-placed pin. Both surface a
 * "Configure" action that hands off to the Hotel Sandbox.
 */
export function DiscoverSidebar({
  selectedHotel,
  placedPin,
  newHotelName,
  onNewHotelNameChange,
  onConfigureHotel,
  onConfigurePlaced,
  onClose,
}: {
  selectedHotel: Stay22Hotel | null;
  placedPin: PlacedPin | null;
  newHotelName: string;
  onNewHotelNameChange: (name: string) => void;
  onConfigureHotel: () => void;
  onConfigurePlaced: () => void;
  onClose: () => void;
}) {
  if (!selectedHotel && !placedPin) return null;

  return (
    <aside className="absolute right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">
          {selectedHotel ? "Hotel details" : "New hotel"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedHotel ? (
          <HotelDetails hotel={selectedHotel} />
        ) : placedPin ? (
          <PlacedForm
            placedPin={placedPin}
            name={newHotelName}
            onNameChange={onNewHotelNameChange}
          />
        ) : null}
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={selectedHotel ? onConfigureHotel : onConfigurePlaced}
          disabled={!selectedHotel && newHotelName.trim().length === 0}
          className="w-full rounded bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Configure →
        </button>
        <p className="mt-2 text-[11px] text-slate-500">
          Opens the Hotel Sandbox
          {selectedHotel
            ? " prefilled to match this hotel."
            : " with a starting configuration."}{" "}
          All resulting metrics are simulation estimates.
        </p>
      </div>
    </aside>
  );
}

function HotelDetails({ hotel }: { hotel: Stay22Hotel }) {
  const photo = hotel.images[0];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded bg-slate-200">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={hotel.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-slate-400">No photo</span>
        )}
      </div>

      <div>
        <p className="font-semibold text-slate-900">{hotel.name}</p>
        {hotel.city ? (
          <p className="text-xs text-slate-500">
            {hotel.city}
            {hotel.country ? `, ${hotel.country}` : ""}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2">
        {hotel.stars !== undefined ? (
          <Stat label="Stars" value={`${hotel.stars}★`} />
        ) : null}
        {hotel.rating !== undefined ? (
          <Stat label="Guest rating" value={`${hotel.rating.toFixed(1)}/5`} />
        ) : null}
        {hotel.price ? (
          <Stat
            label="Price"
            value={`$${hotel.price.amount} ${hotel.price.currency}/${hotel.price.per}`}
          />
        ) : null}
      </dl>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Amenities</p>
        {hotel.amenities.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {hotel.amenities.map((a) => (
              <span
                key={a}
                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
              >
                {a.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">None listed.</p>
        )}
      </div>

      {hotel.bookingUrl ? (
        <a
          href={hotel.bookingUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block text-xs font-medium text-blue-700 hover:underline"
        >
          View on Stay22 →
        </a>
      ) : null}

      <Stay22Attribution />
    </div>
  );
}

function PlacedForm({
  placedPin,
  name,
  onNameChange,
}: {
  placedPin: PlacedPin;
  name: string;
  onNameChange: (name: string) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        Drop a hotel here and configure it in the sandbox.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Hotel name
        </span>
        <input
          type="text"
          value={name}
          autoFocus
          placeholder="e.g. Harbourfront Suites"
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      </label>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Latitude" value={placedPin.lat.toFixed(4)} />
        <Stat label="Longitude" value={placedPin.lng.toFixed(4)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-xs font-medium text-slate-800">{value}</dd>
    </div>
  );
}
