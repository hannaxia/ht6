import { ApiError, BACKEND_URL } from "./client";
import { errorEnvelopeSchema } from "./schemas";
import type { HotelConfigPayload, SimulateHotelOutput } from "./schemas";
import { log } from "../log";

export interface ReactionsRequest {
  before: HotelConfigPayload | null;
  after: HotelConfigPayload;
  beforeMetrics: SimulateHotelOutput | null;
  afterMetrics: SimulateHotelOutput;
}

export interface ReactionsHandlers {
  onPersonaStart: (persona: string, label: string) => void;
  onChunk: (persona: string, text: string) => void;
  onPersonaEnd: (persona: string) => void;
  onError: (persona: string, message: string) => void;
  onDone: () => void;
}

/**
 * Consumes the /ai/reactions SSE stream. EventSource can't POST, so this
 * reads the fetch() response body as a stream and parses the SSE wire
 * format ("event: x\ndata: y\n\n") by hand.
 */
export async function streamReactions(
  payload: ReactionsRequest,
  handlers: ReactionsHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/ai/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const body = errorEnvelopeSchema.safeParse(
      await res.json().catch(() => ({})),
    );
    throw new ApiError(
      body.success
        ? body.data
        : { errorCode: "internal_error", message: `HTTP ${res.status}` },
    );
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported in this browser.");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      const eventLine = raw.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.slice(6).trim();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(dataLine.slice(5).trim());
      } catch {
        log.warn("malformed SSE data line", dataLine);
        continue;
      }
      switch (event) {
        case "persona_start":
          handlers.onPersonaStart(
            String(data.persona),
            String(data.label ?? data.persona),
          );
          break;
        case "chunk":
          handlers.onChunk(String(data.persona), String(data.text ?? ""));
          break;
        case "persona_end":
          handlers.onPersonaEnd(String(data.persona));
          break;
        case "error":
          handlers.onError(String(data.persona), String(data.message ?? ""));
          break;
        case "done":
          handlers.onDone();
          break;
        default:
          log.warn("unknown SSE event", event);
      }
    }
  }
}
