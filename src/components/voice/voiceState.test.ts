/**
 * voiceState.test.ts — Unit tests for the pure 6-state voice machine.
 *
 * Covers all 7 behavior points from the plan:
 * 1. listening + INTERIM_RESULT → transcribing
 * 2. transcribing + FINAL_RESULT → processing
 * 3. processing + TTS_START → speaking
 * 4. speaking + TTS_END → listening (next turn)
 * 5. any + END → idle
 * 6. any + ERROR → error-disabled
 * 7. isEndPhrase: "stop"/"goodbye"/"thanks"/"that's all" → true; others → false
 *
 * Phase 92, Plan 04 — TDD RED gate.
 */

import { describe, it, expect } from "vitest";
import {
  voiceReducer,
  isEndPhrase,
  type VoiceState,
  type VoiceAction,
} from "./voiceState";

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

  it("speaking + TTS_END → listening (continuous next turn)", () => {
    const next = voiceReducer("speaking", { type: "TTS_END" });
    expect(next).toBe("listening");
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

  it("any state + END → idle (from speaking)", () => {
    expect(voiceReducer("speaking", { type: "END" })).toBe("idle");
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
});

describe("isEndPhrase", () => {
  it('"stop" → true', () => {
    expect(isEndPhrase("stop")).toBe(true);
  });

  it('"goodbye" → true', () => {
    expect(isEndPhrase("goodbye")).toBe(true);
  });

  it('"thanks" → true', () => {
    expect(isEndPhrase("thanks")).toBe(true);
  });

  it('"that\'s all" → true', () => {
    expect(isEndPhrase("that's all")).toBe(true);
  });

  it("case-insensitive: STOP → true", () => {
    expect(isEndPhrase("STOP")).toBe(true);
  });

  it("case-insensitive: Goodbye → true", () => {
    expect(isEndPhrase("Goodbye")).toBe(true);
  });

  it("leading/trailing whitespace trimmed", () => {
    expect(isEndPhrase("  stop  ")).toBe(true);
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
      { type: "TTS_END" },
      { type: "END" },
      { type: "ERROR" },
    ];
    expect(actions).toHaveLength(7);
  });
});
