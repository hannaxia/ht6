"use client";

import { useRef, useState } from "react";
import { ApiError } from "../../lib/api/client";
import { streamReactions } from "../../lib/api/reactionsStream";
import type { HotelConfigPayload, SimulateHotelOutput } from "../../lib/api/schemas";
import { log } from "../../lib/log";
import { EstimateLabel } from "../shared/EstimateLabel";

interface ReactionState {
  label: string;
  text: string;
  done: boolean;
  error?: string;
}

export function ReactionsFeed({
  before,
  after,
  beforeMetrics,
  afterMetrics,
}: {
  before: HotelConfigPayload | null;
  after: HotelConfigPayload | null;
  beforeMetrics: SimulateHotelOutput | null;
  afterMetrics: SimulateHotelOutput | null;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
  const [pending, setPending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleClick() {
    if (!after || !afterMetrics) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOrder([]);
    setReactions({});
    setNotConfigured(false);
    setGlobalError(null);
    setPending(true);

    try {
      await streamReactions(
        { before, after, beforeMetrics, afterMetrics },
        {
          onPersonaStart: (persona, label) => {
            setOrder((o) => [...o, persona]);
            setReactions((r) => ({
              ...r,
              [persona]: { label, text: "", done: false },
            }));
          },
          onChunk: (persona, text) => {
            setReactions((r) => ({
              ...r,
              [persona]: {
                ...r[persona],
                label: r[persona]?.label ?? persona,
                text: (r[persona]?.text ?? "") + text,
                done: false,
              },
            }));
          },
          onPersonaEnd: (persona) => {
            setReactions((r) =>
              r[persona] ? { ...r, [persona]: { ...r[persona], done: true } } : r,
            );
          },
          onError: (persona, message) => {
            setReactions((r) => ({
              ...r,
              [persona]: {
                label: r[persona]?.label ?? persona,
                text: r[persona]?.text ?? "",
                done: true,
                error: message,
              },
            }));
          },
          onDone: () => setPending(false),
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "ai_not_configured") {
        setNotConfigured(true);
      } else if (err instanceof ApiError) {
        setGlobalError(err.message);
        log.warn("reactions stream failed", err.errorCode);
      } else {
        setGlobalError("Reactions failed to load.");
        log.error("reactions stream failed", err);
      }
      setPending(false);
    }
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Reactions</h2>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || !after || !afterMetrics}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          {pending ? "Gathering reactions…" : "Get reactions"}
        </button>
      </div>

      {notConfigured ? (
        <p className="text-sm text-slate-600">
          Gemini is not configured — see README → Setup checklist → Gemini.
        </p>
      ) : null}
      {globalError ? <p className="text-sm text-red-700">{globalError}</p> : null}

      {order.length === 0 && !pending && !notConfigured && !globalError ? (
        <p className="text-sm text-slate-500">
          Click "Get reactions" to hear what a guest, staff member, local
          resident, and a competing hotel manager think of this change.
        </p>
      ) : null}

      <div className="space-y-3">
        {order.map((persona) => {
          const r = reactions[persona];
          if (!r) return null;
          return (
            <div
              key={persona}
              className="rounded border border-slate-200 bg-slate-50 p-3"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">
                  {r.label}
                </span>
                {!r.done ? (
                  <span className="text-xs text-slate-400">…</span>
                ) : null}
              </div>
              {r.error ? (
                <p className="text-sm text-red-700">{r.error}</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {r.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {order.length > 0 ? (
        <div className="mt-3">
          <EstimateLabel />
        </div>
      ) : null}
    </div>
  );
}
