/**
 * voiceState.ts — Pure 6-state voice mode state machine.
 *
 * No React imports. No side effects. Fully unit-testable.
 * Used by VoiceModePanel via useReducer(voiceReducer, initialState).
 *
 * State diagram:
 *   idle ──[WAKE]──→ listening
 *   listening ──[INTERIM_RESULT]──→ transcribing
 *   listening ──[FOLLOW_UP_EXPIRE]──→ idle           (14s follow-up window closes silently)
 *   transcribing ──[FINAL_RESULT]──→ processing
 *   processing ──[TTS_START]──→ speaking
 *   speaking ──[BARGE_IN]──→ transcribing            (interrupt — instant, does NOT exit)
 *   speaking ──[TTS_END, strictMode=false]──→ listening  (follow-up window opens)
 *   speaking ──[TTS_END, strictMode=true]──→ idle        (strict mode — no lingering window)
 *   idle|listening|transcribing|processing ──[END]──→ idle  (end-phrase / silence timeout / close)
 *   speaking ──[END]──→ speaking (no-op)              (D-01: a stray END never exits mid-reply;
 *                                                       "stop" while speaking dispatches BARGE_IN instead)
 *   any ──[ERROR]──→ error-disabled
 *
 * Mirrors astridr/channels/voice.py:42-138 client-side (D-01, D-02).
 *
 * Phase 92, Plan 04 — VOX-02, VOX-03.
 * Phase 183, Plan 02 — CONV-01 (barge-in), CONV-02 (strict-mode-aware follow-up window).
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
  | { type: "TTS_END"; strictMode: boolean }
  | { type: "BARGE_IN" }
  | { type: "FOLLOW_UP_EXPIRE" }
  | { type: "END" }
  | { type: "ERROR" };

// ─── Phrase normalization (shared by isEndPhrase / isBargeInPhrase / isStrictModeCommand) ────

/**
 * Lowercase, strip punctuation (keep apostrophes so "that's" stays intact), collapse
 * whitespace, trim. Speech-to-text returns punctuated, capitalized transcripts
 * ("Stop.", "Wait, wait —"), so every phrase matcher in this file normalizes first.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const norm = normalize(text);
  if (!norm) return false;
  if (END_PHRASES.includes(norm)) return true;
  const words = norm.split(" ");
  return (
    END_PHRASES.includes(words[words.length - 1]) ||
    END_PHRASES.includes(words.slice(-2).join(" "))
  );
}

// ─── Barge-in phrase detection (D-02/D-03) ───────────────────────────────────

const BARGE_IN_PHRASES = [
  "ástríðr",
  "astridr",
  "astrid",
  "hey astridr",
  "stop",
  "wait",
  "hold on",
  "hang on",
  "wait wait",
  "one sec",
  "pause",
];

/**
 * Returns true if the transcript is a barge-in phrase — a name/attention-getter
 * or a stop/wait filler spoken while Ástríðr is talking (dispatched as BARGE_IN,
 * not END — D-01). Reuses isEndPhrase's normalize step, then checks whether any
 * BARGE_IN_PHRASES entry appears as a contiguous word-sequence ANYWHERE in the
 * utterance (leading, trailing, or mid-sentence) — reflexive interrupts land in
 * all three positions ("hold on a moment", "no wait wait", "astridr stop"), not
 * just at the end.
 */
export function isBargeInPhrase(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  const words = norm.split(" ");
  return BARGE_IN_PHRASES.some((phrase) => {
    const phraseWords = phrase.split(" ");
    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      if (phraseWords.every((w, j) => words[i + j] === w)) return true;
    }
    return false;
  });
}

// ─── Spoken strict-mode toggle command (D-05) ────────────────────────────────

const STRICT_MODE_ON_PHRASES = [
  "strict mode on",
  "enable strict mode",
  "turn on strict mode",
  "turn strict mode on",
];

const STRICT_MODE_OFF_PHRASES = [
  "strict mode off",
  "disable strict mode",
  "turn off strict mode",
  "turn strict mode off",
];

/**
 * Returns "on"/"off" if the transcript is a recognized spoken strict-mode
 * command, or null otherwise (the component only fast-paths on a real command
 * — no fuzzy/trailing match here, unlike isBargeInPhrase, since a false
 * positive would silently flip a persisted preference).
 */
export function isStrictModeCommand(text: string): "on" | "off" | null {
  const norm = normalize(text);
  if (!norm) return null;
  if (STRICT_MODE_ON_PHRASES.includes(norm)) return "on";
  if (STRICT_MODE_OFF_PHRASES.includes(norm)) return "off";
  return null;
}

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Pure reducer for the voice mode state machine.
 * Always returns a new state — never mutates, never throws.
 */
export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  // ERROR is the only truly global transition — any state can hard-fault.
  if (action.type === "ERROR") return "error-disabled";

  // State-specific transitions
  switch (state) {
    case "idle":
      if (action.type === "WAKE") return "listening";
      if (action.type === "END") return "idle";
      return state;

    case "listening":
      if (action.type === "INTERIM_RESULT") return "transcribing";
      if (action.type === "FOLLOW_UP_EXPIRE") return "idle";
      if (action.type === "END") return "idle";
      return state;

    case "transcribing":
      if (action.type === "FINAL_RESULT") return "processing";
      if (action.type === "END") return "idle";
      return state;

    case "processing":
      if (action.type === "TTS_START") return "speaking";
      if (action.type === "END") return "idle";
      return state;

    case "speaking":
      // D-01: "stop" while speaking is an interrupt (BARGE_IN), not an exit —
      // the component dispatches BARGE_IN for isEndPhrase("stop") hits during
      // TTS playback. A stray END here is a no-op, not an exit.
      if (action.type === "BARGE_IN") return "transcribing";
      if (action.type === "TTS_END") return action.strictMode ? "idle" : "listening";
      return state;

    case "error-disabled":
      return state; // terminal until toggled off externally

    default:
      return state;
  }
}
