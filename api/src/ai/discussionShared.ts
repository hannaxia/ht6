import type { DiscussionTurn } from "../schemas/discussion.js";

const SPEAKER_LABELS: Record<DiscussionTurn["speaker"], string> = {
  guest: "Guest",
  manager: "Revenue Manager",
};

/** Render the running transcript as a compact, readable script for the model. */
export function formatTranscript(transcript: DiscussionTurn[]): string {
  return transcript
    .map((turn) => `${SPEAKER_LABELS[turn.speaker]}: ${turn.text}`)
    .join("\n");
}
