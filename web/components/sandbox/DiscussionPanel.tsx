"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/api/client";
import {
  DISCUSSION_TURNS,
  runDiscussionTurn,
  type DiscussionMessage,
} from "../../lib/api/discussion";
import type { HotelConfigPayload, SimulateHotelOutput } from "../../lib/api/schemas";
import { log } from "../../lib/log";
import { EstimateLabel } from "../shared/EstimateLabel";
import { buildDiscussionRequest } from "./discussionSnapshot";

type Status =
  | "idle"
  | "generating"
  | "ready"
  | "error"
  | "not_configured";

const SPEAKERS = {
  guest: { avatar: "🙂", label: "Guest" },
  manager: { avatar: "👔", label: "Manager" },
} as const;

// Fixed slots matching DISCUSSION_TURNS' order (guest1, manager1, guest2,
// manager2) — each of the 4 is its own independent HTTP request fired in
// parallel, so they can resolve in any order; keeping them in fixed
// positions means the display always reads guest → manager → guest →
// manager regardless of which one actually finished first.
type Slots = (DiscussionMessage | null)[];
const EMPTY_SLOTS: Slots = DISCUSSION_TURNS.map(() => null);

export function DiscussionPanel({
  hotelName,
  config,
  metrics,
}: {
  hotelName: string | null;
  config: HotelConfigPayload | null;
  metrics: SimulateHotelOutput | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Baseline for computing deltas / recent changes: the config + metrics the
  // agents last discussed. Deltas therefore describe everything that changed
  // since the previous time the agents were called.
  const prevConfigRef = useRef<HotelConfigPayload | null>(null);
  const prevMetricsRef = useRef<SimulateHotelOutput | null>(null);

  async function callAgents() {
    if (!config || !metrics) return;

    // A previous call still running? Cancel it and start fresh.
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    const request = buildDiscussionRequest(
      hotelName,
      config,
      metrics,
      prevConfigRef.current,
      prevMetricsRef.current,
    );

    setStatus("generating");
    setErrorMessage(null);
    setSlots(EMPTY_SLOTS);

    let notConfigured = false;
    let anyFailed = false;
    let anySucceeded = false;

    // Fired together as 4 independent requests (not chained) — each fills
    // its own fixed slot the moment it resolves, so whichever finishes
    // first appears first without disturbing display order.
    const turnPromises = DISCUSSION_TURNS.map((turn, index) =>
      runDiscussionTurn(turn, request, controller.signal)
        .then((message) => {
          if (controller.signal.aborted) return;
          anySucceeded = true;
          setSlots((prev) => {
            const next = [...prev];
            next[index] = message;
            return next;
          });
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          if (err instanceof ApiError && err.errorCode === "ai_not_configured") {
            notConfigured = true;
          } else {
            anyFailed = true;
            log.warn("discussion turn failed", turn, err);
          }
        }),
    );

    await Promise.all(turnPromises);
    if (controller.signal.aborted) return;

    if (notConfigured && !anySucceeded) {
      setStatus("not_configured");
    } else if (!anySucceeded) {
      setStatus("error");
      setErrorMessage("The AI discussion could not be generated.");
    } else {
      // At least one turn came through — show it even if others failed.
      prevConfigRef.current = config;
      prevMetricsRef.current = metrics;
      setStatus("ready");
      if (anyFailed) log.warn("discussion partially failed; showing what succeeded");
    }
  }

  // Tidy up on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const busy = status === "generating";
  const canCall = Boolean(config && metrics) && !busy;
  const messages = slots.filter((m): m is DiscussionMessage => m !== null);

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">AI Discussion</h2>
        <button
          type="button"
          onClick={() => void callAgents()}
          disabled={!canCall}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-slate-100 disabled:hover:text-slate-400"
        >
          {busy ? "Calling…" : "Call agents"}
        </button>
      </div>

      {status === "not_configured" ? (
        <p className="text-sm text-slate-600">
          Gemini is not configured — see README → Setup checklist → Gemini.
        </p>
      ) : null}

      {status === "error" ? (
        <p className="text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {status === "idle" ? (
        <p className="text-sm text-slate-500">
          Configure the hotel, then call the agents to hear a guest and a
          manager weigh in on the current setup.
        </p>
      ) : null}

      {busy && messages.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
          </span>
          Guest and manager are talking it through…
        </div>
      ) : null}

      {messages.length > 0 ? (
        <div className="space-y-3">
          {slots.map((m, i) => {
            if (!m) return null;
            const speaker = SPEAKERS[m.speaker];
            return (
              <div key={i} className="flex animate-fade-in-up gap-2">
                <span
                  className="mt-0.5 text-lg leading-none"
                  aria-hidden="true"
                >
                  {speaker.avatar}
                </span>
                <div className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 text-xs font-medium text-slate-500">
                    {speaker.label}
                  </div>
                  <p className="text-sm text-slate-700">{m.text}</p>
                  {m.recommendation ? (
                    <p className="mt-2 rounded bg-accent/10 px-2 py-1.5 text-sm font-medium text-slate-800">
                      Recommendation: {m.recommendation}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
          {/* More turns still in flight. */}
          {busy ? (
            <div className="flex items-center gap-1 pl-7 text-slate-400">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
            </div>
          ) : null}
          {status === "ready" ? <EstimateLabel /> : null}
        </div>
      ) : null}
    </div>
  );
}
