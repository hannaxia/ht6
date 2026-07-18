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
import { savedHotelsApi } from "../../lib/api/savedHotels";
import { simulationsApi } from "../../lib/api/simulations";
import {
  consumeSandboxHandoff,
  DEFAULT_CONFIG,
} from "../../lib/sandboxHandoff";
import { createInFlightDebouncer } from "../../lib/debounce";
import { log } from "../../lib/log";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SandboxPage() {
  const { open, lastDeltas } = useAIConsultant();
  const { sessionId, isAuthenticated } = useSession();
  const [config, setConfig] = useState<HotelConfigPayload>(DEFAULT_CONFIG);
  const [hotelLabel, setHotelLabel] = useState<string | null>(null);
  // Save-to-profile state.
  const [savedHotelId, setSavedHotelId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);
  // Gates the first simulation until we've checked for a Market Discovery
  // handoff, so we never fire a throwaway simulation for the default config
  // (which the in-flight debouncer could let win over the real handoff).
  const [handoffResolved, setHandoffResolved] = useState(false);
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

  // On mount, pick up a config handed off from Market Discovery (selecting an
  // existing hotel or dropping a new-hotel pin). Falls back to DEFAULT_CONFIG
  // for a direct visit to /sandbox.
  useEffect(() => {
    const handoff = consumeSandboxHandoff();
    if (handoff) {
      setConfig(handoff.config);
      setHotelLabel(handoff.label);
      setSaveName(handoff.label);
      if (handoff.savedHotelId) setSavedHotelId(handoff.savedHotelId);
      log.info("sandbox config from discovery handoff", handoff.origin);
    }
    setHandoffResolved(true);
  }, []);

  // Editing the config after a save means the persisted copy is now stale.
  function markUnsaved() {
    setSaveStatus((s) => (s === "saved" ? "idle" : s));
  }

  async function handleSave() {
    if (!isAuthenticated || saveStatus === "saving") return;
    const name = saveName.trim();
    if (!name) return;
    setSaveStatus("saving");
    setSaveErrorCode(null);
    try {
      const { savedHotel } = await savedHotelsApi.save({
        sessionId,
        id: savedHotelId ?? undefined,
        name,
        config,
        metrics,
      });
      setSavedHotelId(savedHotel.id);
      setHotelLabel(savedHotel.name);
      setSaveStatus("saved");
      log.info("hotel saved", savedHotel.id);
    } catch (err) {
      const code = err instanceof ApiError ? err.errorCode : "internal_error";
      setSaveErrorCode(code);
      setSaveStatus("error");
      log.warn("save failed", code);
    }
  }

  // Simulate whenever the config changes, once the session has hydrated and
  // the handoff has been resolved. config is the single source of truth; the
  // in-flight debouncer coalesces rapid edits.
  useEffect(() => {
    if (sessionId === "ssr" || !handoffResolved) return;
    void simulate(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, handoffResolved, config]);

  function handleChange(next: HotelConfigPayload) {
    setConfig(next);
    markUnsaved();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Hotel Sandbox
            {hotelLabel ? (
              <span className="text-slate-400"> — {hotelLabel}</span>
            ) : null}
          </h1>
          <p className="text-sm text-slate-600">
            Configure a hotel and watch the estimated metrics update. All
            values are simulation estimates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <input
                type="text"
                value={saveName}
                placeholder="Name this hotel"
                onChange={(e) => {
                  setSaveName(e.target.value);
                  markUnsaved();
                }}
                className="w-44 rounded border border-slate-300 px-2 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === "saving" || saveName.trim().length === 0}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "saved"
                    ? "Saved ✓"
                    : savedHotelId
                      ? "Update"
                      : "Save"}
              </button>
            </>
          ) : (
            <a
              href="/auth/login?returnTo=/sandbox"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              title="Log in to save this hotel to your profile"
            >
              Log in to save
            </a>
          )}
          <button
            type="button"
            onClick={open}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            AI Consultant
          </button>
        </div>
      </div>

      {saveStatus === "error" ? (
        <ErrorBanner
          errorCode={saveErrorCode ?? "internal_error"}
          message={
            saveErrorCode === "database_unavailable"
              ? "MongoDB is not configured — saving needs it (README → Setup checklist → MongoDB Atlas)."
              : saveErrorCode === "network_error"
                ? "Could not reach the Innsight API — is it running on port 4000?"
                : "Could not save this hotel. Please try again."
          }
        />
      ) : null}

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
