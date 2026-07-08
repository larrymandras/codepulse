/**
 * voiceState.ts — Pure 6-state voice mode state machine.
 *
 * No React imports. No side effects. Fully unit-testable.
 * Used by VoiceModePanel via useReducer(voiceReducer, initialState).
 *
 * State diagram:
 *   idle ──[WAKE]──→ listening
 *   listening ──[INTERIM_RESULT]──→ transcribing
 *   transcribing ──[FINAL_RESULT]──→ processing
 *   processing ──[TTS_START]──→ speaking
 *   speaking ──[TTS_END]──→ listening  (continuous next turn, no re-wake)
 *   any ──[END]──→ idle               (end-phrase / silence timeout / close)
 *   any ──[ERROR]──→ error-disabled
 *
 * Mirrors astridr/channels/voice.py:42-138 client-side (D-01, D-02).
 *
 * Phase 92, Plan 04 — VOX-02, VOX-03.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceState =
  | "idle"
  | "listening"
  | "transcribing"
  | "processing"
  | "speaking"
  | "error-disabled";

export type VoiceAction =
  | { type: "WAKE" }
  | { type: "INTERIM_RESULT" }
  | { type: "FINAL_RESULT" }
  | { type: "TTS_START" }
  | { type: "TTS_END" }
  | { type: "END" }
  | { type: "ERROR" };

// ─── End-phrase detection (mirrors voice.py:136-138) ─────────────────────────

const END_PHRASES = ["stop", "goodbye", "thanks", "that's all"];

/**
 * Returns true if the transcript is an end-phrase that should exit voice mode.
 *
 * Speech-to-text returns punctuated, capitalized transcripts ("Stop.",
 * "Goodbye,") and often prefixes filler ("okay goodbye"), so an exact match
 * against END_PHRASES never fires. Normalize (lowercase, strip punctuation) and
 * match if the whole utterance is an end-phrase OR ends with one — so a plain
 * "stop" / "goodbye" reliably exits without over-matching a real command.
 */
export function isEndPhrase(text: string): boolean {
  const norm = text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!norm) return false;
  if (END_PHRASES.includes(norm)) return true;
  const words = norm.split(" ");
  return (
    END_PHRASES.includes(words[words.length - 1]) ||
    END_PHRASES.includes(words.slice(-2).join(" "))
  );
}

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Pure reducer for the voice mode state machine.
 * Always returns a new state — never mutates, never throws.
 */
export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  // Global transitions (any state)
  if (action.type === "END") return "idle";
  if (action.type === "ERROR") return "error-disabled";

  // State-specific transitions
  switch (state) {
    case "idle":
      if (action.type === "WAKE") return "listening";
      return state;

    case "listening":
      if (action.type === "INTERIM_RESULT") return "transcribing";
      return state;

    case "transcribing":
      if (action.type === "FINAL_RESULT") return "processing";
      return state;

    case "processing":
      if (action.type === "TTS_START") return "speaking";
      return state;

    case "speaking":
      if (action.type === "TTS_END") return "listening"; // continuous next turn
      return state;

    case "error-disabled":
      return state; // terminal until toggled off externally

    default:
      return state;
  }
}
