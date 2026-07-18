import type { Stay22Hotel } from "../../lib/api/schemas";
import { Stay22Attribution } from "../shared/Stay22Attribution";

export function HotelMarkerTooltip({ hotel }: { hotel: Stay22Hotel }) {
  const photo = hotel.images[0];
  return (
    <div className="pointer-events-none w-40 rounded border border-slate-200 bg-white p-2 text-xs shadow">
      <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded bg-slate-200">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={hotel.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-5 w-5"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="M21 16l-5-5-4 4-3-3-5 5" />
            </svg>
            <span className="text-[10px]">No photo</span>
          </div>
        )}
      </div>
      <p className="mt-1 whitespace-normal break-words font-medium text-slate-800">
        {hotel.name}
      </p>
      {hotel.stars !== undefined ? (
        <p className="text-slate-600">{hotel.stars}★ hotel</p>
      ) : hotel.rating !== undefined ? (
        <p className="text-slate-600">{hotel.rating.toFixed(1)}/5.0 guest rating</p>
      ) : null}
      {hotel.price ? (
        <p className="text-slate-600">
          ${hotel.price.amount} {hotel.price.currency}/{hotel.price.per}
        </p>
      ) : null}
      <div className="mt-1">
        <Stay22Attribution />
      </div>
    </div>
  );
}
