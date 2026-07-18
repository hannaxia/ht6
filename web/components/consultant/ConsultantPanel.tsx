"use client";

import { useState } from "react";
import { useAIConsultant } from "../../contexts/AIConsultantContext";
import { useSession } from "../../contexts/SessionContext";
import { aiApi } from "../../lib/api/ai";
import { ApiError } from "../../lib/api/client";
import { log } from "../../lib/log";
import { Panel } from "../shared/Panel";
import { AiNotConfigured } from "./AiNotConfigured";
import { ConsultantMessage } from "./ConsultantMessage";
import { PromptForm } from "./PromptForm";

interface Exchange {
  prompt: string;
  reply: string;
}

/**
 * Collapsible side panel available from Discover and Sandbox.
 * Plain text output — no avatars, no typing indicators, no gradients.
 */
export function ConsultantPanel({ context }: { context?: unknown }) {
  const { isOpen, close, applyDeltas } = useAIConsultant();
  const { sessionId } = useSession();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function submit(prompt: string) {
    setPending(true);
    setErrorCode(null);
    try {
      const response = await aiApi.consult({ sessionId, prompt, context });
      setExchanges((prev) => [...prev, { prompt, reply: response.message }]);
      if (response.deltas.hotel || response.deltas.simulation) {
        applyDeltas(response.deltas);
      }
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "ai_not_configured") {
        setNotConfigured(true);
      } else if (err instanceof ApiError) {
        setErrorCode(err.errorCode);
        log.warn("ai consult failed", err.errorCode);
      } else {
        setErrorCode("internal_error");
        log.error("ai consult failed", err);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="AI Consultant" isOpen={isOpen} onClose={close}>
      {notConfigured ? (
        <AiNotConfigured />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {exchanges.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ask about locations, renovations, amenities, or competitors.
                Every number in the reply is a simulation estimate.
              </p>
            ) : (
              exchanges.map((exchange, i) => (
                <div key={i} className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    {exchange.prompt}
                  </p>
                  <ConsultantMessage text={exchange.reply} />
                </div>
              ))
            )}
            {errorCode ? (
              <p className="text-sm text-red-700">
                Request failed ({errorCode}). Try again.
              </p>
            ) : null}
          </div>
          <PromptForm onSubmit={submit} pending={pending} />
        </div>
      )}
    </Panel>
  );
}
