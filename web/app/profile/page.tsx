"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorBanner } from "../../components/shared/ErrorBanner";
import { useSession } from "../../contexts/SessionContext";
import { ApiError } from "../../lib/api/client";
import type { SavedHotel } from "../../lib/api/schemas";
import { savedHotelsApi } from "../../lib/api/savedHotels";
import { storeSandboxHandoff } from "../../lib/sandboxHandoff";
import { log } from "../../lib/log";

export default function ProfilePage() {
  const router = useRouter();
  const { sessionId, isAuthenticated } = useSession();
  const [savedHotels, setSavedHotels] = useState<SavedHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isAuthenticated || sessionId === "ssr") return;
    setLoading(true);
    savedHotelsApi
      .list(sessionId)
      .then((res) => {
        setSavedHotels(res.savedHotels);
        setErrorCode(null);
      })
      .catch((err) => {
        const code = err instanceof ApiError ? err.errorCode : "internal_error";
        setErrorCode(code);
        log.warn("saved hotels load failed", code);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  function openInSandbox(hotel: SavedHotel) {
    storeSandboxHandoff({
      label: hotel.name,
      origin: "saved",
      config: hotel.config,
      savedHotelId: hotel.id,
    });
    router.push("/sandbox");
  }

  function viewOnMap(hotel: SavedHotel) {
    router.push(`/discover?focus=${encodeURIComponent(hotel.id)}`);
  }

  async function remove(hotel: SavedHotel) {
    try {
      await savedHotelsApi.remove(hotel.id, sessionId);
      setSavedHotels((prev) => prev.filter((h) => h.id !== hotel.id));
    } catch (err) {
      const code = err instanceof ApiError ? err.errorCode : "internal_error";
      setErrorCode(code);
      log.warn("saved hotel delete failed", code);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-bold">Your saved hotels</h1>
        <p className="mt-3 text-slate-600">
          Log in to save hotel configurations and return to them from here or
          the map.
        </p>
        <div className="mt-6">
          <a
            href="/auth/login?returnTo=/profile"
            className="rounded bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            Log in
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="text-xl font-bold">Your saved hotels</h1>
        <p className="text-sm text-slate-600">
          Reopen any saved hotel in the sandbox, or view it on the map. All
          metrics are simulation estimates.
        </p>
      </div>

      {errorCode ? (
        <ErrorBanner
          errorCode={errorCode}
          message={
            errorCode === "database_unavailable"
              ? "MongoDB is not configured — saved hotels need it (README → Setup checklist → MongoDB Atlas)."
              : errorCode === "network_error"
                ? "Could not reach the Innsight API — is it running on port 4000?"
                : "Saved hotels could not be loaded."
          }
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : savedHotels.length === 0 ? (
        <p className="text-sm text-slate-500">
          No saved hotels yet. Configure a hotel in the{" "}
          <a href="/sandbox" className="font-medium text-slate-800 underline">
            sandbox
          </a>{" "}
          and click Save.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {savedHotels.map((hotel) => (
            <li
              key={hotel.id}
              className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-semibold text-slate-900">{hotel.name}</p>
                <p className="text-xs text-slate-500">
                  {hotel.config.rooms}-room {hotel.config.stars}★{" "}
                  {hotel.config.hotelType.replace(/_/g, " ")} ·{" "}
                  {hotel.coordinates.lat.toFixed(3)},{" "}
                  {hotel.coordinates.lng.toFixed(3)}
                </p>
              </div>

              {hotel.metrics ? (
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  {hotel.metrics.adr !== undefined ? (
                    <Metric
                      label="ADR"
                      value={`$${Math.round(hotel.metrics.adr)}`}
                    />
                  ) : null}
                  {hotel.metrics.occupancy !== undefined ? (
                    <Metric
                      label="Occupancy"
                      value={`${Math.round(hotel.metrics.occupancy)}%`}
                    />
                  ) : null}
                  {hotel.metrics.rating !== undefined ? (
                    <Metric
                      label="Rating"
                      value={`${hotel.metrics.rating.toFixed(1)}/5`}
                    />
                  ) : null}
                </dl>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openInSandbox(hotel)}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                >
                  Open in sandbox
                </button>
                <button
                  type="button"
                  onClick={() => viewOnMap(hotel)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                >
                  View on map
                </button>
                <button
                  type="button"
                  onClick={() => remove(hotel)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
