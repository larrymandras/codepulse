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
 *
 * 186-01 follow-up (Defect C, fresh live trace, 186-09 swap testing): Chrome's
 * STT sometimes renders "try on" as one joined word ("Tryon grok" / "Tryon
 * Rock") — plausibly reading it as a proper noun. That defeats
 * SWAP_MODEL_VERB's "try on X" prefix match entirely (no client fast-path
 * dispatch fires, the utterance falls through to a full LLM turn instead).
 * Un-join it here so every matcher benefits — "tryon" is not an otherwise
 * meaningful word/phrase in ANY of this file's grammars, so a blanket
 * word-boundary substitution carries no collision risk. Deliberately narrow:
 * this ONLY repairs the grammar join ("tryon" → "try on"); it must NOT alias
 * mis-heard TARGET names (e.g. "rock" → "grok") — the backend's fuzzy
 * resolver + honest refusal already own that (D-08), and doing it client-side
 * would risk silently "correcting" a genuinely different, valid target name.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\btryon\b/g, "try on");
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
  // 188.1-04 (D-01/D-02) deliberate widening: "hey astrid" (no trailing "r")
  // was missing here entirely. 188.1-RESEARCH.md confirms Chrome's STT
  // actually produces "Astrid", not "Astridr" — its absence was precisely
  // why isPureBargeInPhrase("Hey Astrid.") returned false and the wake
  // phrase leaked past this file into a dispatched chat message three times
  // in one recorded session (2026-08-05 evidence todo). Inserted after the
  // existing "hey astridr" entry rather than reordering any prior entry, so
  // every pre-existing matchedBargePhrase() identity is unchanged.
  "hey astrid",
  "stop",
  "wait",
  "hold on",
  "hang on",
  "wait wait",
  "one sec",
  "pause",
];

// The address/name subset consumed by stripWakePhrase (188.1-04, D-01/D-02).
// Deliberately NOT identical to BARGE_IN_PHRASES's raw string list: normalize()
// strips diacritics (its `[^\w\s']` class is ASCII-only), so "ástríðr" alone
// normalizes to two tokens ("str", "r") — matching it as a stand-alone entry
// after a leading "hey" requires an explicit combined "hey ástríðr" entry,
// since token-count differs from the ASCII "hey astridr"/"hey astrid" forms.
// stripWakePhrase compares against each entry's OWN normalize()'d token list
// (see WAKE_PHRASE_TOKENS below), not the raw string, so this list only needs
// to be human-readable and exhaustive of the address forms — it is not read
// by any other matcher in this file. Order does not matter here; matching
// order is derived by sorting on normalized token count (longest-first).
// 188.3-08 live evidence (2026-08-07 session, 7 leaks in 10 attempts): Chrome's
// STT renders the spoken wake word as "Alfred", "Ashford" and "Astra" at least
// as often as it renders "Astrid". Every one of those leaked the address into
// the dispatched message, and one reached the model as a NAME — she answered
// "It's Friday, August 7th, 2026, Ashford."
//
// Only the "hey <variant>" forms are added, deliberately NOT the bare ones.
// stripWakePhrase is LEADING-only, so a bare "alfred" entry would strip the
// first word of a genuine "Alfred called me yesterday"; "hey alfred" as an
// opener has no plausible non-address reading here. The canonical spellings
// keep their bare forms because they are her actual name.
const WAKE_PHRASES = [
  "hey ástríðr",
  "hey astridr",
  "hey astrid",
  "hey alfred",
  "hey ashford",
  "hey astra",
  "ástríðr",
  "astridr",
  "astrid",
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
  return matchedBargePhrase(text) !== null;
}

/** True if `phrase` (already normalized, space-separated) appears as a
 *  contiguous word-sequence anywhere in `text`. */
export function phraseAppearsIn(text: string, phrase: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  const words = norm.split(" ");
  const phraseWords = phrase.split(" ");
  for (let i = 0; i <= words.length - phraseWords.length; i++) {
    if (phraseWords.every((w, j) => words[i + j] === w)) return true;
  }
  return false;
}

/**
 * Which barge-in phrase `text` contains, or null.
 *
 * Callers need the IDENTITY of the match, not just a boolean: while she is
 * speaking, a heard "stop" is only a real interrupt if HER OWN reply does not
 * also contain "stop". Live 2026-07-30: her story ended "...the sea only keeps
 * those who stop fighting it" — echo of that line would otherwise self-barge
 * on her own word. See useAstridrVoice's speaking branch.
 */
export function matchedBargePhrase(text: string): string | null {
  const norm = normalize(text);
  if (!norm) return null;
  return BARGE_IN_PHRASES.find((phrase) => phraseAppearsIn(norm, phrase)) ?? null;
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

// ─── Wake-phrase strip (188.1-04, D-01/D-02) ─────────────────────────────────
//
// Closes the live defect where the duplex ear transcribed "Hey Astrid." as
// content and dispatched it as a chat message — answered by a full LLM turn
// plus TTS synthesis — three times in one recorded session on 2026-08-05
// (see the evidence todo `.planning/todos/pending/2026-08-05-voice-transcript-
// glue-and-wake-phrase-leak.md`). A fourth occurrence prefixed a real question
// ("Hey Astrid. What's the weather like tomorrow in Cumming, Georgia?"). D-01
// requires stripping a LEADING wake-phrase match before the final reaches the
// send accumulator; D-02 requires the caller to treat a whole-utterance match
// (remainder empty) as a drop-and-refresh-the-follow-up-window case rather
// than a normal dispatch — that refresh behavior lives in useAstridrVoice.ts,
// not here, since this file stays pure/side-effect-free.

/** Same character-for-character substitution normalize() applies (lowercase,
 *  every non-word/non-space/non-apostrophe char replaced by a single space),
 *  but WITHOUT collapsing whitespace runs — so each resulting token's index
 *  still lines up 1:1 with the corresponding position in the original,
 *  un-normalized `text`. This is what lets stripWakePhrase compute a cut
 *  point in the ORIGINAL string from a match found in the normalized one. */
function maskPreservingIndices(text: string): string {
  return text.toLowerCase().replace(/[^\w\s']/g, " ");
}

// Each WAKE_PHRASES entry's own normalize()'d token list, precomputed once
// and sorted longest-first (by normalized token count) so a longer address
// is always tried — and matched — before a shorter one that is its own
// leading prefix (e.g. "hey astridr" before "astridr"). Diacritic forms are
// intentionally normalized here too (not compared as raw strings): normalize()
// strips accents, so comparing against a symmetrically-normalized phrase is
// what lets "Ástríðr" actually match despite the ASCII-only \w class — see
// the WAKE_PHRASES comment above.
const WAKE_PHRASE_TOKENS: { raw: string; tokens: string[] }[] = WAKE_PHRASES.map((phrase) => ({
  raw: phrase,
  tokens: normalize(phrase).split(" ").filter(Boolean),
})).sort((a, b) => b.tokens.length - a.tokens.length);

/**
 * Strips a LEADING wake-phrase address (e.g. "Hey Astrid.", "Hey Ástríðr,")
 * from `text`, if present. Pure — no normalization leaks into the return
 * value: the remainder preserves the ORIGINAL casing and punctuation of
 * everything after the wake phrase, because the remainder is what gets
 * dispatched to Ástríðr as the user's actual message.
 *
 * Returns `{ stripped, matched }` rather than a bare string so the caller
 * can distinguish three outcomes that a bare string return cannot express:
 * no wake phrase found (`matched === null`, `stripped === text`), a wake
 * phrase found with real content after it (`matched` set, `stripped`
 * non-empty), and a wake-phrase-ONLY utterance (`matched` set, `stripped ===
 * ""`) — the D-02 case the caller must drop-and-refresh rather than dispatch.
 *
 * Deliberately LEADING-only (never matches mid-sentence or trailing): a wake
 * name appearing elsewhere in the utterance is content ("What did Astrid say
 * about the roadmap?"), not an address, and stripping it there would corrupt
 * a real question. "stop"/"wait"/"hold on"/etc. are barge-in interrupt
 * phrases, not wake/address phrases, and are deliberately absent from
 * WAKE_PHRASES — stripping them here would silently break the barge-in
 * reflex those phrases exist for.
 */
export function stripWakePhrase(text: string): { stripped: string; matched: string | null } {
  if (!text || !text.trim()) return { stripped: text, matched: null };

  const masked = maskPreservingIndices(text);
  const tokenRe = /\S+/g;
  const spanTokens: { word: string; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(masked)) !== null) {
    spanTokens.push({ word: match[0], end: match.index + match[0].length });
  }
  if (spanTokens.length === 0) return { stripped: text, matched: null };

  for (const { raw, tokens } of WAKE_PHRASE_TOKENS) {
    if (tokens.length === 0 || tokens.length > spanTokens.length) continue;
    const isLeadingMatch = tokens.every((t, j) => spanTokens[j].word === t);
    if (!isLeadingMatch) continue;
    const cutIndex = spanTokens[tokens.length - 1].end;
    // Trim any punctuation/whitespace immediately following the wake phrase
    // (the comma in "Hey Astrid, ...", the period in "Hey Astrid.") so the
    // remainder never starts with orphaned punctuation.
    const remainder = text.slice(cutIndex).replace(/^[\s,.;:!?'"—–-]+/, "");
    return { stripped: remainder, matched: raw };
  }
  return { stripped: text, matched: null };
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
  // 185-08 live finding: natural phrasings that fell through to the LLM.
  // Mirrors the backend _TARGET_PATTERN expansion (swap_model.py).
  "change your brain to ",
  "change brain to ",
  "move yourself over to ",
  "move yourself to ",
];

/**
 * "swap_model" verb — extracts the raw target brain name from "try on X" /
 * "switch your brain to X", or `{ restore: "true" }` for the restore
 * phrasing. Returns null for anything else. Pure — no fetch/resolution.
 */
/** Spoken commands often lead with a politeness word ("please try on grok")
 *  — strip it so the prefix anchor still matches (185-08 live finding). */
function stripLeadingPlease(norm: string): string {
  return norm.startsWith("please ") ? norm.slice("please ".length) : norm;
}

export const SWAP_MODEL_VERB: ClientControlVerb = {
  name: "swap_model",
  match: (text: string): Record<string, string> | null => {
    const norm = stripLeadingPlease(normalize(text));
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
    const norm = stripLeadingPlease(normalize(text));
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
