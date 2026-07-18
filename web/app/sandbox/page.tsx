"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConsultantPanel } from "../../components/consultant/ConsultantPanel";
import { ChangeSummary } from "../../components/sandbox/ChangeSummary";
import { MetricsPanel } from "../../components/sandbox/MetricsPanel";
import { SandboxForm } from "../../components/sandbox/SandboxForm";
import { ErrorBanner } from "../../components/shared/ErrorBanner";
import { useAIConsultant } from "../../contexts/AIConsultantContext";
import { useSession } from "../../contexts/SessionContext";
import { ApiError } from "../../lib/api/client";
import type {
  HotelConfigPayload,
  SimulateHotelOutput,
} from "../../lib/api/schemas";
import { simulationsApi } from "../../lib/api/simulations";
import { createInFlightDebouncer } from "../../lib/debounce";
import { log } from "../../lib/log";

const DEFAULT_CONFIG: HotelConfigPayload = {
  hotelType: "midscale",
  rooms: 150,
  stars: 4,
  modernity: 0.7,
  renovationDelta: 0,
  amenities: ["wifi", "breakfast"],
  targetSegment: "mixed",
  basePrice: 180,
  segmentAdrNorm: 200,
  location: {
    type: "downtown",
    scores: { transit: 0.8, airport: 0.4, tourism: 0.7, business: 0.7 },
    coordinates: { lat: 43.6532, lng: -79.3832 },
    baseDemand: 68,
    locationDemand: 6,
    locationSatisfaction: 0.15,
  },
  competitors: [],
  baseRating: 3.5,
};

export default function SandboxPage() {
  const { open, lastDeltas } = useAIConsultant();
  const { sessionId } = useSession();
  const [config, setConfig] = useState<HotelConfigPayload>(DEFAULT_CONFIG);
  const [metrics, setMetrics] = useState<SimulateHotelOutput | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const debouncer = useRef(
    createInFlightDebouncer<SimulateHotelOutput | null>(250),
  );
  const metricsRef = useRef<SimulateHotelOutput | null>(null);
  metricsRef.current = metrics;
  const pendingConfig = useRef<HotelConfigPayload | null>(null);

  const simulate = useCallback(
    async (cfg: HotelConfigPayload) => {
      pendingConfig.current = cfg;
      const result = await debouncer.current(async () => {
        // Always simulate the newest config when the window opens.
        const latest = pendingConfig.current ?? cfg;
        try {
          const response = await simulationsApi.create(
            latest,
            sessionId,
            metricsRef.current,
          );
          setErrorCode(null);
          return response.result;
        } catch (err) {
          const code =
            err instanceof ApiError ? err.errorCode : "internal_error";
          setErrorCode(code);
          log.warn("simulation failed; retaining previous metrics", code);
          return null;
        }
      });
      if (result) setMetrics(result);
    },
    [sessionId],
  );

  // Run an initial simulation once the session hydrates.
  useEffect(() => {
    if (sessionId === "ssr") return;
    void simulate(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function handleChange(next: HotelConfigPayload) {
    setConfig(next);
    void simulate(next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Hotel Sandbox</h1>
          <p className="text-sm text-slate-600">
            Configure a hotel and watch the estimated metrics update. All
            values are simulation estimates.
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          AI Consultant
        </button>
      </div>

      {errorCode ? (
        <ErrorBanner
          errorCode={errorCode}
          message={
            errorCode === "database_unavailable"
              ? "MongoDB is not configured — simulations need it (README → Setup checklist → MongoDB Atlas). Previous metrics are retained."
              : errorCode === "network_error"
                ? "Could not reach the Innsight API — is it running on port 4000?"
                : "Simulation failed. Previous metrics are retained."
          }
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Configuration
          </h2>
          <SandboxForm config={config} onChange={handleChange} />
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Estimated metrics
          </h2>
          {metrics ? (
            <MetricsPanel metrics={metrics} />
          ) : (
            <p className="text-sm text-slate-500">
              Waiting for the first simulation… (requires the API and MongoDB —
              see README → Setup checklist)
            </p>
          )}
          {lastDeltas?.simulation && metrics ? (
            <div className="mt-4">
              <ChangeSummary before={metrics} after={lastDeltas.simulation} />
            </div>
          ) : null}
        </section>
      </div>
      <ConsultantPanel
        context={{ view: "sandbox", hotelConfig: config, metrics }}
      />
    </main>
  );
}
