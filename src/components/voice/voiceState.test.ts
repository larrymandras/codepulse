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
  isStrictModeCommand,
  isVisionIntentPhrase,
  decideVisionIntent,
  runVisionRefusal,
  runLostScreenAck,
  VISION_REFUSAL_TEXT,
  LOST_SCREEN_TEXT,
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
