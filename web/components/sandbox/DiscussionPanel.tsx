"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/api/client";
import {
  discussionApi,
  type DiscussionMessage,
} from "../../lib/api/discussion";
import type { HotelConfigPayload, SimulateHotelOutput } from "../../lib/api/schemas";
import { log } from "../../lib/log";
import { EstimateLabel } from "../shared/EstimateLabel";
import { buildDiscussionRequest } from "./discussionSnapshot";

const REVEAL_STAGGER_MS = 700;

type Status =
  | "idle"
  | "generating"
  | "ready"
  | "error"
  | "not_configured";

const SPEAKERS = {
  guest: { avatar: "🙂", label: "Guest" },
  manager: { avatar: "👔", label: "Revenue Manager" },
} as const;

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
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Baseline for computing deltas / recent changes: the config + metrics the
  // agents last discussed. Deltas therefore describe everything that changed
  // since the previous time the agents were called.
  const prevConfigRef = useRef<HotelConfigPayload | null>(null);
  const prevMetricsRef = useRef<SimulateHotelOutput | null>(null);

  function clearRevealTimers() {
    for (const t of revealTimersRef.current) clearTimeout(t);
    revealTimersRef.current = [];
  }

  function revealMessages(count: number) {
    clearRevealTimers();
    setVisibleCount(0);
    for (let i = 0; i < count; i++) {
      const t = setTimeout(() => setVisibleCount(i + 1), i * REVEAL_STAGGER_MS);
      revealTimersRef.current.push(t);
    }
  }

  async function callAgents() {
    if (!config || !metrics) return;

    // A previous call still running? Cancel it and start fresh.
    abortRef.current?.abort();
    clearRevealTimers();

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
    setMessages([]);
    setVisibleCount(0);

    try {
      const res = await discussionApi.create(request, controller.signal);
      if (controller.signal.aborted) return;
      prevConfigRef.current = config;
      prevMetricsRef.current = metrics;
      setMessages(res.messages);
      setStatus("ready");
      revealMessages(res.messages.length);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError && err.errorCode === "ai_not_configured") {
        setStatus("not_configured");
      } else {
        setStatus("error");
        setErrorMessage("The AI discussion could not be generated.");
        log.warn("discussion request failed", err);
      }
    }
  }

  // Tidy up on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearRevealTimers();
    };
  }, []);

  const busy = status === "generating";
  const canCall = Boolean(config && metrics) && !busy;

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
          revenue manager weigh in on the current setup.
        </p>
      ) : null}

      {status === "generating" ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
          </span>
          Guest and revenue manager are talking it through…
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="space-y-3">
          {messages.slice(0, visibleCount).map((m, i) => {
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
          {visibleCount >= messages.length && messages.length > 0 ? (
            <EstimateLabel />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
