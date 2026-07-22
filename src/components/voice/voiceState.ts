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

// "stop" is deliberately NOT here: it is overloaded as the reflexive interrupt
// ("stop talking") and lives in BARGE_IN_PHRASES only — saying "stop" pauses
// her but NEVER ends the conversation (presence-page decision, 2026-07-20;
// intentional divergence from voice.py's end-phrase list).
// End-phrases are NOT silent: the voice engine sends them so she closes
// warmly, then re-arms after her reply — a silently discarded "thanks" read
// as "she did nothing" (live defect 2026-07-20).
const END_PHRASES = ["goodbye", "thanks", "thank you", "that's all"];

/**
 * Returns true if the transcript is an end-phrase that should end the
 * conversation (re-arm wake-word listening).
 *
 * Speech-to-text returns punctuated, capitalized transcripts ("Goodbye,") and
 * often prefixes filler ("okay goodbye"), so an exact match against
 * END_PHRASES never fires. Normalize (lowercase, strip punctuation) and match
 * if the whole utterance is an end-phrase OR ends with one — so a plain
 * "goodbye" reliably exits without over-matching a real command.
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

/**
 * Returns true if the WHOLE utterance is nothing but a barge-in phrase
 * ("stop", "wait", "hold on", …) — an interrupt reflex with no content. Used
 * outside `speaking`: a pure interrupt cancels a thinking turn (or is ignored)
 * instead of being sent to Ástríðr as a literal chat message. Contrast
 * isBargeInPhrase, which matches the phrase ANYWHERE inside a longer utterance.
 */
export function isPureBargeInPhrase(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  return BARGE_IN_PHRASES.includes(norm);
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
 *
 * Thin wrapper over CLIENT_VERB_REGISTRY's "strict_mode" entry (D-09,
 * Phase 185) — identical phrase lists / behavior, just re-expressed through
 * the generalized verb table below.
 */
export function isStrictModeCommand(text: string): "on" | "off" | null {
  const result = STRICT_MODE_VERB.match(text);
  return (result?.state as "on" | "off" | undefined) ?? null;
}

// ─── Vision-intent phrase detection (D-01 client fast-path) ──────────────────

// Discretion-granted draft phrase list (184-UI-SPEC.md Open Questions #1).
const VISION_INTENT_PHRASES = [
  "what's on my screen",
  "look at this",
  "what do you see",
  "read this",
];

// 184-08 live-UAT fix (2026-07-21): the exact-phrase/trailing-only matcher
// missed EVERY natural phrasing in the live verification — STT expands
// contractions ("what's" → "what is") and people append trailing words
// ("…on the screen i am sharing"), so the fast-path never fired all day and
// every vision turn fell through to the slower see_screen round-trip.
// Strength tiers:
//   strong — the original literal list (whole/trailing) OR an unambiguous
//            screen-context substring anywhere in the utterance.
//   weak   — whole-token co-occurrence of a screen-word AND a look-word
//            ("can you look at what i shared"). Weak matches capture when a
//            share is active but never trigger the D-03 refusal (a false
//            positive must not wrongly claim "I can't see your screen").
const VISION_STRONG_SUBSTRINGS = [
  "on my screen",
  "on the screen",
  "on my monitor",
  "screen i am sharing",
  "screen i'm sharing",
  "i am sharing",
  "i'm sharing",
  "shared with you",
];
const VISION_SCREEN_TOKENS = new Set(["screen", "screens", "monitor", "sharing", "shared"]);
const VISION_LOOK_TOKENS = new Set(["see", "look", "looking", "read", "reading", "show", "describe"]);

export type VisionIntentStrength = "strong" | "weak";

/**
 * Pure tiered matcher — see the strength-tier comment above. Reuses
 * `normalize()`; token checks are whole-token so "screenshots" never counts
 * as "screen". Stays pure — no `MediaStream` reference, no side effects
 * (file contract).
 */
export function visionIntentStrength(text: string): VisionIntentStrength | null {
  const norm = normalize(text);
  if (!norm) return null;
  if (VISION_INTENT_PHRASES.includes(norm)) return "strong";
  const words = norm.split(" ");
  const trailingMatch = VISION_INTENT_PHRASES.some((phrase) => {
    const phraseWords = phrase.split(" ");
    if (phraseWords.length > words.length) return false;
    const start = words.length - phraseWords.length;
    return phraseWords.every((w, j) => words[start + j] === w);
  });
  if (trailingMatch) return "strong";
  if (VISION_STRONG_SUBSTRINGS.some((p) => norm.includes(p))) return "strong";
  const hasScreenWord = words.some((w) => VISION_SCREEN_TOKENS.has(w));
  const hasLookWord = words.some((w) => VISION_LOOK_TOKENS.has(w));
  if (hasScreenWord && hasLookWord) return "weak";
  return null;
}

/**
 * Returns true if the transcript expresses vision intent at ANY strength —
 * a request to look at the shared screen (D-01 client fast-path).
 */
export function isVisionIntentPhrase(text: string): boolean {
  return visionIntentStrength(text) !== null;
}

// ─── Generalized client control-verb table (D-09, Phase 185 Plan 06) ────────
//
// 183's strict-mode and 184's vision-intent matchers, migrated into one
// generalized table alongside the swap_model/swap_voice matchers added below
// (SWAP-01/SWAP-02). Every entry is a pure function over normalize() with no
// DOM/React/side effects — the client only extracts intent/targets; dispatch
// and any resolution/side-effects happen in the caller (useAstridrVoice.ts /
// 185-07's executor). isStrictModeCommand and decideVisionIntent above are
// kept as thin wrappers over their registry entries — same phrase lists,
// same thresholds, same return shapes (D-09 behavior-identical guard).

export type ClientControlVerb = {
  name: string;
  match: (
    text: string,
    ctx?: { shareActive?: boolean }
  ) => Record<string, string> | null;
};

/**
 * "strict_mode" verb — identical phrase lists / logic as the pre-Phase-185
 * isStrictModeCommand. Returns `{ state: "on" | "off" }` or null.
 */
const STRICT_MODE_VERB: ClientControlVerb = {
  name: "strict_mode",
  match: (text: string) => {
    const norm = normalize(text);
    if (!norm) return null;
    if (STRICT_MODE_ON_PHRASES.includes(norm)) return { state: "on" };
    if (STRICT_MODE_OFF_PHRASES.includes(norm)) return { state: "off" };
    return null;
  },
};

// ─── Vision-intent decision + system-line side effects (D-01/D-02/D-03/D-11) ─

/** D-03 locked copy — no active share. */
export const VISION_REFUSAL_TEXT = "I can't see your screen — start a share and ask again.";
/** D-11 locked [DEFAULT] copy — the shared track ended natively. */
export const LOST_SCREEN_TEXT = "Looks like I lost your screen.";

export type VisionIntentAction = "capture" | "refuse";

/**
 * "vision_intent" verb — identical strength-tiered logic as the
 * pre-Phase-185 decideVisionIntent. Returns `{ action: "capture" | "refuse",
 * strength }` or null; `ctx.shareActive` defaults to false.
 */
const VISION_INTENT_VERB: ClientControlVerb = {
  name: "vision_intent",
  match: (text: string, ctx?: { shareActive?: boolean }) => {
    const strength = visionIntentStrength(text);
    if (strength === null) return null;
    const shareActive = ctx?.shareActive ?? false;
    if (shareActive) return { action: "capture", strength };
    // No active share: only STRONG matches earn the D-03 refusal. A weak
    // co-occurrence false positive falls through to the normal pipeline —
    // the backend see_screen net still answers honestly if it really was a
    // vision question (184-08 tiering).
    return strength === "strong" ? { action: "refuse", strength } : null;
  },
};

/**
 * Pure decision: does this transcript express vision intent, and if so,
 * should the caller capture-and-send (a share is already active, D-02) or
 * refuse-and-arm (no active share, D-03)? Returns null for non-vision
 * utterances so the caller's normal pipeline (accumulate/send, end-phrase,
 * noise gate) proceeds unchanged. Stays pure — no side effects.
 *
 * Thin wrapper over CLIENT_VERB_REGISTRY's "vision_intent" entry (D-09,
 * Phase 185) — identical strength tiering / behavior.
 */
export function decideVisionIntent(text: string, shareActive: boolean): VisionIntentAction | null {
  const result = VISION_INTENT_VERB.match(text, { shareActive });
  return (result?.action as VisionIntentAction | undefined) ?? null;
}

/**
 * D-03: runs the no-share refusal's side effects via injected callbacks —
 * kept here (not useAstridrVoice.ts) so the "spoken AND written, never
 * voice-only" invariant is unit-testable without rendering the full voice
 * hook. This function itself performs no browser/DOM/MediaStream access —
 * only invokes what the caller provides.
 */
export function runVisionRefusal(callbacks: {
  speak: (text: string) => void;
  appendLocalAssistantMessage: (text: string) => void;
  arm: () => void;
}): void {
  callbacks.speak(VISION_REFUSAL_TEXT);
  callbacks.appendLocalAssistantMessage(VISION_REFUSAL_TEXT);
  callbacks.arm();
}

/**
 * D-11: runs the lost-screen acknowledgement's side effects via injected
 * callbacks — same rationale as `runVisionRefusal`.
 */
export function runLostScreenAck(callbacks: {
  speak: (text: string) => void;
  appendLocalAssistantMessage: (text: string) => void;
}): void {
  callbacks.speak(LOST_SCREEN_TEXT);
  callbacks.appendLocalAssistantMessage(LOST_SCREEN_TEXT);
}

// ─── Brain/voice hot-swap client matchers (SWAP-01/SWAP-02, D-09 mechanism) ──
//
// Pure target/restore EXTRACTION only — no fetch, no catalogue resolution,
// no fuzzy matching, no refusal. Catalogue resolution + D-08 refusal are
// backend-only (185-02/03); this client matcher just forwards the raw
// target string to the backend swap executor (wired in 185-07).

const SWAP_MODEL_RESTORE_PHRASES = [
  "back to your usual brain",
  "switch back to your usual brain",
  "go back to your usual brain",
  "restore your usual brain",
];

const SWAP_MODEL_TARGET_PREFIXES = [
  "try on ",
  "switch your brain to ",
  "switch brain to ",
];

/**
 * "swap_model" verb — extracts the raw target brain name from "try on X" /
 * "switch your brain to X", or `{ restore: "true" }` for the restore
 * phrasing. Returns null for anything else. Pure — no fetch/resolution.
 */
export const SWAP_MODEL_VERB: ClientControlVerb = {
  name: "swap_model",
  match: (text: string): Record<string, string> | null => {
    const norm = normalize(text);
    if (!norm) return null;
    if (SWAP_MODEL_RESTORE_PHRASES.includes(norm)) return { restore: "true" };
    for (const prefix of SWAP_MODEL_TARGET_PREFIXES) {
      if (norm.startsWith(prefix)) {
        const target = norm.slice(prefix.length).trim();
        if (target) return { target };
      }
    }
    return null;
  },
};

const SWAP_VOICE_RESTORE_PHRASES = [
  "back to your usual voice",
  "switch back to your usual voice",
  "go back to your usual voice",
  "restore your usual voice",
];

const SWAP_VOICE_TARGET_PREFIXES = [
  "switch your voice to ",
  "switch voice to ",
  "change your voice to ",
];

/**
 * "swap_voice" verb — extracts the raw target voice name from "switch your
 * voice to X", or `{ restore: "true" }` for the restore phrasing. Returns
 * null for anything else. Pure — no fetch/resolution.
 */
export const SWAP_VOICE_VERB: ClientControlVerb = {
  name: "swap_voice",
  match: (text: string): Record<string, string> | null => {
    const norm = normalize(text);
    if (!norm) return null;
    if (SWAP_VOICE_RESTORE_PHRASES.includes(norm)) return { restore: "true" };
    for (const prefix of SWAP_VOICE_TARGET_PREFIXES) {
      if (norm.startsWith(prefix)) {
        const target = norm.slice(prefix.length).trim();
        if (target) return { target };
      }
    }
    return null;
  },
};

/**
 * The generalized client control-verb table (D-09, Phase 185 Plan 06).
 * strict_mode, vision_intent (migrated from 183/184, behavior-identical)
 * plus swap_model/swap_voice (SWAP-01/SWAP-02). Every entry is pure over
 * normalize() — no DOM/React/fetch/side effects; dispatch/resolution live
 * in the caller.
 */
export const CLIENT_VERB_REGISTRY: ClientControlVerb[] = [
  STRICT_MODE_VERB,
  VISION_INTENT_VERB,
  SWAP_MODEL_VERB,
  SWAP_VOICE_VERB,
];

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
      // TTS can start from ANY live conversational state (e.g. a typed message
      // mid-voice-conversation) — the echo guard depends on being in
      // `speaking`, so never let her talk while we sit in listening.
      if (action.type === "TTS_START") return "speaking";
      return state;

    case "transcribing":
      if (action.type === "FINAL_RESULT") return "processing";
      if (action.type === "END") return "idle";
      if (action.type === "TTS_START") return "speaking";
      return state;

    case "processing":
      if (action.type === "TTS_START") return "speaking";
      if (action.type === "END") return "idle";
      // "stop" while she's THINKING cancels the in-flight turn (now that
      // "stop" never ends the conversation) — back to hearing you.
      if (action.type === "BARGE_IN") return "transcribing";
      // A turn can complete with NO audio (error, empty reply, TTS disabled
      // upstream) — treat it as turn-end so the conversation returns to
      // listening instead of sitting in processing forever.
      if (action.type === "TTS_END") return action.strictMode ? "idle" : "listening";
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
