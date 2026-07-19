"use client";

import dynamic from "next/dynamic";
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
  InvestmentMode,
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

// WebGL only runs in the browser — load the model client-side only.
const SandboxModel = dynamic(
  () =>
    import("../../components/sandbox/SandboxModel").then((m) => m.SandboxModel),
  { ssr: false },
);

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SandboxPage() {
  const { open, lastDeltas } = useAIConsultant();
  const { sessionId, isAuthenticated } = useSession();
  const [config, setConfig] = useState<HotelConfigPayload>(DEFAULT_CONFIG);
  const [hotelLabel, setHotelLabel] = useState<string | null>(null);
  // True for a from-scratch hotel (placed pin) — only these can be renamed;
  // a hotel cloned from a real Stay22 listing keeps that listing's name.
  const [isCustom, setIsCustom] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  // Save-to-profile state.
  const [savedHotelId, setSavedHotelId] = useState<string | null>(null);
  const [investmentMode, setInvestmentMode] =
    useState<InvestmentMode>("new_build");
  const [startingConfig, setStartingConfig] =
    useState<HotelConfigPayload>(DEFAULT_CONFIG);
  const [baselineAnnualProfit, setBaselineAnnualProfit] = useState<number | null>(
    null,
  );
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
            {
              beforeMetrics: metricsRef.current,
              investmentMode,
              startingConfig,
              baselineAnnualOperatingProfit:
                investmentMode === "upgrade"
                  ? (baselineAnnualProfit ?? undefined)
                  : undefined,
            },
          );
          if (
            investmentMode === "upgrade" &&
            baselineAnnualProfit === null &&
            Number.isFinite(response.result.annualOperatingProfit)
          ) {
            setBaselineAnnualProfit(response.result.annualOperatingProfit);
          }
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
    [sessionId, investmentMode, startingConfig, baselineAnnualProfit],
  );

  // On mount, pick up a config handed off from Market Discovery (selecting an
  // existing hotel or dropping a new-hotel pin). Falls back to DEFAULT_CONFIG
  // for a direct visit to /sandbox.
  useEffect(() => {
    const handoff = consumeSandboxHandoff();
    if (handoff) {
      setConfig(handoff.config);
      setHotelLabel(handoff.label);
      setIsCustom(handoff.isCustom);
      setStartingConfig(handoff.config);
      const mode: InvestmentMode =
        handoff.origin === "existing" ||
        (handoff.origin === "saved" && !handoff.isCustom)
          ? "upgrade"
          : "new_build";
      setInvestmentMode(mode);
      setBaselineAnnualProfit(null);
      if (handoff.savedHotelId) setSavedHotelId(handoff.savedHotelId);
      log.info("sandbox config from discovery handoff", handoff.origin);
    } else {
      // Direct visit to /sandbox with no handoff — DEFAULT_CONFIG stands in
      // for a from-scratch hotel, so it's nameable like a placed pin.
      setHotelLabel("New hotel");
      setStartingConfig(DEFAULT_CONFIG);
      setInvestmentMode("new_build");
      setBaselineAnnualProfit(null);
    }
    setHandoffResolved(true);
  }, []);

  // Editing the config after a save means the persisted copy is now stale.
  function markUnsaved() {
    setSaveStatus((s) => (s === "saved" ? "idle" : s));
  }

  function startEditingName() {
    setNameDraft(hotelLabel ?? "");
    setEditingName(true);
  }

  function confirmName() {
    const name = nameDraft.trim();
    if (name) {
      setHotelLabel(name);
      markUnsaved();
    }
    setEditingName(false);
  }

  async function handleSave() {
    if (!isAuthenticated || saveStatus === "saving") return;
    const name = (hotelLabel ?? "").trim();
    if (!name) return;
    setSaveStatus("saving");
    setSaveErrorCode(null);
    try {
      const { savedHotel } = await savedHotelsApi.save({
        sessionId,
        id: savedHotelId ?? undefined,
        name,
        isCustom,
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
    <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            Hotel Sandbox
            {hotelLabel ? (
              <>
                {editingName ? (
                  <input
                    type="text"
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={confirmName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    className="w-48 rounded border border-slate-300 px-2 py-1 text-sm font-normal focus:border-slate-500 focus:outline-none"
                  />
                ) : (
                  <span className="text-slate-400">— {hotelLabel}</span>
                )}
                {isCustom && !editingName ? (
                  <button
                    type="button"
                    onClick={startEditingName}
                    aria-label="Rename hotel"
                    title="Rename hotel"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                ) : null}
              </>
            ) : null}
          </h1>
          <p className="text-sm text-slate-600">
            Configure a hotel and watch the estimated metrics update. All
            values are simulation estimates.
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white"
        >
          AI Consultant
        </button>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* Left column: all the text — configuration, then metrics. */}
        <div className="flex flex-col gap-6">
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
                Waiting for the first simulation… (requires the API and MongoDB
                — see README → Setup checklist)
              </p>
            )}
            {lastDeltas?.simulation && metrics ? (
              <div className="mt-4">
                <ChangeSummary before={metrics} after={lastDeltas.simulation} />
              </div>
            ) : null}
          </section>
        </div>

        {/* Right column: seamless 3D building (transparent, no panel). Wider
            than the text column and auto-fit so the model is never clipped. */}
        <div className="min-h-[420px] lg:min-h-[560px]">
          <SandboxModel
            hotelType={config.hotelType}
            hasPool={config.amenities.includes("pool")}
            petFriendly={config.amenities.includes("pet_friendly")}
            airportShuttle={config.amenities.includes("airport_shuttle")}
          />
        </div>
      </div>
      <ConsultantPanel
        context={{ view: "sandbox", hotelConfig: config, metrics }}
      />

      <div className="fixed bottom-6 right-6 z-30">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saveStatus === "saving" || (hotelLabel ?? "").trim().length === 0
            }
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved ✓"
                : savedHotelId
                  ? "Update"
                  : "Save"}
          </button>
        ) : (
          <a
            href="/auth/login?returnTo=/sandbox"
            className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium shadow-lg transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white"
            title="Log in to save this hotel to your profile"
          >
            Log in to save
          </a>
        )}
      </div>
    </main>
  );
}
