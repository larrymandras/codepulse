/**
 * useAstridrVoice — the wake-word-armed voice conversation engine for the
 * Ástríðr presence page (/chat).
 *
 * Composes:
 *   - useWakeWord      (openwakeword ONNX engine — "Hey Ástríðr" arms a turn)
 *   - useSpeechRecognition (Web Speech, continuous + interim)
 *   - voiceReducer     (the 6-state conversation machine)
 *   - useAstridrChat   (send / interrupt — the ONE conversation engine)
 *
 * Lifecycle (all gated by `enabled` — the page's mic toggle):
 *   enabled=false → nothing holds the mic. Toggling off aborts the recognizer,
 *     stops the wake engine (releases tracks), and tears the conversation down.
 *   enabled=true  → wake engine armed (state: idle). On wake: conversation
 *     opens (listening) and Web Speech runs continuously — through `speaking`,
 *     so you can interrupt her. The conversation ends (re-arms the wake word)
 *     on an end-phrase ("goodbye", "thanks", "that's all" — NOT "stop", which
 *     only interrupts), the follow-up window expiring, or 30s of YOUR silence.
 *
 * Natural-conversation behaviors (2026-07-20, built from a live trace):
 *   - Recognizer keep-alive: Chrome silently ends its recognizer after ~14s
 *     without speech (the live trace showed it dying while she was thinking,
 *     deafening the whole conversation). An unexpected end during a live
 *     conversation now restarts it — storm-guarded (max 3 restarts/10s,
 *     never after an intentional stop), per the restart-storm lesson.
 *   - Talk-over with content: during `speaking`, recognized speech is
 *     fingerprinted against her own streamed reply text. Her mic echo is
 *     dropped (the echo guard); anything that is NOT her echo interrupts her
 *     AND becomes your message — no "stop" needed.
 *   - Turn-scoped silence clock: the 30s silence timeout only counts YOUR
 *     turn. It pauses when a message sends and resumes when her reply ends
 *     (the trace showed it tearing the conversation down mid-reply).
 *   - Adaptive send: short complete answers ("no", "yes", "the second one")
 *     in a warm conversation send after 800ms, not the full 2s pause.
 *   - Stay-hot on her question: if her reply ends with "?", the follow-up
 *     window is 30s instead of 14s — she asked, she's waiting.
 *   - Silent-turn watchdog: a turn that completes with no audio still closes
 *     properly (back to listening) instead of wedging in `processing`.
 */

import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { useWakeWord, type WakeWordStatus } from "@/hooks/useWakeWord";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useDuplexEars } from "@/hooks/useDuplexEars";
import { reportRealtimeUsage } from "@/lib/astridrApi";
import type { AstridrChat } from "@/hooks/useAstridrChat";
import type { ScreenShareState, CaptureFrameOptions, CapturedFrame } from "@/hooks/useScreenShare";
import {
  voiceReducer,
  isEndPhrase,
  isBargeInPhrase,
  matchedBargePhrase,
  phraseAppearsIn,
  isPureBargeInPhrase,
  stripWakePhrase,
  isStrictModeCommand,
  decideVisionIntent,
  runVisionRefusal,
  SWAP_MODEL_VERB,
  SWAP_VOICE_VERB,
  type VoiceState,
} from "@/components/voice/voiceState";

// ─── Constants ───────────────────────────────────────────────────────────────

/** D-08 (188.3-05): same shape as useAstridrChat.ts's own generateId() — a
 *  per-send client message id so a later continuation-merge can name a
 *  specific prior send as its supersede target (lastSentRef). */
function generateId(): string {
  return crypto.randomUUID();
}

const SILENCE_TIMEOUT_MS = 30_000;
const SEND_DEBOUNCE_MS = 2_000;
/** Adaptive send: a short complete answer in a warm conversation. */
const SHORT_SEND_DEBOUNCE_MS = 800;
const SHORT_ANSWER_MAX_WORDS = 3;
/** One conversational clock: after her reply you have a FULL silence window
 *  to speak — the old separate 14s expiry undercut the 30s silence timeout
 *  and read as "she stopped listening" after short replies. */
const FOLLOW_UP_WINDOW_MS = 30_000;
/** Stay-hot: she ended on a question — she's waiting even longer. */
const QUESTION_FOLLOW_UP_MS = 45_000;
const INTERRUPT_FLASH_MS = 1_500;
/** D-07: her own ElevenLabs reply must not trip the duplex engine's VAD.
 *  Browser AEC on mic capture (useWakeWord.ts:161,167 echoCancellation:
 *  true) is the PRIMARY defense; this is a deliberately light SECONDARY
 *  guard — a bounded window at TTS playback onset during which a duplex
 *  speech-start signal is treated as (probable) echo and ignored. Starting
 *  value; live-tuned against a real spoken test in 188-09 (Claude's
 *  discretion per 188-CONTEXT.md D-07). Reviving 183's fingerprint
 *  machinery or introducing acoustic AEC here is explicitly OUT OF BOUNDS
 *  (locked milestone decision) — isEchoOfReply/stripEchoPrefix below stay
 *  the 183 recognizer's own, separate echo guard. */
// (No duplex echo-suppression constants: the duplex ears no longer trigger
// barge-in at all — see onDuplexSpeechStart for why both the time-window and
// the corroboration approaches failed live on 2026-07-30.)
/** Turn completed but no TTS arrived within this — close the turn silently. */
const SILENT_TURN_GRACE_MS = 3_000;
/** A flush landing while the PREVIOUS send is still being thought about
 *  (in flight, her TTS not yet started) within this window is the same
 *  sentence continuing — merge and resend, don't fire a fragment. */
const CONTINUATION_MERGE_MS = 6_000;
/** After her TTS ends, utterances STARTING inside this window are treated as
 *  potentially echo-glued (her tail + the user's answer in one utterance). */
const ECHO_TAIL_MS = 1_500;
/** Keep-alive storm guard: only RAPID-CYCLE deaths count (recognizer lived
 *  under MIN_HEALTHY_MS). Chrome ends a healthy recognizer every ~10-15 quiet
 *  seconds as a matter of course — those periodic deaths must restart freely,
 *  or a few normal turns burn the cap and the follow-up window goes deaf. */
const RESTART_MAX = 3;
const RESTART_WINDOW_MS = 10_000;
const RESTART_DELAY_MS = 300;
const RECOGNIZER_MIN_HEALTHY_MS = 2_000;
/** Echo-tail anchor expiry: if Chrome abandons the tail utterance without a
 *  final, the anchor must not keep stripping later, unrelated speech. */
const ECHO_ANCHOR_MAX_MS = 5_000;
/**
 * 188.1-04 (D-03): the duration-plausibility gate's floor, in ms. A
 * duplex-sourced final measuring shorter than this is dropped rather than
 * dispatched. Derived in `188.1-CALIBRATION.md` § "Duration Floor
 * Derivation" from the single archived junk sample (241ms, "Kulitnya.") —
 * NOT picked, NOT rounded here. That derivation is explicitly marked
 * PROVISIONAL: the corpus held one duration sample and zero real-utterance
 * samples, so the floor is biased far below the one known junk value (÷5
 * margin) rather than anchored to a measured "shortest real utterance" —
 * RE-DERIVED 2026-08-06 from the 188.1-07 live-mic session (D-15). The prior
 * value (50ms) was PROVISIONAL: derived from a corpus holding ONE junk sample
 * and ZERO real-utterance samples, it never fired once across a 388-second live
 * session and let two junk bursts through to a full LLM turn plus TTS.
 *
 * The session supplied the missing samples. Six real utterances measured
 * 1763 / 2207 / 2847 / 2905 / 3041 / 3764 ms; two junk bursts measured 258ms
 * ("部屋" — a hallucinated Japanese noun, dispatched and answered) and 489ms
 * ("Huh."). Shortest real 1763ms vs longest junk 489ms is a clean, uncontested
 * gap, so D-03's two constraints do not conflict here.
 *
 * A first pass took 1763 ÷ 2 = 880ms. That value is REJECTED and recorded here
 * so it is not re-proposed: it turned CTRL-SHORT red, and under D-16 a fix that
 * greens every fixture while reddening a control is a FAILED fix. The flaw is a
 * SAMPLING ARTIFACT — "shortest real = 1763ms" only means no one-word reply was
 * spoken during a timed window this session. A genuine "Yes."/"Okay." in an open
 * follow-up window is plausibly 300-600ms, and an 880ms floor would silently eat
 * every one of them. CONV-03 deliberately accepts short replies when warm, so
 * that would be a real conversational regression traded for a marginal noise win.
 *
 * INTERIM VALUE, 320ms: strictly above the one UNAMBIGUOUS junk sample (258ms,
 * "部屋" — hallucinated, not a degraded rendering of anything spoken) and below
 * any plausible real utterance. The 489ms "Huh." is deliberately NOT treated as
 * junk: it is ambiguous (the user may simply have said it), and per D-03 an
 * ambiguous sample resolves toward sending. It therefore remains an accepted,
 * documented pass-through, exactly as the 241ms case was before it.
 *
 * CONFIRMED DERIVED (no longer merely conservative), second live session
 * 2026-08-06 19:34: the missing one-word-affirmation sample was captured —
 * "Thanks." measured durationMs:645, the shortest REAL utterance on record.
 * 645 ÷ 2 = 322 → 320, so this value now satisfies D-03's "strictly below the
 * shortest observed real utterance, with stated headroom" rule on its own terms
 * rather than by caution. It also retires the rejected 880ms candidate for good:
 * 880 would have dropped "Thanks." outright, exactly the over-block CTRL-SHORT
 * predicted.
 *
 * Full corpus after three sessions —
 *   real: 645 / 1002 / 1627 / 1949 / 1763 / 2207 / 2563 / 2847 / 2905 / 3041 / 3764 ms
 *   junk: 258 ms ("部屋") · 303 ms ("Claro.") — both unambiguous hallucinations
 *         489 ms ("Huh.") — ambiguous, treated as real per D-03
 * The floor brackets cleanly: 258 / 303 junk BELOW it, 645 shortest real 2.0x
 * ABOVE it. The 489ms case is uncatchable without risking real short words and
 * is an accepted, documented gap.
 *
 * "Claro." is also the defense-in-depth datum: it was an echo of her own TTS
 * caught by final.ignored-while-speaking first, but at 303ms this floor would
 * have caught it independently had she been idle.
 *
 * Raising this is NOT free — see the salvage exemption at the gate site, and
 * treat a red CTRL-SHORT or CTRL-SALVAGE as a veto, not a test to fix.
 */
const DURATION_FLOOR_MS = 320;

// ─── Live-repro instrumentation ──────────────────────────────────────────────
// Ring buffer + console lines; the Chat page shows a COPY TRACE chip while
// VOICE_DEBUG is on. Every voice-timing fix in this engine came from one of
// these traces (2026-07-20 sessions) — when a new symptom appears, flip this
// on, reproduce ONCE, and fix from the trace. Never reason blind.
//
// 186-01 (D-16): `useWakeWord.ts` also pushes into the SAME
// `window.__astridrVoiceTrace` ring buffer (its own `wake.*`-prefixed events,
// gated by a `debug` option passed from this one flag below) — it has no
// import path back to this file, so it can't read VOICE_DEBUG directly. The
// COPY TRACE chip in Chat.tsx reads the shared global buffer, so no widening
// was needed there; flipping this single flag lights up both files' traces.
// `useSpeechRecognition.ts` gained a real `onstart` callback (previously
// unobservable — only whether we CALLED start(), not whether the browser's
// recognizer actually began) so "recognizer.start" traces below reflect
// ground truth, not merely an attempt.

const VOICE_DEBUG = true;
/** Chat page shows a COPY TRACE chip while instrumentation is on. */
export const VOICE_DEBUG_ENABLED = VOICE_DEBUG;

declare global {
  interface Window {
    __astridrVoiceTrace?: Array<{ t: string; ev: string; d?: unknown }>;
  }
}

function trace(ev: string, d?: unknown) {
  if (!VOICE_DEBUG || typeof window === "undefined") return;
  const entry = { t: new Date().toISOString().slice(11, 23), ev, d };
  // eslint-disable-next-line no-console
  console.log(`[voice] ${entry.t} ${ev}`, d ?? "");
  const buf = (window.__astridrVoiceTrace ??= []);
  buf.push(entry);
  if (buf.length > 500) buf.shift();
}

// ─── Vision capture instrumentation (D-13, mirrors VOICE_DEBUG) ─────────────

const VISION_DEBUG = false;
export const VISION_DEBUG_ENABLED = VISION_DEBUG;

function visionTrace(ev: string, d?: unknown) {
  if (!VISION_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(`[vision] ${ev}`, d ?? "");
}

// ─── System-line TTS (D-03 refusal / D-11 lost-screen) ──────────────────────
// These are CLIENT-ONLY synthesized lines — no LLM turn, no server audio_url
// — spoken via the browser's native SpeechSynthesis API (same Web Speech
// family as useSpeechRecognition). Never throws; a synthesis failure still
// leaves the durable transcript entry (appendLocalAssistantMessage) as the
// text counterpart, per the text+audio-never-voice-only constraint.
export function speakSystemLine(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch (err) {
    visionTrace("speak.failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

// ─── Echo fingerprint (talk-over-with-content) ───────────────────────────────

function fingerprintWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Lowercase alphanumerics only — spaces/punctuation removed, so STT spelling
 *  variants ("all right") line up against her text ("Alright,"). */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Min edit distance for `needle` to appear ANYWHERE inside `hay`
 *  (approximate-substring DP — free start, free end). Small inputs only. */
function approxSubstringDistance(needle: string, hay: string): number {
  const m = needle.length;
  const n = hay.length;
  if (!m) return 0;
  if (!n) return m;
  let prev: number[] = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = new Array<number>(n + 1);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (needle[i - 1] === hay[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return Math.min(...prev);
}

/**
 * True if what the mic heard is (probably) Ástríðr's own TTS leaking back in.
 * Two signals against her streamed reply text:
 *   1. Fuzzy squashed-substring (edit distance ≤20%) — catches STT variants;
 *      the live false-barge was "all right" vs her "Alright," slipping past
 *      word-level matching and cutting off her closing line.
 *   2. Word-set overlap ≥75% — catches longer, reordered echoes.
 * Utterances under 2 words are treated as echo (too little signal — explicit
 * barge-in phrases already cover short interrupts).
 */
export function isEchoOfReply(heard: string, reply: string): boolean {
  const heardWords = fingerprintWords(heard);
  if (heardWords.length < 2) return true;
  const needle = squash(heard);
  // Too little signal to overrule the guard: tiny STT shards of her own
  // sentence ("s in" from "entries in…") must never read as the user
  // (live false-barge cut her off mid-answer).
  if (needle.length < 6) return true;
  if (!reply) return false;

  const dist = approxSubstringDistance(needle, squash(reply));
  if (dist <= Math.max(1, Math.floor(needle.length * 0.2))) return true;

  const replySet = new Set(fingerprintWords(reply));
  const hits = heardWords.filter((w) => replySet.has(w)).length;
  return hits / heardWords.length >= 0.75;
}

/**
 * Residual echo check for the post-TTS tail: a SHORT remainder (≤3 words)
 * whose every word appears in her reply is her voice, not the user's — the
 * prefix-stripper can't act on one-word utterances (live defect: a bare
 * " email" leaked from her own sentence and was sent as a message). Longer
 * remainders are trusted (stripEchoPrefix already handled the echo part).
 */
export function isResidualEcho(remainder: string, reply: string): boolean {
  const words = fingerprintWords(remainder);
  if (words.length === 0) return true;
  if (words.length > 3 || !reply) return false;
  const replySet = new Set(fingerprintWords(reply));
  return words.every((w) => replySet.has(w));
}

/**
 * Echo-tail repair: Chrome glues her trailing TTS and the user's answer into
 * ONE utterance when the user replies as she finishes (live trace: "you're
 * welcome is there anything else I can assist you with no I'm good thank
 * you"). Strip the longest leading run that fuzzy-matches her reply, backing
 * off any boundary words that aren't hers — the user's "no" glued right after
 * her echoed question must survive. Returns "" when the whole thing is echo.
 */
export function stripEchoPrefix(heard: string, reply: string): string {
  const words = heard.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || !reply) return heard.trim();
  const hay = squash(reply);
  const replyWords = new Set(fingerprintWords(reply));

  let k = 0;
  for (let i = words.length; i >= 2; i--) {
    const prefix = squash(words.slice(0, i).join(" "));
    if (prefix.length < 6) break;
    const dist = approxSubstringDistance(prefix, hay);
    if (dist <= Math.max(1, Math.floor(prefix.length * 0.15))) {
      k = i;
      break;
    }
  }
  // Boundary backoff: never strip trailing words that aren't in her reply.
  while (k > 0) {
    const w = words[k - 1].toLowerCase().replace(/[^\w']/g, "");
    if (replyWords.has(w)) break;
    k--;
  }
  return words.slice(k).join(" ");
}

// ─── Overlap-aware append (188.1-06, D-06/D-07/D-08) ─────────────────────────

/** MIN_OVERLAP_WORDS / MIN_OVERLAP_CHARS — the Trim floor. Below this, a
 *  measured tail-of-existing/head-of-incoming overlap is NOT trimmed: a
 *  1-word shared filler ("is"/"to"/"on") recurs at ordinary utterance
 *  boundaries and must never be eaten. Derived in `188.1-CALIBRATION.md`
 *  § Overlap Floor Derivation from the two genuine trim-overlap cases in the
 *  evidence corpus (`GLUE-B` / `GLUE-COMPOUND-inner`, both 18 squashed chars;
 *  `GLUE-COMPOUND-inner` is the smallest at 2 words) — do not change without
 *  re-deriving there. `MIN_OVERLAP_WORDS` is the primary implementation
 *  unit; `MIN_OVERLAP_CHARS` is a secondary corroborating guard (the
 *  calibration doc notes it as too small a sample to trust alone). */
const MIN_OVERLAP_WORDS = 2;
const MIN_OVERLAP_CHARS = 18;

/** MIN_SUBSUME_SURPLUS_WORDS / _CHARS — the Subsume floor. A containment
 *  (one squashed side fully inside the other) collapses to the longer side
 *  ONLY when the containing side exceeds the contained side by at least
 *  this much. Below it — including surplus 0, an exact/near-equal repeat —
 *  both sides are the SAME utterance arriving twice and must be preserved
 *  verbatim (`CTRL-REPEAT`). Derived in `188.1-CALIBRATION.md` §
 *  "Derivation (subsume surplus)" from `GLUE-A`'s measured surplus
 *  ("today", 1 word / 5 chars) — the smallest real surplus in the corpus,
 *  already > 0. Do not change without re-deriving there. */
const MIN_SUBSUME_SURPLUS_WORDS = 1;
const MIN_SUBSUME_SURPLUS_CHARS = 1;

/** Bounds on the Trim branch's search space, protecting `approxSubstringDistance`
 *  ("small inputs only" per its own comment, O(m·n) on squashed characters):
 *  only the last `TRIM_TAIL_WINDOW_WORDS` words of `existing` are searched
 *  for a matching tail (so a long accumulated transcript cannot make every
 *  final quadratic), the matched span may sit at most
 *  `TRIM_MAX_TRAILING_SLACK_WORDS` words short of `existing`'s true end (the
 *  `GLUE-COMPOUND-inner` case has exactly 1 trailing word, "for", after its
 *  match), and the incoming-side candidate is capped at
 *  `TRIM_MAX_HEAD_WORDS` words. */
const TRIM_TAIL_WINDOW_WORDS = 20;
const TRIM_MAX_TRAILING_SLACK_WORDS = 5;
const TRIM_MAX_HEAD_WORDS = 15;

function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Standard (fully anchored) edit distance — unlike `approxSubstringDistance`,
 *  there is no free start/end here: both strings are compared in their
 *  entirety. The Trim search below uses this (not `approxSubstringDistance`)
 *  to test whether a candidate span is approximately the SAME text as
 *  another, not merely contained somewhere within a larger one —
 *  `approxSubstringDistance`'s free-end semantics would otherwise let a
 *  genuinely SHORTER real overlap that happens to be a prefix of a larger,
 *  spurious candidate match at distance 0 for the wrong (too-long) `k`.
 *  Small inputs only, same bound as `approxSubstringDistance`. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = new Array<number>(n + 1);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

export interface AppendWithOverlapCheckResult {
  text: string;
  decision: "subsumed" | "repeat-preserved" | "trimmed" | "joined";
}

/**
 * One shared overlap-aware append helper (D-06) — every concatenation site
 * that joins an already-accepted piece of transcript with a newly-arrived
 * one (the accumulator, the continuation merge, the rejoin) calls THIS
 * instead of a raw template-literal join, so a later concatenation can
 * never re-glue what an earlier one already fixed.
 *
 * D-07: subsume-or-trim.
 *   1. Subsume — if one squashed side fully contains the other AND the
 *      surplus (how much longer the containing side is) clears
 *      `MIN_SUBSUME_SURPLUS_WORDS`, the longer ORIGINAL string (not the
 *      squashed form — this is what gets dispatched to Ástríðr) is returned
 *      verbatim, decision `"subsumed"`. This is the fix for the compounding
 *      case, where an incoming rejoin product already contained the
 *      accumulated clause.
 *   2. Below the surplus floor — including surplus 0, an equal-string
 *      repeat — the two pieces are the SAME utterance arriving twice, not
 *      one re-covering the other: a plain join is returned, decision
 *      `"repeat-preserved"`, and the function returns IMMEDIATELY. This
 *      guard is terminal by design (D-08): falling through to Trim would
 *      hand it an overlap spanning the entire string, and Trim would eat
 *      the repeat from the other side just the same.
 *   3. Trim — if neither side contains the other, search for the longest
 *      tail-of-`existing`/head-of-`incoming` fuzzy match clearing
 *      `MIN_OVERLAP_WORDS`/`MIN_OVERLAP_CHARS`. On a match, splice: keep
 *      `existing`'s non-overlapping prefix, `incoming`'s wording of the
 *      overlap (finals are generally the more reliable capture), then
 *      whatever trails the match on EITHER side — `existing`'s own leftover
 *      continuation first, then `incoming`'s. The overlapping span survives
 *      exactly once. Decision `"trimmed"`.
 *   4. Otherwise, today's behavior: a plain single-space join, decision
 *      `"joined"`.
 *
 * D-08: both floors gate their own branch, and neither is skippable — a
 * genuine short emphatic repeat must join verbatim with its repetition
 * intact whichever branch it would otherwise have reached.
 */
export function appendWithOverlapCheck(
  existing: string,
  incoming: string
): AppendWithOverlapCheckResult {
  const existingTrimmed = existing.trim();
  const incomingTrimmed = incoming.trim();
  if (!existingTrimmed) return { text: incomingTrimmed, decision: "joined" };
  if (!incomingTrimmed) return { text: existingTrimmed, decision: "joined" };

  const squashedExisting = squash(existingTrimmed);
  const squashedIncoming = squash(incomingTrimmed);

  // 1/2. Subsume — gated on surplus, terminal either way.
  if (
    squashedExisting.includes(squashedIncoming) ||
    squashedIncoming.includes(squashedExisting)
  ) {
    const existingIsLonger = squashedExisting.length >= squashedIncoming.length;
    const containingOriginal = existingIsLonger ? existingTrimmed : incomingTrimmed;
    const containedOriginal = existingIsLonger ? incomingTrimmed : existingTrimmed;
    const surplusWords = wordsOf(containingOriginal).length - wordsOf(containedOriginal).length;
    if (surplusWords >= MIN_SUBSUME_SURPLUS_WORDS) {
      return { text: containingOriginal, decision: "subsumed" };
    }
    return {
      text: `${existingTrimmed} ${incomingTrimmed}`.trim(),
      decision: "repeat-preserved",
    };
  }

  // 3. Trim — longest fuzzy tail-of-existing/head-of-incoming overlap.
  const existingWords = wordsOf(existingTrimmed);
  const incomingWords = wordsOf(incomingTrimmed);
  const maxK = Math.min(incomingWords.length, TRIM_MAX_HEAD_WORDS);
  const tailWindowStart = Math.max(0, existingWords.length - TRIM_TAIL_WINDOW_WORDS);

  let best: { s: number; L: number; k: number } | null = null;

  // MIN_OVERLAP_CHARS is deliberately NOT a hard gate here (per
  // 188.1-CALIBRATION.md: "MIN_OVERLAP_WORDS is the primary implementation
  // unit; the char-based number should not be trusted to generalize the way
  // the word-based one is reasoned to") — MIN_OVERLAP_WORDS alone (the k/L
  // lower bounds below) already guarantees a lone shared filler word can
  // never qualify. The tolerance below is intentionally tight (capped at 3
  // squashed chars) so approximate matching absorbs STT spelling variance
  // (an extra/missing character) without also absorbing an entire extra
  // WORD — every genuine overlap in the evidence corpus is an exact
  // squashed match (distance 0) once k/L are correctly aligned.
  for (let k = maxK; k >= MIN_OVERLAP_WORDS; k--) {
    const incomingHeadSquashed = squash(incomingWords.slice(0, k).join(" "));

    let localBest: {
      s: number;
      L: number;
      matchedChars: number;
      slack: number;
      dist: number;
    } | null = null;
    for (let L = Math.max(1, k - 1); L <= k + 1; L++) {
      if (L < MIN_OVERLAP_WORDS || L > existingWords.length) continue;
      for (let s = tailWindowStart; s <= existingWords.length - L; s++) {
        const slack = existingWords.length - (s + L);
        if (slack > TRIM_MAX_TRAILING_SLACK_WORDS) continue;
        const candidateSquashed = squash(existingWords.slice(s, s + L).join(" "));
        const tol = Math.min(
          3,
          Math.max(1, Math.ceil(Math.max(candidateSquashed.length, incomingHeadSquashed.length) * 0.1))
        );
        const dist = editDistance(candidateSquashed, incomingHeadSquashed);
        if (dist > tol) continue;
        if (
          !localBest ||
          dist < localBest.dist ||
          (dist === localBest.dist && slack < localBest.slack) ||
          (dist === localBest.dist &&
            slack === localBest.slack &&
            candidateSquashed.length > localBest.matchedChars)
        ) {
          localBest = { s, L, matchedChars: candidateSquashed.length, slack, dist };
        }
      }
    }
    if (localBest) {
      best = { s: localBest.s, L: localBest.L, k };
      break; // k descends from the max — the first hit is the longest incoming-side overlap.
    }
  }

  if (best) {
    const existingPrefix = existingWords.slice(0, best.s).join(" ");
    const existingSuffix = existingWords.slice(best.s + best.L).join(" ");
    const incomingOverlap = incomingWords.slice(0, best.k).join(" ");
    const incomingSuffix = incomingWords.slice(best.k).join(" ");
    const text = [existingPrefix, incomingOverlap, existingSuffix, incomingSuffix]
      .filter((part) => part.length > 0)
      .join(" ");
    return { text, decision: "trimmed" };
  }

  // 4. Plain join fallback — today's behavior.
  return { text: `${existingTrimmed} ${incomingTrimmed}`.trim(), decision: "joined" };
}

// ─── Noise/banter gate (CONV-03, D-07/D-08/D-09/D-10) ────────────────────────

function shouldReject(
  text: string,
  isFollowUpWindowOpen: boolean,
  confidence?: number
): boolean {
  // D-08: barge-in phrases always bypass the gate, in any state.
  if (isBargeInPhrase(text)) return false;

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minWords = isFollowUpWindowOpen ? 1 : 3; // D-07
  if (wordCount < minWords) return true;

  // D-09: confidence is a lenient tiebreaker only — near-zero floor, never a
  // hard reject of real speech (Chrome's confidence is bimodal).
  if (confidence !== undefined && confidence > 0 && confidence < 0.01) return true;

  return false;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseAstridrVoiceOptions {
  /** The page's mic toggle. false = nothing may hold the mic. */
  enabled: boolean;
  /** Strict Mode (CONV-02): TTS end goes straight to idle, no follow-up window. */
  strictMode?: boolean;
  /** Spoken "strict mode on/off" command recognized (D-05). */
  onStrictModeChange?: (v: boolean) => void;
  /** The page's chat engine instance — sends and interrupts go through it. */
  chat: AstridrChat;
  /** The page's SOLE `useScreenShare` instance (D-09) — the vision fast-path
   *  reads its live state and captures fresh frames through it. Optional for
   *  backward compatibility with callers/tests that predate VISION-01 — the
   *  vision fast-path simply never matches "active" without it. */
  screenShare?: {
    state: ScreenShareState;
    arm: () => void;
    captureFrame: (options?: CaptureFrameOptions) => Promise<CapturedFrame>;
  };
}

const NOOP_SCREEN_SHARE: NonNullable<UseAstridrVoiceOptions["screenShare"]> = {
  state: "idle",
  arm: () => {},
  captureFrame: async () => {
    throw new Error("screenShare not configured on useAstridrVoice");
  },
};

export interface UseAstridrVoiceReturn {
  voiceState: VoiceState;
  /** Live (unfinalized) speech. */
  interimText: string;
  /** Accumulated finalized utterance awaiting the pause-to-send debounce. */
  finalText: string;
  /** CONV-02: the follow-up window is open. */
  followUpOpen: boolean;
  /** Duration of the currently-open follow-up window (stay-hot aware). */
  followUpMs: number;
  /** CONV-01: "— interrupted —" flash (~1.5s after a barge-in). */
  showInterruptFlash: boolean;
  /** A conversation is live (wake word already spoken). */
  conversationActive: boolean;
  wakeWordStatus: WakeWordStatus;
  wakeWordError: string | null;
  speechAvailable: boolean;
  /** D-04: a vision-triggered capture+routing is in flight — state badge
   *  shows "Looking…" instead of "Thinking…"/"Processing…". */
  isLooking: boolean;
  /** 188-13 (D-18 Quick Commands "Stop"): exposes the SAME barge-in cut
   *  both the 183 recognizer's phrase match and the duplex engine's
   *  speech-start signal already dispatch through — no second interrupt
   *  mechanism (188-UI-SPEC.md Part 3 §1). */
  triggerBargeIn: () => void;
  /** 188.1-04 (D-04): session-scoped count of finals the plausibility gate
   *  dropped (wake-phrase-only utterances + sub-floor-duration bursts) —
   *  disclosed quietly in VoiceStatusPanel, never in the chat transcript.
   *  Resets on mount; no persistence. */
  filteredCount: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAstridrVoice({
  enabled,
  strictMode = false,
  onStrictModeChange = () => {},
  chat,
  screenShare = NOOP_SCREEN_SHARE,
}: UseAstridrVoiceOptions): UseAstridrVoiceReturn {
  const [voiceState, dispatch] = useReducer(voiceReducer, "idle");

  // Latest chat/state/strictMode inside stable callbacks & timers.
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const voiceStateRef = useRef<VoiceState>(voiceState);
  voiceStateRef.current = voiceState;
  const strictModeRef = useRef(strictMode);
  strictModeRef.current = strictMode;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const screenShareRef = useRef(screenShare);
  screenShareRef.current = screenShare;
  // VISION-01: hand the live screenShare instance to chat's vision.frame_request
  // round-trip (useAstridrChat.ts). Chat.tsx creates `chat` before its SOLE
  // `useScreenShare()` instance, so this is the post-mount wiring point —
  // both are already in scope here. registerScreenShare only mutates a ref
  // (mirrors the plain assignment above), so calling it during render — every
  // render, keeping it current — is safe; optional-chained for callers/tests
  // that predate VISION-01 (see NOOP_SCREEN_SHARE precedent below).
  chat.registerScreenShare?.(screenShare);

  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [showInterruptFlash, setShowInterruptFlash] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpMs, setFollowUpMs] = useState(FOLLOW_UP_WINDOW_MS);
  // 188.1-04 (D-04): session-scoped filtered-drop count. State, not a ref —
  // VoiceStatusPanel must actually re-render when it changes (188.1-UI-SPEC.md
  // Part 5).
  const [filteredCount, setFilteredCount] = useState(0);
  // D-04: "Looking…" — set the instant a vision-triggered capture starts,
  // cleared the moment the model's answer begins streaming or TTS_START
  // fires, whichever comes first (184-UI-SPEC.md).
  const [isLooking, setIsLooking] = useState(false);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pause-to-send accumulator (final segments joined until true silence).
  const accumulatedRef = useRef("");

  // D-11/D-12: the partial reply a barge-in interrupted — rides into the NEXT
  // chat.send as interrupted_reply, then clears.
  const interruptedReplyRef = useRef("");

  // Conversational warm gate (CONV-03): once she replied or you barged in,
  // short follow-ups ("continue", "yes") are accepted. Ref, not state — an
  // interim-triggered re-render must not wipe it (the "she freezes when I say
  // continue" bug).
  const conversationWarmRef = useRef(false);

  // Barge-in latches (see VoiceModePanel history): fire once per speaking turn;
  // swallow the trailing FINAL of the barge-in utterance so "stop" doesn't
  // fall through to the end-phrase check.
  const bargeInFiredRef = useRef(false);
  const bargeInSwallowFinalRef = useRef(false);

  // Wake idempotency: the wake worker can deliver detections back-to-back in
  // one tick (the live trace showed a double "conversation open" racing two
  // recognizer starts). Synchronous latch; cleared on teardown.
  const conversationOpenRef = useRef(false);

  // Echo bookkeeping. echoReplyRef snapshots her reply text for fingerprinting
  // — chat.interrupt() clears the live streamingReplyRef, so barge-in/tail
  // checks need their own copy. echoTailUntilRef marks the post-TTS window in
  // which a starting utterance may be echo-glued; utteranceEchoAnchoredRef
  // latches that per-utterance so the (possibly much later) final still gets
  // its echo prefix stripped.
  const echoReplyRef = useRef("");
  const echoTailUntilRef = useRef(0);
  const utteranceEchoAnchoredRef = useRef(false);
  const echoAnchorDeadlineRef = useRef(0);

  const isEchoAnchored = () =>
    utteranceEchoAnchoredRef.current && Date.now() < echoAnchorDeadlineRef.current;

  const currentReply = () =>
    chatRef.current.streamingReplyRef.current || echoReplyRef.current;

  // ─── Duplex ears bookkeeping (Phase 188, D-07/D-08/T-188-32) ─────────────
  // activeEarsRef: which ear source is currently driving the conversation.
  // A ref, never state — nothing renders from it (D-08/T-188-32: the only
  // disclosure is the debug-gated trace buffer, never a UI label). READ by
  // the recognizer's onFinalResult to suppress duplicate dispatch; it was
  // previously written and never read, which is how both ears' transcripts
  // ended up concatenated into one message (live 2026-07-30 16:15).
  const activeEarsRef = useRef<"duplex" | "recognizer">("recognizer");

  // Keep-alive bookkeeping: intentional stops must NOT trigger a restart, and
  // rapid-cycle restarts are rate-limited (storm guard). Lifetime tracking
  // distinguishes a storm (start→die in <2s) from Chrome's routine periodic
  // recognizer deaths, which must restart freely.
  const intentionalStopRef = useRef(false);
  const restartTimesRef = useRef<number[]>([]);
  const recognizerStartedAtRef = useRef(0);

  // Graceful close: the user said an end-phrase ("thanks", "goodbye") — it was
  // SENT so she can close warmly; the conversation re-arms after her reply
  // finishes. A silently discarded "thanks" read as "she did nothing".
  const closePendingRef = useRef(false);

  // Death-without-final salvage: Chrome sometimes abandons an utterance and
  // never finalizes it (live trace: "do I have any entries on…" vanished).
  // Track the longest user interim since the last final; if the recognizer
  // dies mid-transcription, synthesize a final from it so the user's speech
  // is never simply lost.
  const longestInterimRef = useRef("");
  // 186-01 follow-up (fresh live trace, 186-09 swap testing, Defect B):
  // whether the CURRENTLY-tracked longestInterimRef value was captured while
  // voiceStateRef.current === "speaking" (i.e. it's whatever the talk-over/
  // echo classifier decided about audio heard DURING her TTS — inherently
  // the least trustworthy source, since that's exactly the fuzzy boundary
  // where echo-vs-real-speech can be misclassified, as Defect A's live trace
  // proved). A speaking-era interim can persist as "longest" across an
  // entire silent gap and later poison a completely unrelated NEW utterance
  // via the lost-interim rejoin below — it must never be used as a rejoin
  // source, regardless of how it compares by length/distance to the new
  // final. Reset alongside every longestInterimRef reset.
  //
  // Set at the echo-drop site in handleInterimResult's `speaking` branch
  // (D-07 FINAL, 2026-07-30). It moved there when free-form talk-over during
  // speech was removed: dropping an interim does not end Chrome's utterance,
  // so the SAME utterance keeps growing and its later interims land while
  // voiceState is already "transcribing", where they are recorded normally.
  // Without the flag, that second copy of her own echo looks like clean user
  // speech and can rejoin a later, unrelated final.
  const longestInterimFromSpeakingRef = useRef(false);

  // Continuation merge: the last voice message sent + when. A mid-sentence
  // pause slightly over the debounce chops the sentence — the fragment then
  // cancelled the real question's in-flight answer (live trace: "…this
  // afternoon" / "for my personal"). `id` (D-08, 188.3-05) is the client
  // message id that send carried — the supersede target for a LATER
  // continuation merge, so the merge patches that exact bubble in place
  // instead of appending a second one.
  const lastSentRef = useRef<{ text: string; at: number; id: string }>({ text: "", at: 0, id: "" });

  // ─── Timer helpers ─────────────────────────────────────────────────────────

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearSendTimer = useCallback(() => {
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
  }, []);

  const clearFollowUpWindow = useCallback(() => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
    setFollowUpOpen(false);
  }, []);

  const clearSilentTurnTimer = useCallback(() => {
    if (silentTurnTimerRef.current) {
      clearTimeout(silentTurnTimerRef.current);
      silentTurnTimerRef.current = null;
    }
  }, []);

  // ─── Recognition (declared before teardown/handlers that reference it) ─────

  const handleInterimResultRef = useRef<(text: string) => void>(() => {});
  const handleFinalResultRef = useRef<
    (text: string, confidence?: number, durationMs?: number) => void
  >(() => {});

  // Duplex ears start/stop, ref-indirected for the same reason as the two
  // refs above: useDuplexEars is composed further down (after handleBargeIn/
  // handleFinalResultRef, per its own call-site requirements), but
  // teardownConversation/onWake are declared earlier and need a stable
  // reference to call through — a plain const would be a TDZ hazard in a
  // useCallback dependency array declared before that const exists.
  const duplexStartRef = useRef<() => void>(() => {});
  const duplexStopRef = useRef<() => void>(() => {});

  // 186-01 (D-16): which caller requested the CURRENT recognitionStart() —
  // "wake" (fresh conversation) vs "keepalive-restart" (Chrome's routine
  // recognizer death during a live conversation). Set immediately before each
  // recognitionStart() call below; read (and cleared) in onStart so the trace
  // shows whether a requested restart actually reached the browser's real
  // onstart event, not just that we called start().
  const recognizerStartTriggerRef = useRef<string>("unknown");

  const {
    start: recognitionStart,
    stop: recognitionStop,
    abort: recognitionAbort,
    speechAvailable,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    // D-08/T-188-32: when the duplex ears are driving, THEY are the source of
    // truth for finals. activeEarsRef was previously assigned but never read
    // anywhere — so both ears dispatched, and handleFinalResult's accumulator
    // (`accumulated + text`) GLUED the two transcripts together. Live trace
    // 2026-07-30 16:15: recognizer final "what did we work on today" +
    // duplex final "What did we work on today?" were sent as the single
    // message "what did we work on today What did we work on today?".
    // Interims are deliberately still processed while duplex drives — they
    // are what carries echo detection AND barge-in now that the duplex ears
    // no longer barge (see onDuplexSpeechStart). Only the duplicate FINAL
    // dispatch is suppressed here.
    onFinalResult: (t, c) => {
      if (activeEarsRef.current === "duplex") {
        trace("final.duplicate-ear-dropped", { source: "recognizer" });
        return;
      }
      handleFinalResultRef.current(t, c);
    },
    onInterimResult: (t) => handleInterimResultRef.current(t),
    onStart: () => {
      trace("recognizer.start", {
        trigger: recognizerStartTriggerRef.current,
        state: voiceStateRef.current,
      });
      recognizerStartTriggerRef.current = "unknown";
    },
    onEnd: () => {
      const lifetimeMs = Date.now() - recognizerStartedAtRef.current;
      trace("recognizer.end", { state: voiceStateRef.current, lifetimeMs });
      // Keep-alive: Chrome ends its recognizer after ~10-15s without speech —
      // during a live conversation that deafens barge-in and follow-ups (the
      // live-trace bug: it died while she was thinking). Restart, but ONLY:
      //   - when the end was not one we asked for (intentionalStopRef),
      //   - while a conversation is live and the mic toggle is on,
      //   - and, for RAPID-CYCLE deaths only (<2s lifetime), within the storm
      //     guard. Routine periodic deaths restart freely — counting them
      //     burned the cap after a few turns and left the follow-up window
      //     deaf ("she doesn't catch my voice during the countdown").
      if (intentionalStopRef.current) {
        intentionalStopRef.current = false;
        return;
      }
      const active =
        voiceStateRef.current !== "idle" && voiceStateRef.current !== "error-disabled";
      if (!active || !enabledRef.current) return;

      // Salvage an abandoned utterance BEFORE restarting: mid-transcription
      // death with a substantive interim → synthesize the final ourselves.
      // 186-01 (D-16) live trace: a SHORT-but-meaningful interim ("goodbye")
      // died here with the ≥3-word floor unmet — never salvaged, never
      // finalized. The state machine then sat stuck in "transcribing"
      // indefinitely (that state only exits on FINAL_RESULT/END/TTS_START),
      // which (a) silently swallowed the end-phrase and (b) made the NEXT
      // real wake-word detection look "dead" — onWake ignores any wake while
      // state !== "idle" (wake.ignored), so the trace showed a genuine "hey
      // Astridr" transcribed as ordinary conversation content instead of
      // re-arming. An end-phrase is meaningful regardless of word count, so
      // it salvages even at 1 word — this does NOT lower the general noise
      // floor for arbitrary short fragments (those still fail the ≥3-word
      // check and fall through to the keep-alive restart untouched).
      const salvage = longestInterimRef.current.trim();
      const salvageWordCount = salvage.split(/\s+/).filter(Boolean).length;
      // 186-01 follow-up (Defect B principle applied here too — same
      // underlying data source, same integrity risk): never synthesize a
      // final from a speaking-era (echo/talk-over classified) interim.
      const salvageFromSpeaking = longestInterimFromSpeakingRef.current;
      if (
        voiceStateRef.current === "transcribing" &&
        salvage &&
        !salvageFromSpeaking &&
        (salvageWordCount >= 3 || isEndPhrase(salvage))
      ) {
        trace("final.synthesized-from-interim", { text: salvage, wordCount: salvageWordCount });
        longestInterimRef.current = "";
        longestInterimFromSpeakingRef.current = false;
        handleFinalResultRef.current(salvage, undefined);
      } else if (salvage && salvageFromSpeaking) {
        trace("final.synthesize-skipped-speaking-era", { text: salvage });
      }

      if (lifetimeMs < RECOGNIZER_MIN_HEALTHY_MS) {
        const now = Date.now();
        restartTimesRef.current = restartTimesRef.current.filter(
          (t) => now - t < RESTART_WINDOW_MS
        );
        if (restartTimesRef.current.length >= RESTART_MAX) {
          trace("recognizer.restart-suppressed", { reason: "storm-guard", lifetimeMs });
          return;
        }
        restartTimesRef.current.push(now);
      }

      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        const stillActive =
          voiceStateRef.current !== "idle" &&
          voiceStateRef.current !== "error-disabled";
        if (stillActive && enabledRef.current) {
          trace("recognizer.restart");
          intentionalStopRef.current = false; // fresh session, fresh latch
          recognizerStartedAtRef.current = Date.now();
          recognizerStartTriggerRef.current = "keepalive-restart";
          recognitionStart();
        }
      }, RESTART_DELAY_MS);
    },
  });

  // ─── Conversation teardown (end-phrase / silence / follow-up expiry / off) ─

  const teardownConversation = useCallback(
    (mode: "stop" | "abort") => {
      trace("conversation.teardown", { mode, state: voiceStateRef.current });
      clearSilenceTimer();
      clearSendTimer();
      clearFollowUpWindow();
      clearSilentTurnTimer();
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      accumulatedRef.current = "";
      interruptedReplyRef.current = "";
      conversationWarmRef.current = false;
      bargeInFiredRef.current = false;
      bargeInSwallowFinalRef.current = false;
      conversationOpenRef.current = false;
      restartTimesRef.current = [];
      echoReplyRef.current = "";
      echoTailUntilRef.current = 0;
      utteranceEchoAnchoredRef.current = false;
      echoAnchorDeadlineRef.current = 0;
      closePendingRef.current = false;
      longestInterimRef.current = "";
      longestInterimFromSpeakingRef.current = false;
      lastSentRef.current = { text: "", at: 0, id: "" };
      setInterimText("");
      setFinalText("");
      intentionalStopRef.current = true; // the coming recognizer end is ours
      if (mode === "abort") recognitionAbort();
      else recognitionStop();
      duplexStopRef.current(); // D-10: session dies with the follow-up window
      activeEarsRef.current = "recognizer";
    },
    [
      clearSilenceTimer,
      clearSendTimer,
      clearFollowUpWindow,
      clearSilentTurnTimer,
      recognitionAbort,
      recognitionStop,
    ]
  );

  const endConversation = useCallback(
    (mode: "stop" | "abort" = "stop") => {
      teardownConversation(mode);
      dispatch({ type: "END" });
    },
    [teardownConversation]
  );

  const resetSilenceTimer = useCallback(
    (ms: number = SILENCE_TIMEOUT_MS) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        trace("silence.timeout → re-arm");
        endConversation();
      }, ms);
    },
    [endConversation]
  );

  // ─── Follow-up window open (188.1-04, D-02) ────────────────────────────────
  // Extracted from onTurnEnd's inline block so the wake-only-drop case below
  // (a bare "Hey Astrid." mid-conversation) can call the SAME implementation
  // to REFRESH a window that handleInterimResultRef already consumed for
  // this utterance — one implementation, not two copies (the same
  // one-implementation principle D-06 applies to the concat sites). Behavior
  // preserved byte-for-byte from the pre-188.1-04 inline block: the
  // strictModeRef guard, the askedQuestion / QUESTION_FOLLOW_UP_MS vs
  // FOLLOW_UP_WINDOW_MS choice, the followup.open trace, resetSilenceTimer,
  // setFollowUpMs/setFollowUpOpen, and the expiry timeout's
  // followup.expire → re-arm / FOLLOW_UP_EXPIRE / teardownConversation.

  const openFollowUpWindow = useCallback(() => {
    if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
    if (!strictModeRef.current) {
      const reply = chatRef.current.streamingReplyRef.current;
      const askedQuestion = /\?\s*$/.test(reply.trim());
      const windowMs = askedQuestion ? QUESTION_FOLLOW_UP_MS : FOLLOW_UP_WINDOW_MS;
      trace("followup.open", { ms: windowMs, askedQuestion });
      // The silence backstop must outlive the window, never undercut it.
      resetSilenceTimer(windowMs + 5_000);
      setFollowUpMs(windowMs);
      setFollowUpOpen(true);
      followUpTimerRef.current = setTimeout(() => {
        trace("followup.expire → re-arm");
        dispatch({ type: "FOLLOW_UP_EXPIRE" });
        setFollowUpOpen(false);
        followUpTimerRef.current = null;
        // Window closed silently — conversation over, re-arm the wake word.
        teardownConversation("stop");
      }, windowMs);
    } else {
      // Strict mode: reducer already went to idle — tear down to re-arm.
      setFollowUpOpen(false);
      teardownConversation("stop");
    }
  }, [resetSilenceTimer, teardownConversation]);

  // ─── Turn end (her reply finished — with or without audio) ─────────────────
  // Shared by the TTS-end path and the silent-turn watchdog. Opens the
  // follow-up window (strict off), stay-hot-extended when she asked a question.
  // If the turn was a graceful close (user said an end-phrase, she replied),
  // the conversation re-arms HERE — after her goodbye, never silently.

  const onTurnEnd = useCallback(() => {
    if (voiceStateRef.current === "idle") return; // typed-turn TTS while armed

    if (closePendingRef.current) {
      closePendingRef.current = false;
      trace("close.graceful → re-arm after her goodbye");
      endConversation();
      return;
    }

    // Fresh restart budget: it's the user's turn now — a deaf window because
    // EARLIER turns spent the keep-alive cap is never acceptable.
    restartTimesRef.current = [];

    openFollowUpWindow();
  }, [openFollowUpWindow, endConversation]);

  // ─── Send (end-of-turn flush) ──────────────────────────────────────────────

  const flushSend = useCallback(async () => {
    clearSendTimer();
    const message = accumulatedRef.current.trim();
    trace("flushSend", { message, closing: closePendingRef.current });
    if (!message) return;
    accumulatedRef.current = "";
    longestInterimRef.current = "";
    longestInterimFromSpeakingRef.current = false;
    setFinalText("");
    dispatch({ type: "FINAL_RESULT" });

    // Her turn now — your silence clock pauses (the live trace showed it
    // firing mid-reply and tearing the conversation down under her).
    clearSilenceTimer();

    // Continuation merge: our own PREVIOUS message is still in flight (she's
    // thinking, no TTS yet) and this flush follows it closely — the debounce
    // chopped one sentence in two. Cancel the half-question's turn and resend
    // the whole sentence, so she answers it once.
    const prev = lastSentRef.current;
    const continuing =
      !closePendingRef.current &&
      prev.text !== "" &&
      Date.now() - prev.at < CONTINUATION_MERGE_MS &&
      chatRef.current.isStreaming &&
      !chatRef.current.ttsIsPlaying;

    // D-08 (188.3-05): every send gets its own client message id so a LATER
    // continuation-merge can name it as a supersede target.
    const clientMessageId = generateId();

    if (continuing) {
      const mergedResult = appendWithOverlapCheck(prev.text, message);
      const merged = mergedResult.text;
      trace("flushSend.merged-continuation", { merged, decision: mergedResult.decision });
      chatRef.current.interrupt("continuation-merge"); // cancel the half-question turn
      interruptedReplyRef.current = ""; // our own continuation, not her reply
      lastSentRef.current = { text: merged, at: Date.now(), id: clientMessageId };
      // D-08: supersede the PRIOR send's bubble (prev.id) in place — one
      // utterance, one bubble — instead of appending a second one. Client-
      // display-only: astridr's own session.messages still holds both turns.
      await chatRef.current.sendMessage(merged, {
        voice: true,
        clientMessageId,
        supersedes: prev.id,
      });
      return;
    }

    // D-12: thread the barged-in partial (if any) into this turn, then clear.
    // interrupt() is also called unconditionally: if a turn is still in flight
    // (speaking over her "thinking", or right after a barge-in) it cancels it
    // and returns any partial we don't already hold; when idle it's a no-op "".
    const prior = interruptedReplyRef.current;
    interruptedReplyRef.current = "";
    const partial = chatRef.current.interrupt("flush-send");
    const interruptedReply = prior || partial || undefined;

    lastSentRef.current = { text: message, at: Date.now(), id: clientMessageId };
    await chatRef.current.sendMessage(message, { interruptedReply, voice: true, clientMessageId });
  }, [clearSendTimer, clearSilenceTimer]);

  // ─── Barge-in (CONV-01, D-06/D-08/D-11/D-12) ──────────────────────────────
  // Fed by both the 183 recognizer and the duplex ears —
  // do not special-case by source. (RESEARCH Pitfall 5's named mitigation, D-13.)

  const handleBargeIn = useCallback(() => {
    if (bargeInFiredRef.current) return;
    trace("barge-in.fired");
    bargeInFiredRef.current = true;
    bargeInSwallowFinalRef.current = true;
    // Interrupting her goodbye means you're NOT done — cancel a pending close.
    closePendingRef.current = false;
    // You interrupted her mid-reply — clearly mid-conversation: accept whatever
    // comes next, however short.
    conversationWarmRef.current = true;

    // Snapshot her reply BEFORE interrupt() clears it — the trailing echo of
    // the cut-off TTS still needs fingerprinting against it.
    if (chatRef.current.streamingReplyRef.current) {
      echoReplyRef.current = chatRef.current.streamingReplyRef.current;
    }

    // Cuts TTS instantly, cancels the server turn, returns the partial reply.
    const partial = chatRef.current.interrupt("barge-in");
    if (partial) interruptedReplyRef.current = partial;

    dispatch({ type: "BARGE_IN" });

    setShowInterruptFlash(true);
    if (interruptFlashTimerRef.current) clearTimeout(interruptFlashTimerRef.current);
    interruptFlashTimerRef.current = setTimeout(() => {
      setShowInterruptFlash(false);
      interruptFlashTimerRef.current = null;
    }, INTERRUPT_FLASH_MS);
  }, []);

  // ─── Recognition handlers (latest-closure via refs) ────────────────────────

  handleInterimResultRef.current = (rawText: string) => {
    let text = rawText;
    // Canonical onresult line (186-01 D-16) — fires on every call regardless
    // of which branch below handles it, so the trace always has one entry
    // per real Web Speech onresult event with isFinal + the raw transcript.
    trace("onresult", { isFinal: false, text: rawText, state: voiceStateRef.current });

    // While she's speaking, the recognizer hears BOTH her TTS echo and you.
    // Explicit barge-in phrases act instantly; anything else is fingerprinted
    // against her own reply text — her echo is dropped, but a real user
    // interjection ("actually just tomorrow") interrupts her AND flows on as
    // your live utterance (talk-over-with-content).
    if (voiceStateRef.current === "speaking") {
      // D-07 FINAL (Larry's decision, 2026-07-30, after three live failures):
      // while she is speaking, ONLY an explicit barge phrase interrupts.
      //
      // Content-based echo rejection cannot work over open speakers. The echo
      // reaching the mic is degraded (speaker -> room -> mic), so Chrome emits
      // arbitrary garbage for it. One 40s reply produced: "bentuk", " Wolf",
      // "Hej", "kilometraje", "الوحدة", "Oração" — and " World Cup", which at
      // 2 words / 8 chars cleared every short-token guard, matched nothing in
      // her story, and was therefore classified as Larry talking over her.
      // It cut her off while he was silent. No fingerprint can match garbage,
      // and no length threshold separates "garbled echo" from "real speech",
      // because garbled echo IS arbitrary text.
      //
      // A fixed phrase list is robust by construction: "World Cup" will never
      // match "stop"/"wait"/"hold on", and neither will the next garbage.
      // This is also what the UI already promises — 'SAY "HEY ÁSTRÍÐR" TO
      // START · "STOP" INTERRUPTS · "GOODBYE" ENDS'.
      //
      // Cost, accepted: free-form talk-over no longer interrupts.
      const phrase = matchedBargePhrase(text);
      if (phrase) {
        // ...but only if the phrase is not HER OWN word coming back. Live
        // 2026-07-30 her story ended "the sea only keeps those who stop
        // fighting it" — echo of that would self-barge on "stop". Checked
        // against her reply text, not via isEchoOfReply, which returns true
        // for any utterance under 2 words and would swallow every real
        // one-word "stop".
        if (phraseAppearsIn(currentReply(), phrase)) {
          trace("interim.barge-phrase-in-her-reply", { text, phrase });
          return;
        }
        trace("interim.barge-in", { text });
        handleBargeIn();
        return;
      }
      // Everything else heard while she speaks is treated as echo. Not
      // fingerprinted — see above for why that cannot be made reliable.
      //
      // Still mark the speaking-era taint (Defect A's guard). Dropping the
      // interim here does NOT end the utterance: Chrome keeps growing the
      // same one, and its later interims arrive after voiceState has flipped
      // to "transcribing", where they ARE recorded as longestInterim. Live
      // 2026-07-30: " World Cup" was heard at .204 while speaking and again
      // at .748 while transcribing. Without this flag that second copy looks
      // like clean user speech and can rejoin a later, unrelated final —
      // verified by the rejoin test, which leaked "I couldn't find what's on
      // my calendar today" when this line was missing.
      longestInterimFromSpeakingRef.current = true;
      trace("interim.ignored-while-speaking", { text });
      return;
    } else if (isEchoAnchored() || Date.now() < echoTailUntilRef.current) {
      // Echo tail: her TTS just ended but the recognizer may still be
      // finalizing an utterance that STARTED as her voice — and Chrome glues
      // the user's answer onto it. Anchor the utterance (with an expiry — an
      // abandoned tail utterance must not strip later, unrelated speech) and
      // track only the non-echo remainder (live-trace mashup bug).
      if (!utteranceEchoAnchoredRef.current) {
        echoAnchorDeadlineRef.current = Date.now() + ECHO_ANCHOR_MAX_MS;
      }
      utteranceEchoAnchoredRef.current = true;
      const remainder = stripEchoPrefix(text, echoReplyRef.current);
      if (!remainder || isResidualEcho(remainder, echoReplyRef.current)) {
        trace("interim.echo-tail", { text });
        return;
      }
      if (remainder !== text.trim()) {
        trace("interim.echo-tail-stripped", { from: text, to: remainder });
      } else {
        // 2026-07-31 tail-hallucination repro: explicit trace for the case the fuzzy echo match
        // was checked and found NO match — previously silent, so a hallucinated token slipping
        // through here was invisible in the trace, only inferable. Diagnostic only.
        trace("interim.echo-tail-checked-no-match", { text });
      }
      text = remainder;
    } else {
      trace("interim", { text, state: voiceStateRef.current });
    }

    // Track the longest user interim since the last final (salvage source if
    // Chrome abandons the utterance — a later, shorter interim must not
    // replace the good one; the live trace showed "do I have any entries on"
    // collapsing to " today"). 186-01 follow-up (Defect B): STICKY taint —
    // OR-accumulate rather than recompute fresh each time. The live trace
    // showed WHY it must be sticky: the barge-triggering interim (" I
    // couldn't") is captured while state is still "speaking" (dispatch()
    // only QUEUES the BARGE_IN transition — voiceStateRef.current doesn't
    // flip until the next render), but the very NEXT, LONGER interim in the
    // same orphaned utterance (" I couldn't find") arrives after React has
    // already re-rendered into "transcribing". A fresh-per-update check
    // would (wrongly) call that second interim trustworthy even though it's
    // still the SAME misclassified utterance — once tainted, stays tainted
    // until one of the standard resets (final/teardown/wake/salvage) clears
    // both refs together.
    if (text.trim().length > longestInterimRef.current.trim().length) {
      longestInterimRef.current = text;
      // The `longestInterimFromSpeakingRef` update that used to sit here is
      // now unreachable (TS proves it): the speaking branch above always
      // returns, so no interim captured DURING speech reaches this point.
      // The ref keeps any prior taint on its own; it is cleared only by the
      // standard resets described above.
    }

    // 186-01 voice timer guard: a post-teardown Web Speech interim straggler
    // can fire AFTER the conversation has already torn down and voiceState
    // has flipped back to "idle" (the recognizer's stop is async and Chrome
    // sometimes emits one more onresult in flight). A legitimate interim only
    // ever arrives from an active recognizer tied to a live conversation —
    // when idle, skip the state-mutating tail entirely so a straggler can no
    // longer arm a phantom 30s silence timer (which would then fire into a
    // conversation that no longer exists).
    if (voiceStateRef.current !== "idle") {
      setInterimText(text);
      dispatch({ type: "INTERIM_RESULT" });
      resetSilenceTimer();
    }
    clearSendTimer(); // still talking — defer the end-of-turn send
    clearFollowUpWindow(); // CONV-02: a new interim consumes the window
  };

  // Fed by both the 183 recognizer and the duplex ears —
  // do not special-case by source. (RESEARCH Pitfall 5's named mitigation, D-13.)
  handleFinalResultRef.current = (
    rawText: string,
    confidence?: number,
    durationMs?: number
  ) => {
    let text = rawText;
    // Canonical onresult line (186-01 D-16) — see handleInterimResultRef's
    // twin above; isFinal:true here, always fires before any branch below.
    trace("onresult", { isFinal: true, text: rawText, confidence, state: voiceStateRef.current });
    // durationMs (188.1-02, D-03): populated for duplex-sourced finals only,
    // undefined for recognizer-sourced ones -- the recognizer structurally
    // cannot carry this signal (188.1-CONTEXT.md D-05). Threshold-free: no
    // gate reads this field yet, it is disclosure-only until Plan 04.
    trace("final", { text, confidence, durationMs, state: voiceStateRef.current });
    // Capture the salvage buffer — the accept path rejoins it if Chrome reset
    // the utterance and finalized only the tail (19:09: "do I have any" was
    // interim-only, the final carried just "on my personal account").
    const lostInterim = longestInterimRef.current.trim();
    // Set by the rejoin block below; read by the duration gate that follows it,
    // which must NOT judge a salvaged turn by its tail's duration alone (D-10).
    let salvaged = false;
    // 186-01 follow-up (Defect B) — see longestInterimFromSpeakingRef's doc
    // comment: a speaking-era (echo/talk-over classified) interim must never
    // be used as a rejoin source, no matter how it compares by length/
    // distance to this final.
    const lostInterimFromSpeaking = longestInterimFromSpeakingRef.current;
    longestInterimRef.current = "";
    longestInterimFromSpeakingRef.current = false;

    // D-07 FINAL — the SAME rule as the interim handler above. This branch
    // was missed in the first pass and made things strictly worse: the
    // duplex ears transcribed her own TTS echo as the FINAL "It's worth.",
    // which fell through the old talk-over path, barged her mid-story AND
    // was dispatched as a user message — so she answered her own echo with
    // "Hey Larry! What can I do for you?" (live 2026-07-30 18:20:17-18:20:19,
    // then merged into "It's worth. Hallo!").
    //
    // Note the duplicate-ear guard on the recognizer's onFinalResult does NOT
    // cover this: the offending final came from the DUPLEX ears, which are
    // the active source. Source-blindness is deliberate (D-13) — the fix
    // belongs here, in the shared sink, not in a per-source special case.
    //
    // Returning (rather than falling through) is the important part: while
    // she is speaking, a non-barge-phrase final is echo and must never reach
    // the accumulator or flushSend.
    if (voiceStateRef.current === "speaking") {
      const phrase = matchedBargePhrase(text);
      if (phrase) {
        if (phraseAppearsIn(currentReply(), phrase)) {
          trace("final.barge-phrase-in-her-reply", { text, phrase });
          return;
        }
        trace("final.barge-in", { text });
        handleBargeIn();
        return;
      }
      trace("final.ignored-while-speaking", { text });
      return;
    } else if (isEchoAnchored() || Date.now() < echoTailUntilRef.current) {
      // Echo tail (see interim handler): strip her glued echo prefix; keep
      // only the user's part. Pure echo → dropped entirely.
      utteranceEchoAnchoredRef.current = false;
      const remainder = stripEchoPrefix(text, echoReplyRef.current);
      if (!remainder || isResidualEcho(remainder, echoReplyRef.current)) {
        trace("final.echo-tail-dropped", { text });
        return;
      }
      if (remainder !== text.trim()) {
        trace("final.echo-tail-stripped", { from: text, to: remainder });
      } else {
        // 2026-07-31 tail-hallucination repro: see the matching comment in the interim
        // handler above — explicit trace for "checked, no match, passed through".
        trace("final.echo-tail-checked-no-match", { text });
      }
      text = remainder;
    }

    // Swallow the trailing final of the barge-in utterance: barge phrases
    // ("stop") AND her own echo — after a talk-over cut, Chrome's final for
    // that utterance is often just her leaked words (live trace: a bare
    // " today" from her "Today is…" got SENT as a message).
    if (bargeInSwallowFinalRef.current) {
      bargeInSwallowFinalRef.current = false;
      if (isBargeInPhrase(text) || isEchoOfReply(text, echoReplyRef.current)) {
        trace("final.barge-swallowed", { text });
        return;
      }
    }

    setInterimText("");
    resetSilenceTimer();

    // Wake-phrase strip (188.1-04, D-01/D-02/D-05): placed after the interim/
    // silence reset above but BEFORE every fast-path below, so a stripped
    // remainder still reaches vision-intent detection ("Hey Ástríðr, what's
    // on my screen?") and the pure-barge reflex ("Hey Astrid, stop") exactly
    // as if the wake phrase had never been spoken. This closes the live
    // defect where "Hey Astrid." was transcribed by the duplex ear, accepted
    // as content, and dispatched as a chat message — answered by a full LLM
    // turn plus TTS synthesis — three times in one recorded session
    // (2026-08-05 evidence todo). Lands in THIS shared sink, not the wake
    // worker's onWake (D-05): onWake never sees transcript text, so it is
    // structurally incapable of catching a wake phrase transcribed as
    // content by the duplex ear.
    const wakeStrip = stripWakePhrase(text);
    if (wakeStrip.matched !== null) {
      if (wakeStrip.stripped === "") {
        // D-02: the WHOLE utterance was the wake phrase — drop it and
        // REFRESH (not close) the follow-up window, so saying her name
        // mid-conversation keeps her listening instead of ending the turn.
        // handleInterimResultRef already called clearFollowUpWindow() for
        // this same utterance ("a new interim consumes the window"), so this
        // genuinely re-opens a consumed window rather than a no-op.
        trace("final.wake-phrase-only-dropped", { text });
        setFilteredCount((c) => c + 1);
        openFollowUpWindow();
        return;
      }
      trace("final.wake-phrase-stripped", { from: text, to: wakeStrip.stripped });
      text = wakeStrip.stripped;
    }

    // Vision-intent fast-path (D-01/D-02/D-03/D-04): a share-context question
    // bypasses the normal accumulate/debounce pipeline entirely — it's a
    // direct command, not banter. An active share captures a FRESH frame and
    // attaches it to this SAME turn (D-02, no extra hop); no active share
    // gets the honest spoken+written refusal and arms the control (D-03) —
    // never a silent blind chat.send.
    const visionAction = decideVisionIntent(text, screenShareRef.current.state === "active");
    if (visionAction) {
      visionTrace("intent.match", { text, action: visionAction });
      closePendingRef.current = false;
      clearFollowUpWindow();
      clearSendTimer();
      // D-14 (188.3-04): additive-only trace of what this fast-path silently
      // discards. Every OTHER drop path in this function traces before
      // returning (final.noise-rejected, final.duration-rejected,
      // final.wake-phrase-only-dropped); this fast-path and its two siblings
      // below (swap, end-phrase) were the three exceptions. ZERO behavior
      // change — whether discarding a pending accumulator here is CORRECT
      // stays explicitly UNDECIDED; no test or comment states the intent
      // either way, and that decision needs real trace data, deferred to a
      // later phase (188.3-CONTEXT.md D-14).
      if (accumulatedRef.current.trim()) {
        trace("final.accumulator-discarded-vision-intent", { discarded: accumulatedRef.current });
      }
      accumulatedRef.current = "";
      setFinalText("");

      if (visionAction === "capture") {
        // Inline within the existing `processing` state (184-UI-SPEC.md) — no
        // new top-level reducer state; isLooking only overrides the label.
        dispatch({ type: "FINAL_RESULT" });
        setIsLooking(true);
        chatRef.current.interrupt("vision-capture"); // cancel any in-flight turn so this send isn't dropped
        void (async () => {
          try {
            const frame = await screenShareRef.current.captureFrame();
            visionTrace("frame.captured", { bytes: frame.blob.size, mimeType: frame.mimeType });
            await chatRef.current.sendMessage(text, {
              voice: true,
              frame: frame.base64,
              frameMimeType: frame.mimeType,
            });
          } catch (err) {
            visionTrace("frame.capture-failed", {
              error: err instanceof Error ? err.message : String(err),
            });
            setIsLooking(false);
            // 184 code-review CR-03: FINAL_RESULT already moved the reducer
            // into `processing` and no send happened — nothing will ever fire
            // TTS_START/TTS_END, and the silent-turn watchdog only arms on a
            // chat.isStreaming falling edge, so without an explicit close the
            // conversation wedges in "Thinking…" until a manual mic toggle.
            // Mirror the watchdog's close: end the turn, back to listening.
            dispatch({ type: "TTS_END", strictMode: strictModeRef.current });
            onTurnEnd();
          }
        })();
      } else {
        // D-03 locked refusal (VISION_REFUSAL_TEXT, voiceState.ts):
        // "I can't see your screen — start a share and ask again."
        visionTrace("intent.refuse", { text });
        runVisionRefusal({
          speak: speakSystemLine,
          appendLocalAssistantMessage: chatRef.current.appendLocalAssistantMessage,
          arm: screenShareRef.current.arm,
        });
      }
      return;
    }

    // Pure interrupt reflex outside `speaking` ("stop", "wait", "hold on" with
    // no content around it): cancel a thinking turn if one is in flight,
    // otherwise ignore — NEVER send it to Ástríðr as a literal message.
    if (isPureBargeInPhrase(text)) {
      trace("final.pure-barge", { text, inFlight: chatRef.current.isStreaming });
      closePendingRef.current = false;
      if (chatRef.current.isStreaming) {
        conversationWarmRef.current = true;
        const partial = chatRef.current.interrupt("pure-barge-processing");
        if (partial) interruptedReplyRef.current = partial;
        dispatch({ type: "BARGE_IN" });
        setShowInterruptFlash(true);
        if (interruptFlashTimerRef.current) clearTimeout(interruptFlashTimerRef.current);
        interruptFlashTimerRef.current = setTimeout(() => {
          setShowInterruptFlash(false);
          interruptFlashTimerRef.current = null;
        }, INTERRUPT_FLASH_MS);
      }
      return;
    }

    // Spoken strict-mode toggle (D-05): client fast-path, no LLM turn.
    const strictCommand = isStrictModeCommand(text);
    if (strictCommand) {
      onStrictModeChange(strictCommand === "on");
      clearFollowUpWindow();
      return;
    }

    // Brain/voice hot-swap fast-path (SWAP-01/02/03, D-09/D-11): "try on X" /
    // "switch your voice to X" bypasses the normal accumulate/debounce pipeline
    // entirely, same as vision-intent above — zero-latency, no LLM turn spent
    // on recognizing the command. The client matcher only EXTRACTS the target
    // (voiceState.ts, 185-06); it never resolves/validates it. Forwarding this
    // SAME transcript text lets the backend's own inbound regex fast-path
    // (185-05, apply_inbound_control_verbs) resolve + execute the swap exactly
    // once — swapHandled:true is the D-11/Pitfall-5 dedup marker telling the
    // backend "the client already recognized this as a swap" so a mismatched
    // client/backend match can never double-fire.
    if (SWAP_MODEL_VERB.match(text) || SWAP_VOICE_VERB.match(text)) {
      trace("final.swap-dispatch", { text });
      clearFollowUpWindow();
      clearSendTimer();
      // D-14 (188.3-04): see the vision-intent fast-path's comment above for
      // the full note. Same additive-only trace, zero behavior change.
      if (accumulatedRef.current.trim()) {
        trace("final.accumulator-discarded-swap", { discarded: accumulatedRef.current });
      }
      accumulatedRef.current = "";
      setFinalText("");
      dispatch({ type: "FINAL_RESULT" });
      chatRef.current.interrupt("swap-dispatch"); // cancel any in-flight turn so this send isn't dropped
      void chatRef.current.sendMessage(text, { voice: true, swapHandled: true });
      return;
    }

    // End-phrase ("thanks"/"thank you"/"goodbye"/"that's all" — NOT "stop"):
    // GRACEFUL close. Send it so she answers warmly ("You're welcome — I'm
    // here if you need me"); the conversation re-arms after HER reply ends
    // (onTurnEnd checks closePendingRef). A silent client-side discard read
    // as "she did nothing" (live defect 2026-07-20).
    if (isEndPhrase(text)) {
      trace("final.end-phrase → graceful close", { text });
      closePendingRef.current = true;
      clearFollowUpWindow();
      clearSendTimer();
      // D-14 (188.3-04): see the vision-intent fast-path's comment above for
      // the full note. This site OVERWRITES rather than blanks the
      // accumulator, so the payload carries BOTH sides — the discarded value
      // AND the replacing text — a reader needs both to judge the loss.
      if (accumulatedRef.current.trim()) {
        trace("final.accumulator-discarded-end-phrase", {
          discarded: accumulatedRef.current,
          replacing: text.trim(),
        });
      }
      accumulatedRef.current = text.trim();
      setFinalText(accumulatedRef.current);
      void flushSend(); // no debounce — the goodbye goes out immediately
      return;
    }

    // Noise/banter gate (CONV-03): reject cold fragments <3 words; warm
    // conversations accept short replies. Zero UI trace on reject.
    const isFollowUpWindowOpenForGate = conversationWarmRef.current || followUpOpen;
    if (shouldReject(text, isFollowUpWindowOpenForGate, confidence)) {
      // D-09/188.1-06 (GLUE-LOSS): a fragment that fails ONLY the word-count
      // floor, while an accumulation is genuinely pending (a previous final
      // was already accepted and its send timer is armed), is a
      // MID-UTTERANCE continuation, not cold noise -- the captured loss case
      // was `shouldReject` dropping a 1-word fragment ("On") that sat
      // between two accepted finals of the same sentence. Scoped narrowly:
      // shouldReject's own confidence floor and barge-in bypass are
      // untouched (this only widens the word-count axis, and only in this
      // specific context).
      //
      // D-13 (corrected 188.3-03; the prior version of this comment claimed
      // that Plan 04's wake-strip AND duration checks had both already
      // executed by the time text reaches this point). That claim is only
      // half true now. The wake-strip DOES still run above this
      // block for the direct path, so a wake-phrase-only utterance is
      // already dropped before ever reaching here. The duration gate does
      // NOT run above this block -- 188.1-07 moved it BELOW the rejoin
      // (`!salvaged && durationMs !== undefined && durationMs < DURATION_FLOOR_MS`),
      // so a sub-floor-duration final has not yet been judged at the point
      // this leniency admits a fragment.
      //
      // D-13 re-check: does this leniency's safety actually DEPEND on the
      // duration gate having run first? No -- traced concretely. A fragment
      // this leniency admits still flows into the rejoin and the duration
      // gate below, in this SAME pass over this SAME final. If no eligible
      // lostInterim rejoins it, `salvaged` stays false and the duration gate
      // still applies to this final exactly as it always has -- the
      // protection runs LATER in the pass, not earlier, but it still runs.
      // If the rejoin DOES fire (this leniency's eligibility mirrors the
      // rejoin's own, so this is the expected case -- D-03), `salvaged`
      // becomes true and the duration gate is deliberately exempted by the
      // pre-existing SALVAGE EXEMPTION (188.1-07, proven by CTRL-SALVAGE): a
      // rejoined final's durationMs measures only the surviving tail and
      // structurally under-reports the real utterance, so exempting it
      // predates and is independent of this leniency. No residual seam
      // found. (Unrelated, pre-existing ceiling: durationMs is permanently
      // undefined for primary-recognizer-sourced finals, so the duration
      // gate never protected those regardless of any leniency -- see FAILS
      // OPEN below.)
      //
      // With an EMPTY accumulator, a cold conversation, and no eligible
      // pending lostInterim, both disjuncts of accumulationPending are false
      // and the fragment is rejected exactly as it is today.
      // D-02/D-03: an eligible lost interim is pending -- mirrors the
      // rejoin's own eligibility set below (:1621-1625) term for term, so
      // nothing is admitted here that the rejoin will not then go on to
      // complete: non-empty, non-speaking-era, >= 3 words, not an echo of
      // the current reply.
      const eligibleLostInterimPending =
        lostInterim.length > 0 &&
        !lostInterimFromSpeaking &&
        lostInterim.split(/\s+/).filter(Boolean).length >= 3 &&
        !isEchoOfReply(lostInterim, currentReply());
      const accumulationPending =
        (accumulatedRef.current.trim() !== "" && sendTimerRef.current !== null) ||
        eligibleLostInterimPending;
      const minWords = isFollowUpWindowOpenForGate ? 1 : 3;
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const confidenceRejected =
        confidence !== undefined && confidence > 0 && confidence < 0.01;
      const failedOnlyWordFloor =
        accumulationPending && !confidenceRejected && wordCount < minWords;
      if (!failedOnlyWordFloor) {
        trace("final.noise-rejected", { text, warm: conversationWarmRef.current, followUpOpen });
        return;
      }
      trace("final.fragment-preserved", { text, accumulated: accumulatedRef.current });
      // Fall through to the normal accept path below -- the fragment
      // reaches the SAME accumulator call already routed through
      // appendWithOverlapCheck (D-06), never a raw join.
    }

    // Rejoin a lost interim: Chrome sometimes resets mid-utterance and the
    // final carries only the tail. If a substantive interim (≥3 words) is not
    // contained in this final, the user said BOTH parts — prepend it.
    // 186-01 follow-up (Defect B, fresh live trace): a lost interim that was
    // captured while she was SPEAKING (the echo/talk-over fuzzy boundary —
    // Defect A's own live trace proved that classification can be wrong) is
    // categorically excluded — it can persist as "longest" across an entire
    // silent gap and otherwise poison a completely unrelated later utterance
    // (the trace: her own misheard refusal fragment "I couldn't find" got
    // prepended onto "Tryon Rock", sending "I couldn't find Tryon Rock").
    // Defense in depth: even for a NON-speaking-era lostInterim, skip the
    // rejoin if it still fuzzy-matches whatever reply text is currently known
    // (isEchoOfReply) — cheap, and only meaningfully live now that Defect A's
    // run.blocks backfill (useAstridrChat.ts) keeps that text populated for
    // control-verb replies too.
    if (
      lostInterim &&
      !lostInterimFromSpeaking &&
      lostInterim.split(/\s+/).filter(Boolean).length >= 3 &&
      !isEchoOfReply(lostInterim, currentReply())
    ) {
      const needle = squash(lostInterim);
      const dist = approxSubstringDistance(needle, squash(text));
      if (dist > Math.max(1, Math.floor(needle.length * 0.2))) {
        trace("final.rejoined-lost-interim", { lostInterim, final: text });
        text = appendWithOverlapCheck(lostInterim, text).text;
        salvaged = true;

        // D-01: the rejoin above MUTATES `text` by prepending `lostInterim`,
        // but the wake-strip at :1427 already INSPECTED `text` ~200 lines
        // earlier and cannot re-run — so a wake phrase carried at the HEAD of
        // a rejoined lostInterim (Chrome resets mid-utterance right after
        // "Hey Astrid, ...") would otherwise survive, unjudged, into the
        // dispatched text (see WAKE-REJOIN-1). Gated on `salvaged === true`
        // so the direct (non-rejoined) path above stays byte-for-byte
        // identical — this is the only new call site; no second phrase list,
        // no new regex, same exported `stripWakePhrase` helper reused verbatim.
        if (salvaged) {
          const rejoinedWakeStrip = stripWakePhrase(text);
          if (rejoinedWakeStrip.matched !== null) {
            if (rejoinedWakeStrip.stripped === "") {
              // Defensive-only, unreachable as of 2026-08-07: WAKE_PHRASES'
              // longest entry is 2 tokens ("hey astrid" / "hey astridr" /
              // "hey ástríðr", voiceState.ts:145) and the rejoin's own
              // eligibility gate above already requires lostInterim to carry
              // >= 3 tokens, so stripping at most 2 leading tokens off a
              // rejoined string always leaves >= 1 token behind. Kept for
              // parity with the direct path's D-02 behavior in case
              // WAKE_PHRASES ever grows a 3+-token entry.
              trace("final.rejoined-wake-phrase-only-dropped", { text });
              setFilteredCount((c) => c + 1);
              openFollowUpWindow();
              return;
            }
            trace("final.rejoined-wake-phrase-stripped", {
              from: text,
              to: rejoinedWakeStrip.stripped,
            });
            text = rejoinedWakeStrip.stripped;
          }
        }
      }
    } else if (lostInterim && lostInterimFromSpeaking) {
      trace("final.lost-interim-discarded-speaking-era", { lostInterim });
    }

    // Duration plausibility gate (188.1-04 / re-derived 188.1-07, D-03/D-10).
    //
    // ORDER: this sits AFTER the salvage rejoin above, not before it. When the
    // gate ran first (its original 188.1-04 position) a sub-floor final was
    // dropped before the rejoin could recover it — the D-10 hazard CTRL-SALVAGE
    // guards. Harmless at the old provisional 50ms floor; live-armed the moment
    // the floor rose to a real value.
    //
    // SALVAGE EXEMPTION: a rejoined final's durationMs measures only the TAIL
    // that survived Chrome's mid-utterance reset — it structurally under-reports
    // the real utterance, whose earlier span lives in lostInterim and was never
    // timed. Gating on that number would reject a turn the user genuinely spoke
    // in full. Moving the gate alone was NOT sufficient to fix this; the
    // exemption is the actual fix, and CTRL-SALVAGE is what proves it.
    //
    // FLOOR: 320ms — see DURATION_FLOOR_MS at :171, which is the single source
    // of truth. Derived from the 2026-08-06 live-mic corpus of 11 real
    // utterances (645-3764ms): shortest real 645 ÷ 2 = 322.5 → 320. The prior
    // 50ms value was PROVISIONAL, derived from a corpus with ONE junk sample and
    // ZERO real ones; it never fired once in a 388-second live session and let
    // both junk bursts through to a full LLM turn + TTS.
    //
    // 880ms was CONSIDERED AND REJECTED. It is tempting because it clears the
    // junk in the first session's sample, but it turns CTRL-SHORT red: it would
    // reject the real 645ms "Thanks." The 188.1 UAT then confirmed the rejection
    // empirically — live 2026-08-06 21:35, a real cough transcribed as "咳咳"
    // measured 802ms while a genuine spoken "Yes." measured only 741ms. Junk ran
    // LONGER than speech, so an 880ms floor would have eaten the "Yes." and a
    // 320ms floor cannot catch the cough. Do NOT raise this number to chase junk.
    //
    // KNOWN CEILING: the two classes OVERLAP in duration, so no threshold
    // separates them. This gate is necessary but not sufficient; suppressing
    // that junk class needs a different signal (script/language mismatch,
    // confidence, semantic plausibility), not a bigger number here.
    //
    // FAILS OPEN: durationMs is undefined for EVERY recognizer-sourced final,
    // permanently — the Web Speech API surfaces no start/stop timestamps
    // (188.1-CALIBRATION.md §d). An undefined duration is a pass-through.
    if (!salvaged && durationMs !== undefined && durationMs < DURATION_FLOOR_MS) {
      trace("final.duration-rejected", { text, durationMs, floorMs: DURATION_FLOOR_MS });
      setFilteredCount((c) => c + 1);
      return;
    }

    // Resume-intent normalization: right after a barge-in (an interrupted
    // partial is pending), a SHORT utterance containing a resume word is a
    // resume — always. STT garbles the lead-in ("not continue" for "no,
    // continue", conf 0.73, live 19:05) and a flipped negation made her stop
    // instead of resuming. Longer utterances pass through untouched
    // ("continue but only for tomorrow" stays verbatim).
    if (
      interruptedReplyRef.current &&
      text.trim().split(/\s+/).filter(Boolean).length <= 4 &&
      /(continue|go on|keep going|resume|finish)/i.test(text)
    ) {
      trace("final.resume-normalized", { from: text });
      text = "continue";
    }

    // CONV-02: a real accepted utterance consumes the follow-up window.
    clearFollowUpWindow();

    // Accumulate; send after a pause. Adaptive: a short complete answer in a
    // warm conversation ("no", "yes", "the second one") goes out in 800ms —
    // human turn-gaps are sub-second; only open-ended clauses need the full
    // 2s mid-thought allowance.
    const accumulatedResult = appendWithOverlapCheck(accumulatedRef.current, text);
    if (accumulatedResult.decision !== "joined") {
      trace("glue.accumulator", {
        decision: accumulatedResult.decision,
        before: accumulatedRef.current,
        after: accumulatedResult.text,
      });
    }
    accumulatedRef.current = accumulatedResult.text;
    setFinalText(accumulatedRef.current);

    const words = accumulatedRef.current.split(/\s+/).filter(Boolean).length;
    const debounceMs =
      conversationWarmRef.current && words <= SHORT_ANSWER_MAX_WORDS
        ? SHORT_SEND_DEBOUNCE_MS
        : SEND_DEBOUNCE_MS;
    trace("final.accepted", { text, warm: conversationWarmRef.current, debounceMs });

    clearSendTimer();
    sendTimerRef.current = setTimeout(() => {
      void flushSend();
    }, debounceMs);
  };

  // ─── Duplex ears (Phase 188, DUPLEX-01) ────────────────────────────────────
  // A pure event router: composed AFTER handleBargeIn/handleFinalResultRef so
  // these callbacks can reference them directly, with no forward-declaration
  // dance. useDuplexEars owns zero conversation logic (188-05) — this hook
  // owns zero duplicate dispatch logic. Every event funnels into the SAME
  // sinks the 183 recognizer already uses (D-13); see the matching
  // never-special-case-the-source comments on handleBargeIn and the
  // final-result handler above.

  // D-07 REVISED (Larry's decision, 2026-07-30, after two live failures):
  // the duplex ears do NOT trigger barge-in. Their VAD is OpenAI's
  // server-side energy detector — it carries no text, so at the instant it
  // fires it cannot tell Larry's voice from her own reply coming back
  // through open speakers. Browser AEC (echoCancellation:true, already
  // requested on the duplex stream in useDuplexEars) demonstrably does not
  // cancel it.
  //
  // Two fixes were tried and both failed live:
  //   1. A time window (ECHO_SUPPRESS_MS=400) — echo arrived 1.7s into
  //      playback (trace 16:16:10.371), long past it. Widening it far enough
  //      would suppress real barge-in for the whole reply.
  //   2. Corroborating against the recognizer's content-based echo match —
  //      assumed the recognizer flags echo FIRST. It did at 16:16 (770ms
  //      lead) but NOT at 16:35: duplex fired at .363 and the recognizer's
  //      first interim arrived at .521, 158ms LATER. The race order is not
  //      guaranteed, so after-the-fact corroboration cannot work.
  //
  // Barge-in therefore belongs to the 183 recognizer path alone, which is
  // content-aware (isEchoOfReply) and already distinguishes echo from real
  // talk-over correctly — see the interim handler's echo-dropped vs
  // talk-over branches. Cost: barge-in latency is recognizer-interim speed
  // (~1s) rather than duplex VAD speed (~150ms). That is the accepted
  // tradeoff: a slightly slower interruption beats one that fires
  // constantly on her own voice and makes conversation impossible.
  //
  // The duplex ears keep their real job: fast, accurate TRANSCRIPTION
  // (onDuplexFinalTranscript), which is unaffected by this.
  const onDuplexSpeechStart = useCallback(() => {
    trace("duplex.speech_started", { state: voiceStateRef.current });
  }, []);

  const onDuplexFinalTranscript = useCallback((text: string, durationMs?: number) => {
    // Never trace transcript text, only length (T-188-31/T-188-60).
    // msSinceTtsEnd/insideTailWindow added 2026-07-31 for the tail-hallucination repro (garbage
    // tokens like "Twing."/"bentuk" observed right after her TTS ends) -- diagnostic only, does
    // not change routing. Lets a live trace show directly whether hallucinated finals land inside
    // ECHO_TAIL_MS (where the fuzzy echo match at least gets a chance to run) or after it expires
    // (where today NOTHING defends against them at all).
    // durationMs (188.1-02, D-03/D-05) is threaded through unchanged from useDuplexEars --
    // this hook makes no accept/reject decision on it, it is plumbing only.
    trace("duplex.transcript", {
      length: text.length,
      durationMs,
      msSinceTtsEnd: echoTailUntilRef.current ? Date.now() - (echoTailUntilRef.current - ECHO_TAIL_MS) : null,
      insideTailWindow: Date.now() < echoTailUntilRef.current,
    });
    handleFinalResultRef.current(text, undefined, durationMs);
  }, []);

  const onDuplexUnavailable = useCallback((reason: string) => {
    // D-08/T-188-32: fall back to the 183 recognizer silently — a ref flip
    // and a debug-gated trace, never a dispatch, never a UI label.
    activeEarsRef.current = "recognizer";
    trace("duplex.unavailable", { reason });
  }, []);

  const onDuplexSessionEnd = useCallback((info: { seconds: number }) => {
    trace("duplex.session_end", { seconds: info.seconds });
    // Fire-and-forget (D-09/D-10): a slow, dead, or rejecting usage endpoint
    // must never delay conversation re-arming or throw into this callback --
    // defense in depth on top of reportRealtimeUsage's own internal try/catch.
    void reportRealtimeUsage(info.seconds).catch(() => {});
  }, []);

  const {
    start: duplexStart,
    stop: duplexStop,
    status: duplexStatus,
  } = useDuplexEars({
    enabled,
    // D-06 seam: multi-persona duplex rollout is out of scope this phase.
    persona: "astridr",
    onSpeechStart: onDuplexSpeechStart,
    onFinalTranscript: onDuplexFinalTranscript,
    onUnavailable: onDuplexUnavailable,
    onSessionEnd: onDuplexSessionEnd,
    debug: VOICE_DEBUG,
  });
  duplexStartRef.current = duplexStart;
  duplexStopRef.current = duplexStop;

  useEffect(() => {
    if (duplexStatus === "connected") {
      activeEarsRef.current = "duplex";
      trace("duplex.ears_switch", { active: "duplex" });
    }
  }, [duplexStatus]);

  // ─── TTS lifecycle → state machine (echo guard arming, follow-up window) ──

  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (chat.ttsIsPlaying && !wasPlayingRef.current) {
      wasPlayingRef.current = true;
      trace("tts.start", { state: voiceStateRef.current });
      clearSilentTurnTimer(); // audio arrived — the watchdog stands down
      // Re-arm barge-in for this speaking turn; the session is now warm.
      bargeInFiredRef.current = false;
      conversationWarmRef.current = true;
      // Snapshot her reply for echo fingerprinting (survives interrupt()).
      echoReplyRef.current = chatRef.current.streamingReplyRef.current;
      // Her turn — your silence clock stays paused while she talks.
      clearSilenceTimer();
      dispatch({ type: "TTS_START" });
    } else if (!chat.ttsIsPlaying && wasPlayingRef.current) {
      wasPlayingRef.current = false;
      trace("tts.end", { state: voiceStateRef.current, barged: bargeInFiredRef.current });
      // Arm the echo-tail window: the recognizer may still be finalizing her
      // trailing words (and gluing the user's answer onto them).
      if (chatRef.current.streamingReplyRef.current) {
        echoReplyRef.current = chatRef.current.streamingReplyRef.current;
      }
      echoTailUntilRef.current = Date.now() + ECHO_TAIL_MS;
      dispatch({ type: "TTS_END", strictMode: strictModeRef.current });
      if (bargeInFiredRef.current) {
        // TTS end CAUSED BY a barge-in isn't her finishing — the user is
        // already talking. No follow-up countdown; just resume your clock.
        resetSilenceTimer();
      } else {
        onTurnEnd();
      }
    }
  }, [chat.ttsIsPlaying, onTurnEnd, clearSilenceTimer, clearSilentTurnTimer, resetSilenceTimer]);

  // ─── Silent-turn watchdog ──────────────────────────────────────────────────
  // A turn can complete with NO audio (error, empty reply, TTS hiccup). If
  // streaming ends while we're in `processing` and no TTS starts within the
  // grace window, close the turn so the conversation doesn't wedge.

  const prevStreamingRef = useRef(false);
  useEffect(() => {
    const was = prevStreamingRef.current;
    prevStreamingRef.current = chat.isStreaming;
    if (was && !chat.isStreaming && voiceStateRef.current === "processing") {
      clearSilentTurnTimer();
      silentTurnTimerRef.current = setTimeout(() => {
        silentTurnTimerRef.current = null;
        if (
          voiceStateRef.current === "processing" &&
          !chatRef.current.ttsIsPlaying
        ) {
          trace("turn.end-no-audio → back to listening");
          dispatch({ type: "TTS_END", strictMode: strictModeRef.current });
          onTurnEnd();
        }
      }, SILENT_TURN_GRACE_MS);
    }
  }, [chat.isStreaming, onTurnEnd, clearSilentTurnTimer]);

  // ─── "Looking…" clear (D-04) ────────────────────────────────────────────
  // Clears the instant either signal fires first: the model's answer begins
  // streaming (chat.isStreaming — set true as soon as the send ack lands, the
  // earliest available "answer is coming" signal) or TTS_START (ttsIsPlaying).
  useEffect(() => {
    if (isLooking && (chat.isStreaming || chat.ttsIsPlaying)) {
      setIsLooking(false);
    }
  }, [isLooking, chat.isStreaming, chat.ttsIsPlaying]);

  // ─── Wake word engine ─────────────────────────────────────────────────────

  const {
    status: wakeWordStatus,
    errorReason: wakeWordError,
    start: wakeWordStart,
    stop: wakeWordStop,
  } = useWakeWord({
    baseUrl: "/openwakeword",
    onWake: () => {
      if (!enabledRef.current) return;
      // Synchronous latch — the worker can deliver detections back-to-back in
      // one tick, before the reducer state updates (live trace: double
      // "conversation open" raced two recognizer starts).
      if (conversationOpenRef.current || voiceStateRef.current !== "idle") {
        trace("wake.ignored", { state: voiceStateRef.current });
        return;
      }
      conversationOpenRef.current = true;
      trace("wake → conversation open");
      dispatch({ type: "WAKE" });
      setInterimText("");
      setFinalText("");
      restartTimesRef.current = [];
      longestInterimRef.current = "";
      longestInterimFromSpeakingRef.current = false;
      // A stale intentional-stop latch (set when teardown ran with NO live
      // recognizer to consume it) must never eat this session's keep-alive —
      // the live trace showed exactly that killing the restart.
      intentionalStopRef.current = false;
      recognizerStartedAtRef.current = Date.now();
      recognizerStartTriggerRef.current = "wake";
      recognitionStart();
      duplexStartRef.current(); // D-10: opens on the same wake as the 183 fallback
      resetSilenceTimer();
      // 188.3 D-05: wake → conversation open grants a bounded follow-up
      // window, mirroring the shipped policy at :1438 (wake phrase arriving
      // as transcript text already calls openFollowUpWindow() there) — this
      // is consistency with 188.1 D-02, not new policy. Guarded on
      // !strictModeRef.current because openFollowUpWindow()'s strict-ON
      // branch calls teardownConversation("stop") immediately, which would
      // tear down the conversation in the same tick the wake just opened it.
      if (!strictModeRef.current) openFollowUpWindow();
    },
    debug: VOICE_DEBUG,
  });

  // Gate the wake engine on `enabled` (VOX-04 — no mic unless explicitly on).
  // Start only from a clean 'idle'; NEVER auto-retry from 'error-disabled'
  // (stop() would reset to idle → start → fail → … an infinite retry storm).
  // Recovery from error: toggle off (resets to idle), then on.
  useEffect(() => {
    if (!enabled) {
      trace("mic.off → release everything");
      wakeWordStop();
      duplexStopRef.current(); // belt-and-suspenders: release the mic even mid-session
      endConversation("abort"); // release the recognizer mic instantly
    } else if (wakeWordStatus === "idle") {
      trace("mic.on → wake engine start");
      void wakeWordStart();
    }
    // loading / ready / error-disabled while enabled → do nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, wakeWordStatus]);

  // Mic toggle drives spoken replies: ON → her TTS auto-plays; OFF → silent.
  useEffect(() => {
    chatRef.current.setTtsEnabled(enabled);
  }, [enabled]);

  // Unmount: release everything (wake engine cleans itself up in useWakeWord).
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
      if (interruptFlashTimerRef.current) clearTimeout(interruptFlashTimerRef.current);
      if (silentTurnTimerRef.current) clearTimeout(silentTurnTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, []);

  return {
    voiceState,
    interimText,
    finalText,
    followUpOpen,
    followUpMs,
    showInterruptFlash,
    conversationActive: voiceState !== "idle" && voiceState !== "error-disabled",
    wakeWordStatus,
    wakeWordError,
    speechAvailable,
    isLooking,
    triggerBargeIn: handleBargeIn,
    filteredCount,
  };
}
