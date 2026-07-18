import type { Stay22Hotel } from "../../lib/api/schemas";
import { Stay22Attribution } from "../shared/Stay22Attribution";

export function HotelMarkerTooltip({ hotel }: { hotel: Stay22Hotel }) {
  return (
    <div className="pointer-events-none rounded border border-slate-200 bg-white p-2 text-xs shadow">
      <p className="font-medium text-slate-800">{hotel.name}</p>
      {hotel.stars !== undefined ? (
        <p className="text-slate-600">{hotel.stars}★</p>
      ) : null}
      {hotel.price ? (
        <p className="text-slate-600">
          ${hotel.price.amount} {hotel.price.currency}/{hotel.price.per}{" "}
          <Stay22Attribution />
        </p>
      ) : (
        <Stay22Attribution />
      )}
    </div>
  );
}
