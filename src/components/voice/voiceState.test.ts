/**
 * voiceState.test.ts — Unit tests for the pure 6-state voice machine.
 *
 * Covers all 7 behavior points from the Phase 92 plan, plus Phase 183 Plan 02's
 * barge-in / strict-mode-aware follow-up-window extensions:
 * 1. listening + INTERIM_RESULT → transcribing
 * 2. transcribing + FINAL_RESULT → processing
 * 3. processing + TTS_START → speaking
 * 4. speaking + TTS_END(strictMode) → listening | idle
 * 5. idle/listening/transcribing/processing + END → idle
 * 6. any + ERROR → error-disabled
 * 7. isEndPhrase: "goodbye"/"thanks"/"that's all" → true; "stop" is barge-in
 *    only (presence-page decision 2026-07-20) → false
 * 8. speaking + BARGE_IN → transcribing; BARGE_IN elsewhere is a no-op
 * 9. speaking + END is a no-op (D-01) — no longer exits mid-reply
 * 10. listening + FOLLOW_UP_EXPIRE → idle; no-op elsewhere
 * 11. isBargeInPhrase / isStrictModeCommand pure matchers
 *
 * Phase 92, Plan 04 — TDD RED gate.
 * Phase 183, Plan 02 — CONV-01/CONV-02, D-01/D-02/D-03/D-05.
 */

import { describe, it, expect, vi } from "vitest";
import {
  voiceReducer,
  isEndPhrase,
  isBargeInPhrase,
  isPureBargeInPhrase,
  stripWakePhrase,
  isStrictModeCommand,
  isVisionIntentPhrase,
  decideVisionIntent,
  runVisionRefusal,
  runLostScreenAck,
  VISION_REFUSAL_TEXT,
  LOST_SCREEN_TEXT,
  CLIENT_VERB_REGISTRY,
  SWAP_MODEL_VERB,
  SWAP_VOICE_VERB,
  type VoiceState,
  type VoiceAction,
} from "./voiceState";

describe("isPureBargeInPhrase", () => {
  it('"stop" → true (whole utterance is the interrupt)', () => {
    expect(isPureBargeInPhrase("stop")).toBe(true);
  });

  it('"Stop." → true (normalized)', () => {
    expect(isPureBargeInPhrase("Stop.")).toBe(true);
  });

  it('"hold on" → true (multi-word phrase)', () => {
    expect(isPureBargeInPhrase("hold on")).toBe(true);
  });

  it('"stop the deploy" → false (content around the phrase — a real message)', () => {
    expect(isPureBargeInPhrase("stop the deploy")).toBe(false);
  });

  it('"okay wait" → false (not the whole utterance)', () => {
    expect(isPureBargeInPhrase("okay wait")).toBe(false);
  });

  it("empty → false", () => {
    expect(isPureBargeInPhrase("")).toBe(false);
  });
});

describe("voiceReducer", () => {
  it("listening + INTERIM_RESULT → transcribing", () => {
    const next = voiceReducer("listening", { type: "INTERIM_RESULT" });
    expect(next).toBe("transcribing");
  });

  it("transcribing + FINAL_RESULT → processing", () => {
    const next = voiceReducer("transcribing", { type: "FINAL_RESULT" });
    expect(next).toBe("processing");
  });

  it("processing + TTS_START → speaking", () => {
    const next = voiceReducer("processing", { type: "TTS_START" });
    expect(next).toBe("speaking");
  });

  it("speaking + TTS_END(strictMode:false) → listening (follow-up window opens)", () => {
    const next = voiceReducer("speaking", { type: "TTS_END", strictMode: false });
    expect(next).toBe("listening");
  });

  it("speaking + TTS_END(strictMode:true) → idle (strict mode, no lingering window)", () => {
    const next = voiceReducer("speaking", { type: "TTS_END", strictMode: true });
    expect(next).toBe("idle");
  });

  it("any state + END → idle (from listening)", () => {
    expect(voiceReducer("listening", { type: "END" })).toBe("idle");
  });

  it("any state + END → idle (from transcribing)", () => {
    expect(voiceReducer("transcribing", { type: "END" })).toBe("idle");
  });

  it("any state + END → idle (from processing)", () => {
    expect(voiceReducer("processing", { type: "END" })).toBe("idle");
  });

  it("D-01: speaking + END is a no-op — no longer exits mid-reply", () => {
    expect(voiceReducer("speaking", { type: "END" })).toBe("speaking");
  });

  it("D-01: speaking + BARGE_IN → transcribing (interrupt, instant)", () => {
    expect(voiceReducer("speaking", { type: "BARGE_IN" })).toBe("transcribing");
  });

  it("BARGE_IN is a no-op outside speaking (from listening)", () => {
    expect(voiceReducer("listening", { type: "BARGE_IN" })).toBe("listening");
  });

  it("BARGE_IN is a no-op outside speaking (from idle)", () => {
    expect(voiceReducer("idle", { type: "BARGE_IN" })).toBe("idle");
  });

  it("listening + FOLLOW_UP_EXPIRE → idle (silent, window timeout)", () => {
    expect(voiceReducer("listening", { type: "FOLLOW_UP_EXPIRE" })).toBe("idle");
  });

  it("FOLLOW_UP_EXPIRE is a no-op outside listening (from speaking)", () => {
    expect(voiceReducer("speaking", { type: "FOLLOW_UP_EXPIRE" })).toBe("speaking");
  });

  it("FOLLOW_UP_EXPIRE is a no-op outside listening (from idle)", () => {
    expect(voiceReducer("idle", { type: "FOLLOW_UP_EXPIRE" })).toBe("idle");
  });

  it("any state + ERROR → error-disabled (from listening)", () => {
    expect(voiceReducer("listening", { type: "ERROR" })).toBe("error-disabled");
  });

  it("any state + ERROR → error-disabled (from speaking)", () => {
    expect(voiceReducer("speaking", { type: "ERROR" })).toBe("error-disabled");
  });

  it("WAKE in idle → listening", () => {
    expect(voiceReducer("idle", { type: "WAKE" })).toBe("listening");
  });

  it("unrecognized transition returns current state", () => {
    // e.g. FINAL_RESULT while idle (no STT running) — stay idle
    expect(voiceReducer("idle", { type: "FINAL_RESULT" })).toBe("idle");
  });

  it("TTS_START from listening → speaking (typed message mid-conversation)", () => {
    expect(voiceReducer("listening", { type: "TTS_START" })).toBe("speaking");
  });

  it("TTS_START from transcribing → speaking", () => {
    expect(voiceReducer("transcribing", { type: "TTS_START" })).toBe("speaking");
  });

  it("TTS_START in idle stays idle (typed turn while armed — no echo risk, recognition off)", () => {
    expect(voiceReducer("idle", { type: "TTS_START" })).toBe("idle");
  });

  it("BARGE_IN from processing → transcribing ('stop' cancels a thinking turn)", () => {
    expect(voiceReducer("processing", { type: "BARGE_IN" })).toBe("transcribing");
  });

  it("TTS_END from processing → listening/idle (silent-turn watchdog close)", () => {
    expect(voiceReducer("processing", { type: "TTS_END", strictMode: false })).toBe("listening");
    expect(voiceReducer("processing", { type: "TTS_END", strictMode: true })).toBe("idle");
  });
});

describe("isEndPhrase", () => {
  it('"stop" → false (barge-in only — never ends the conversation)', () => {
    expect(isEndPhrase("stop")).toBe(false);
  });

  it('"goodbye" → true', () => {
    expect(isEndPhrase("goodbye")).toBe(true);
  });

  it('"thanks" → true', () => {
    expect(isEndPhrase("thanks")).toBe(true);
  });

  it('"thank you" → true (STT renders it both ways — both close gracefully)', () => {
    expect(isEndPhrase("thank you")).toBe(true);
  });

  it('"no I\'m good thank you" → true (ends with a close)', () => {
    expect(isEndPhrase("no I'm good thank you")).toBe(true);
  });

  it('"that\'s all" → true', () => {
    expect(isEndPhrase("that's all")).toBe(true);
  });

  it('case-insensitive: "STOP" → false (barge-in only)', () => {
    expect(isEndPhrase("STOP")).toBe(false);
  });

  it("case-insensitive: Goodbye → true", () => {
    expect(isEndPhrase("Goodbye")).toBe(true);
  });

  it("leading/trailing whitespace trimmed", () => {
    expect(isEndPhrase("  goodbye  ")).toBe(true);
  });

  it('"show me agents" → false', () => {
    expect(isEndPhrase("show me agents")).toBe(false);
  });

  it("empty string → false", () => {
    expect(isEndPhrase("")).toBe(false);
  });

  it("partial match → false", () => {
    expect(isEndPhrase("stopping now")).toBe(false);
  });
});

describe("isBargeInPhrase", () => {
  it('"Stop." → true (punctuation stripped)', () => {
    expect(isBargeInPhrase("Stop.")).toBe(true);
  });

  it('"hold on a moment" → true (mid-sentence filler)', () => {
    expect(isBargeInPhrase("hold on a moment")).toBe(true);
  });

  it('"please continue" → false', () => {
    expect(isBargeInPhrase("please continue")).toBe(false);
  });

  it('"Wait, wait —" → true (trailing 2-word "wait wait" filler)', () => {
    expect(isBargeInPhrase("Wait, wait —")).toBe(true);
  });

  it('"what is the weather" → false', () => {
    expect(isBargeInPhrase("what is the weather")).toBe(false);
  });

  it('"astridr" → true (name variant)', () => {
    expect(isBargeInPhrase("astridr")).toBe(true);
  });

  it('"hey astridr" → true (name variant, whole-utterance match)', () => {
    expect(isBargeInPhrase("hey astridr")).toBe(true);
  });

  it("empty string → false", () => {
    expect(isBargeInPhrase("")).toBe(false);
  });
});

describe("stripWakePhrase — STT wake-word variants (188.3-08)", () => {
  // Live evidence, 2026-08-07 session: 7 leaks in 10 wake-prefixed attempts.
  // Chrome rendered the spoken wake word as Alfred/Ashford/Astra, none of which
  // were in WAKE_PHRASES, so the whole address rode into the dispatched
  // message — and at 19:12:56 reached the model as a name ("It's Friday,
  // August 7th, 2026, Ashford.").
  it.each([
    ["Hey Alfred, what time is it?", "what time is it?"],
    ["Hey Ashford, what day is it?", "what day is it?"],
    ["Hey Astra, is there any news about Supabase?", "is there any news about Supabase?"],
    ["Hey Astrid, what's the weather today?", "what's the weather today?"],
  ])("strips the leading address in %j", (input, expected) => {
    const result = stripWakePhrase(input);
    expect(result.stripped).toBe(expected);
    expect(result.matched).not.toBeNull();
  });

  // CONTROL — the bare variants are deliberately NOT in WAKE_PHRASES.
  // stripWakePhrase is leading-only, so a bare "alfred" entry would eat the
  // first word of a real sentence about a person named Alfred.
  it.each([
    "Alfred called me yesterday about the contract.",
    "Ashford is the name of the street.",
    "Astra Zeneca published new trial data.",
  ])("leaves a leading bare variant untouched: %j", (input) => {
    const result = stripWakePhrase(input);
    expect(result.stripped).toBe(input);
    expect(result.matched).toBeNull();
  });
});

describe("stripWakePhrase", () => {
  it('"Hey Astrid." → whole utterance is the wake phrase: stripped is empty, matched is non-null', () => {
    const result = stripWakePhrase("Hey Astrid.");
    expect(result.stripped).toBe("");
    expect(result.matched).not.toBeNull();
  });

  it('WAKE-2 corpus string strips to the exact question text (188.1-CALIBRATION.md, verbatim)', () => {
    const result = stripWakePhrase(
      "Hey Astrid. What's the weather like tomorrow in Cumming, Georgia?"
    );
    expect(result.stripped).toBe("What's the weather like tomorrow in Cumming, Georgia?");
    expect(result.matched).not.toBeNull();
  });

  it('"Hey Ástríðr, what\'s on my screen?" → the diacritic spelling is matched and stripped', () => {
    const result = stripWakePhrase("Hey Ástríðr, what's on my screen?");
    expect(result.stripped).toBe("what's on my screen?");
    expect(result.matched).not.toBeNull();
  });

  it('"stop" → returned UNCHANGED, no wake match (interrupt phrase, not a wake phrase)', () => {
    const result = stripWakePhrase("stop");
    expect(result.stripped).toBe("stop");
    expect(result.matched).toBeNull();
  });

  it('"wait" → returned UNCHANGED, no wake match (interrupt phrase, not a wake phrase)', () => {
    const result = stripWakePhrase("wait");
    expect(result.stripped).toBe("wait");
    expect(result.matched).toBeNull();
  });

  it('"What did Astrid say about the roadmap?" → returned UNCHANGED (mid-sentence, not an address)', () => {
    const result = stripWakePhrase("What did Astrid say about the roadmap?");
    expect(result.stripped).toBe("What did Astrid say about the roadmap?");
    expect(result.matched).toBeNull();
  });

  it("empty string → returned unchanged, no throw", () => {
    expect(() => stripWakePhrase("")).not.toThrow();
    const result = stripWakePhrase("");
    expect(result.stripped).toBe("");
    expect(result.matched).toBeNull();
  });

  it("whitespace-only string → returned unchanged, no throw", () => {
    expect(() => stripWakePhrase("   ")).not.toThrow();
    const result = stripWakePhrase("   ");
    expect(result.stripped).toBe("   ");
    expect(result.matched).toBeNull();
  });

  it("return shape distinguishes 'no match' from 'matched, remainder empty'", () => {
    const noMatch = stripWakePhrase("What did Astrid say about the roadmap?");
    const wholeMatch = stripWakePhrase("Hey Astrid.");
    // no-match branch: matched is null, stripped is the untouched original text
    expect(noMatch.matched).toBeNull();
    expect(noMatch.stripped).toBe("What did Astrid say about the roadmap?");
    // matched-but-empty branch: matched is non-null, stripped is empty —
    // a bare string return could never distinguish this from "no match" if
    // the original text itself happened to be empty.
    expect(wholeMatch.matched).not.toBeNull();
    expect(wholeMatch.stripped).toBe("");
  });
});

describe("isStrictModeCommand", () => {
  it('"strict mode on" → "on"', () => {
    expect(isStrictModeCommand("strict mode on")).toBe("on");
  });

  it('"enable strict mode" → "on"', () => {
    expect(isStrictModeCommand("enable strict mode")).toBe("on");
  });

  it('"turn on strict mode" → "on"', () => {
    expect(isStrictModeCommand("turn on strict mode")).toBe("on");
  });

  it('"strict mode off" → "off"', () => {
    expect(isStrictModeCommand("strict mode off")).toBe("off");
  });

  it('"disable strict mode" → "off"', () => {
    expect(isStrictModeCommand("disable strict mode")).toBe("off");
  });

  it('"turn off strict mode" → "off"', () => {
    expect(isStrictModeCommand("turn off strict mode")).toBe("off");
  });

  it('"hello there" → null (no match)', () => {
    expect(isStrictModeCommand("hello there")).toBe(null);
  });

  it("empty string → null", () => {
    expect(isStrictModeCommand("")).toBe(null);
  });

  it("case-insensitive: STRICT MODE ON → \"on\"", () => {
    expect(isStrictModeCommand("STRICT MODE ON")).toBe("on");
  });
});

describe("isVisionIntentPhrase (D-01 client fast-path)", () => {
  it('"what\'s on my screen" → true', () => {
    expect(isVisionIntentPhrase("what's on my screen")).toBe(true);
  });

  it('"look at this" → true', () => {
    expect(isVisionIntentPhrase("look at this")).toBe(true);
  });

  it('"what do you see" → true', () => {
    expect(isVisionIntentPhrase("what do you see")).toBe(true);
  });

  it('"read this" → true', () => {
    expect(isVisionIntentPhrase("read this")).toBe(true);
  });

  it('"okay, what do you see" → true (filler prefix + STT punctuation)', () => {
    expect(isVisionIntentPhrase("Okay, what do you see?")).toBe(true);
  });

  it('"what is the weather" → false (near-miss, unrelated utterance)', () => {
    expect(isVisionIntentPhrase("what is the weather")).toBe(false);
  });

  it("empty string → false", () => {
    expect(isVisionIntentPhrase("")).toBe(false);
  });

  it("whitespace-only → false", () => {
    expect(isVisionIntentPhrase("   ")).toBe(false);
  });

  // 184-08 live-verification regression: the exact-phrase/trailing-only
  // matcher missed EVERY natural phrasing in the live UAT (2026-07-21) — the
  // fast-path never fired all day; every turn fell through to see_screen.
  // These are Larry's real utterances from the session.
  it('"what is on my screen" → true (STT expands the contraction)', () => {
    expect(isVisionIntentPhrase("What is on my screen?")).toBe(true);
  });

  it('"what do you see on the screen i am sharing" → true (trailing words)', () => {
    expect(isVisionIntentPhrase("what do you see on the screen i am sharing")).toBe(true);
  });

  it('"what do you see on the tab that i shared with you" → true', () => {
    expect(isVisionIntentPhrase("what do you see on the tab that I shared with you")).toBe(true);
  });

  it('"did you see the screenshots i saved yesterday" → false (screenshots ≠ screen token)', () => {
    expect(isVisionIntentPhrase("did you see the screenshots i saved yesterday")).toBe(false);
  });
});

describe("decideVisionIntent (D-01/D-02/D-03 pure branch selection)", () => {
  it('vision phrase + shareActive=true → "capture"', () => {
    expect(decideVisionIntent("what do you see", true)).toBe("capture");
  });

  it('vision phrase + shareActive=false → "refuse"', () => {
    expect(decideVisionIntent("what do you see", false)).toBe("refuse");
  });

  it("non-vision phrase → null regardless of share state", () => {
    expect(decideVisionIntent("what is the weather", true)).toBe(null);
    expect(decideVisionIntent("what is the weather", false)).toBe(null);
  });

  it("empty string → null", () => {
    expect(decideVisionIntent("", true)).toBe(null);
  });

  // 184-08: strength tiering. STRONG matches (unambiguous screen phrases /
  // the original literal list) refuse when no share is active (D-03). WEAK
  // co-occurrence matches (screen-word + look-word, e.g. "shared" + "look")
  // capture when a share is active but fall through to the normal pipeline
  // (null) when none is — a false positive must never produce a wrong
  // "I can't see your screen" refusal.
  it('strong: "what is on my screen" + no share → "refuse"', () => {
    expect(decideVisionIntent("what is on my screen", false)).toBe("refuse");
  });

  it('strong: "what do you see on the screen i am sharing" + share → "capture"', () => {
    expect(decideVisionIntent("what do you see on the screen i am sharing", true)).toBe("capture");
  });

  it('weak: "can you look at what i shared" + share → "capture"', () => {
    expect(decideVisionIntent("can you look at what I shared", true)).toBe("capture");
  });

  it('weak: "can you look at what i shared" + no share → null (no wrong refusal)', () => {
    expect(decideVisionIntent("can you look at what I shared", false)).toBe(null);
  });
});

describe("runVisionRefusal (D-03 — spoken AND written, never voice-only)", () => {
  it("speaks and writes the exact locked refusal copy, then arms the control", () => {
    const speak = vi.fn();
    const appendLocalAssistantMessage = vi.fn();
    const arm = vi.fn();
    runVisionRefusal({ speak, appendLocalAssistantMessage, arm });
    expect(speak).toHaveBeenCalledWith(VISION_REFUSAL_TEXT);
    expect(appendLocalAssistantMessage).toHaveBeenCalledWith(VISION_REFUSAL_TEXT);
    expect(arm).toHaveBeenCalledOnce();
  });

  it("locked copy is exactly the D-03 string", () => {
    expect(VISION_REFUSAL_TEXT).toBe("I can't see your screen — start a share and ask again.");
  });
});

describe("runLostScreenAck (D-11 — spoken AND written, never voice-only)", () => {
  it("speaks and writes the exact locked lost-screen copy", () => {
    const speak = vi.fn();
    const appendLocalAssistantMessage = vi.fn();
    runLostScreenAck({ speak, appendLocalAssistantMessage });
    expect(speak).toHaveBeenCalledWith(LOST_SCREEN_TEXT);
    expect(appendLocalAssistantMessage).toHaveBeenCalledWith(LOST_SCREEN_TEXT);
  });

  it("locked copy is exactly the D-11 default string", () => {
    expect(LOST_SCREEN_TEXT).toBe("Looks like I lost your screen.");
  });
});

describe("CLIENT_VERB_REGISTRY (D-09, Phase 185 Plan 06)", () => {
  it("registers strict_mode, vision_intent, swap_model, swap_voice", () => {
    const names = CLIENT_VERB_REGISTRY.map((v) => v.name);
    expect(names).toEqual(["strict_mode", "vision_intent", "swap_model", "swap_voice"]);
  });
});

describe("SWAP_MODEL_VERB (SWAP-01 client target extraction)", () => {
  it('"try on grok" → { target: "grok" }', () => {
    expect(SWAP_MODEL_VERB.match("try on grok")).toEqual({ target: "grok" });
  });

  it('"try on grok 3 mini" → { target: "grok 3 mini" }', () => {
    expect(SWAP_MODEL_VERB.match("try on grok 3 mini")).toEqual({ target: "grok 3 mini" });
  });

  it('"Try on GPT-5." → { target: "gpt 5" } (normalized)', () => {
    expect(SWAP_MODEL_VERB.match("Try on GPT-5.")).toEqual({ target: "gpt 5" });
  });

  it('"switch your brain to grok" → { target: "grok" }', () => {
    expect(SWAP_MODEL_VERB.match("switch your brain to grok")).toEqual({ target: "grok" });
  });

  it('"back to your usual brain" → { restore: "true" }', () => {
    expect(SWAP_MODEL_VERB.match("back to your usual brain")).toEqual({ restore: "true" });
  });

  it('"go back to your usual brain" → { restore: "true" }', () => {
    expect(SWAP_MODEL_VERB.match("go back to your usual brain")).toEqual({ restore: "true" });
  });

  // 185-08 live finding: natural phrasings + leading politeness word.
  it('"change your brain to a Gemini model" → { target: "a gemini model" }', () => {
    expect(SWAP_MODEL_VERB.match("change your brain to a Gemini model")).toEqual({
      target: "a gemini model",
    });
  });

  it('"please move yourself over to a grok brain" → { target: "a grok brain" }', () => {
    expect(SWAP_MODEL_VERB.match("please move yourself over to a grok brain")).toEqual({
      target: "a grok brain",
    });
  });

  it('"please try on grok" → { target: "grok" } (leading please stripped)', () => {
    expect(SWAP_MODEL_VERB.match("please try on grok")).toEqual({ target: "grok" });
  });

  // 186-01 follow-up (Defect C, fresh live trace, 186-09 swap testing): STT
  // joined "try on" into one word ("Tryon"), defeating the prefix match
  // entirely — no client fast-path dispatch fired for a real "try on grok"
  // utterance. normalize()'s grammar-join fix un-joins it; the mis-heard
  // TARGET name itself ("Rock" for "grok") is deliberately left un-aliased —
  // the backend's fuzzy resolver + honest refusal own that (D-08).
  it('"Tryon grok" (STT join) → { target: "grok" }', () => {
    expect(SWAP_MODEL_VERB.match("Tryon grok")).toEqual({ target: "grok" });
  });

  it('"Tryon Rock" (STT join + misheard target) → { target: "rock" } — target NOT aliased to "grok" client-side', () => {
    expect(SWAP_MODEL_VERB.match("Tryon Rock")).toEqual({ target: "rock" });
  });

  it('"what\'s the weather" → null', () => {
    expect(SWAP_MODEL_VERB.match("what's the weather")).toBe(null);
  });

  it("empty string → null", () => {
    expect(SWAP_MODEL_VERB.match("")).toBe(null);
  });

  it("no fetch/await inside the matcher body (pure — no network)", () => {
    const src = SWAP_MODEL_VERB.match.toString();
    expect(src).not.toMatch(/fetch|await/);
  });
});

describe("SWAP_VOICE_VERB (SWAP-02 client target extraction)", () => {
  it('"switch your voice to rachel" → { target: "rachel" }', () => {
    expect(SWAP_VOICE_VERB.match("switch your voice to rachel")).toEqual({ target: "rachel" });
  });

  it('"change your voice to rachel" → { target: "rachel" }', () => {
    expect(SWAP_VOICE_VERB.match("change your voice to rachel")).toEqual({ target: "rachel" });
  });

  it('"back to your usual voice" → { restore: "true" }', () => {
    expect(SWAP_VOICE_VERB.match("back to your usual voice")).toEqual({ restore: "true" });
  });

  it('"switch back to your usual voice" → { restore: "true" }', () => {
    expect(SWAP_VOICE_VERB.match("switch back to your usual voice")).toEqual({ restore: "true" });
  });

  it('"play some music" → null', () => {
    expect(SWAP_VOICE_VERB.match("play some music")).toBe(null);
  });

  it("empty string → null", () => {
    expect(SWAP_VOICE_VERB.match("")).toBe(null);
  });

  it("no fetch/await inside the matcher body (pure — no network)", () => {
    const src = SWAP_VOICE_VERB.match.toString();
    expect(src).not.toMatch(/fetch|await/);
  });
});

describe("type exports", () => {
  it("VoiceState union includes all 6 states", () => {
    // Type-level test — just verify the values are valid VoiceState
    const states: VoiceState[] = [
      "idle",
      "listening",
      "transcribing",
      "processing",
      "speaking",
      "error-disabled",
    ];
    expect(states).toHaveLength(6);
  });

  it("VoiceAction types are callable", () => {
    const actions: VoiceAction[] = [
      { type: "WAKE" },
      { type: "INTERIM_RESULT" },
      { type: "FINAL_RESULT" },
      { type: "TTS_START" },
      { type: "TTS_END", strictMode: false },
      { type: "BARGE_IN" },
      { type: "FOLLOW_UP_EXPIRE" },
      { type: "END" },
      { type: "ERROR" },
    ];
    expect(actions).toHaveLength(9);
  });
});
