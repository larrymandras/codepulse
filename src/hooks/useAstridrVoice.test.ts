/**
 * useAstridrVoice.test.ts — behavioral tests for the wake-word-armed presence
 * voice engine. Ports the live-verified VoiceModePanel behavior surface
 * (CONV-01/02/03, D-05..D-12) onto the hook:
 *
 *  1. enabled → wake engine started; disabled → stopped + recognizer aborted
 *  2. wake → conversation opens (listening) + recognition starts
 *  3. cold noise gate: <3-word fragment never sends
 *  4. accepted utterance sends after the 2s pause-to-send debounce
 *  5. mid-thought pause: two finals accumulate into ONE send
 *  6. interim "stop" during speaking → chat.interrupt() + partial reply rides
 *     into the next send as interruptedReply; trailing final "stop" swallowed
 *     and the conversation does NOT end
 *  7. pure "stop" while thinking cancels the turn; never sent as a message
 *  8. "goodbye" ends the conversation (re-arms) — recognition stopped
 *  9. 30s silence re-arms
 * 10. follow-up window opens after TTS ends (strict off); short reply accepted
 *     while warm; 14s expiry re-arms
 * 11. spoken "strict mode on" → onStrictModeChange(true), no send
 * 12. mic toggle drives chat.setTtsEnabled
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useAstridrVoice,
  isEchoOfReply,
  stripEchoPrefix,
  isResidualEcho,
  appendWithOverlapCheck,
} from "./useAstridrVoice";
import type { AstridrChat } from "./useAstridrChat";

// ─── Echo fingerprint units (16:41 live-trace regressions) ───────────────────

describe("isEchoOfReply", () => {
  it("catches STT spelling variants — 'all right' vs her 'Alright,' (the false-barge cut-off)", () => {
    expect(isEchoOfReply("all right I'm", "Alright, I'm here if you need me.")).toBe(true);
  });

  it("verbatim echo of her reply → true", () => {
    expect(
      isEchoOfReply("rain showers near ninety degrees", "Tomorrow brings rain showers near ninety degrees")
    ).toBe(true);
  });

  it("a real 2-word user interjection is NOT echo ('also sorry' worked live)", () => {
    expect(isEchoOfReply("also sorry", "Let me check your calendar for today.")).toBe(false);
  });

  it("tiny STT shards of her own sentence are echo — 's in' must not barge (18:50 false cut-off)", () => {
    expect(isEchoOfReply("s in", "You have two entries in your personal calendar.")).toBe(true);
  });

  it("single word → treated as echo (explicit barge-in phrases cover short interrupts)", () => {
    expect(isEchoOfReply("no", "anything at all")).toBe(true);
  });
});

describe("stripEchoPrefix", () => {
  const HER = "You're welcome. Is there anything else I can assist you with?";

  it("strips her glued echo and keeps the user's answer (the live mashup)", () => {
    expect(
      stripEchoPrefix(
        "you're welcome is there anything else I can assist you with no I'm good thank you",
        HER
      )
    ).toBe("no I'm good thank you");
  });

  it("pure echo → empty string", () => {
    expect(stripEchoPrefix("you're welcome is there anything else I", HER)).toBe("");
  });

  it("pure user speech is untouched", () => {
    expect(stripEchoPrefix("what about tomorrow evening", HER)).toBe("what about tomorrow evening");
  });
});

describe("isResidualEcho", () => {
  const HER = "I found three unread emails in your personal email inbox.";

  it("a bare word from her reply is residue ('email' got sent live)", () => {
    expect(isResidualEcho("email", HER)).toBe(true);
  });

  it("a short answer NOT in her reply survives ('no')", () => {
    expect(isResidualEcho("no", HER)).toBe(false);
  });

  it("longer remainders are trusted to the prefix-stripper", () => {
    expect(isResidualEcho("emails in your personal inbox please", HER)).toBe(false);
  });
});

// ─── appendWithOverlapCheck (188.1-06, D-06/D-07/D-08) ────────────────────────

describe("appendWithOverlapCheck", () => {
  it("subsume, forward: a longer incoming piece that contains the existing one is returned verbatim", () => {
    const result = appendWithOverlapCheck(
      "what does my business calendar look like today",
      "business calendar"
    );
    expect(result).toEqual({
      text: "what does my business calendar look like today",
      decision: "subsumed",
    });
  });

  it("subsume, reverse: when the incoming piece contains the existing one, the longer incoming is returned verbatim (the compounding-case shape)", () => {
    const result = appendWithOverlapCheck(
      "Is there anything on my",
      "is there anything on my Consulting calendar for"
    );
    expect(result).toEqual({
      text: "is there anything on my Consulting calendar for",
      decision: "subsumed",
    });
  });

  it("subsume tolerates STT casing/punctuation variation via the squashed comparison", () => {
    const result = appendWithOverlapCheck(
      "What does my business calendar look like?",
      "what does my business calendar look like today"
    );
    expect(result).toEqual({
      text: "what does my business calendar look like today",
      decision: "subsumed",
    });
  });

  it("subsumes on the GLUE-COMPOUND row's outer containment (188.1-CALIBRATION.md Measured Subsume Surpluses)", () => {
    // Subsume table row `GLUE-COMPOUND`: containing side = final2 as OBSERVED
    // PRE-FIX (still carrying its own inner duplication), contained side =
    // final1 -- proving the outer subsume branch alone, independent of
    // whether the inner rejoin trim has already run.
    const result = appendWithOverlapCheck(
      "Is there anything on my",
      "is there anything on my Consulting calendar for Consulting calendar today?"
    );
    expect(result.decision).toBe("subsumed");
    expect(result.text).toBe(
      "is there anything on my Consulting calendar for Consulting calendar today?"
    );
  });

  it("CTRL-REPEAT: two verbatim equal finals both survive (188.1-CALIBRATION.md Over-Block Controls)", () => {
    const result = appendWithOverlapCheck("Right now.", "Right now.");
    expect(result).toEqual({ text: "Right now. Right now.", decision: "repeat-preserved" });
  });

  it("general identity: for a sample string s, appendWithOverlapCheck(s, s).text equals `${s} ${s}`", () => {
    const s = "Access to the calendar";
    const result = appendWithOverlapCheck(s, s);
    expect(result.text).toBe(`${s} ${s}`);
    expect(result.decision).toBe("repeat-preserved");
  });

  it("repeat preserved on near-equal squashed forms (casing/punctuation differ, zero surplus)", () => {
    const result = appendWithOverlapCheck("Today.", "today");
    expect(result).toEqual({ text: "Today. today", decision: "repeat-preserved" });
  });

  it("trims a genuine tail-of-existing/head-of-incoming overlap, keeping the span exactly once", () => {
    const result = appendWithOverlapCheck(
      "I need to go to the store",
      "the store today"
    );
    expect(result).toEqual({ text: "I need to go to the store today", decision: "trimmed" });
    const matches = result.text.toLowerCase().match(/the store/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("trims the GLUE-B rejoin overlap (188.1-CALIBRATION.md Measured Overlaps)", () => {
    const result = appendWithOverlapCheck(
      "do you have access to higgsfield",
      "Access to Higgs Field CLI"
    );
    expect(result).toEqual({
      text: "do you have Access to Higgs Field CLI",
      decision: "trimmed",
    });
  });

  it("trims the GLUE-COMPOUND-inner rejoin overlap even with a trailing existing-side word after the match (188.1-CALIBRATION.md Measured Overlaps)", () => {
    const result = appendWithOverlapCheck(
      "is there anything on my Consulting calendar for",
      "Consulting calendar today?"
    );
    expect(result).toEqual({
      text: "is there anything on my Consulting calendar for today?",
      decision: "trimmed",
    });
  });

  it("an overlap shorter than MIN_OVERLAP_WORDS is NOT trimmed -- decision joined, both pieces intact", () => {
    const result = appendWithOverlapCheck("I want to go", "go home now");
    expect(result.decision).toBe("joined");
    expect(result.text).toBe("I want to go go home now");
  });

  it("plain join fallback: no containment and no qualifying overlap", () => {
    const result = appendWithOverlapCheck("what's on my calendar", "remind me at noon");
    expect(result).toEqual({
      text: "what's on my calendar remind me at noon",
      decision: "joined",
    });
  });

  it("degenerate inputs: empty/whitespace-only existing or incoming never throw", () => {
    expect(appendWithOverlapCheck("", "hello there")).toEqual({
      text: "hello there",
      decision: "joined",
    });
    expect(appendWithOverlapCheck("   ", "hello there")).toEqual({
      text: "hello there",
      decision: "joined",
    });
    expect(appendWithOverlapCheck("hello there", "")).toEqual({
      text: "hello there",
      decision: "joined",
    });
    expect(appendWithOverlapCheck("hello there", "   ")).toEqual({
      text: "hello there",
      decision: "joined",
    });
    expect(() => appendWithOverlapCheck("", "")).not.toThrow();
  });
});

// ─── useWakeWord mock ─────────────────────────────────────────────────────────

let onWakeCallback: (() => void) | null = null;
let mockWakeStatus = "ready";
const mockWakeStart = vi.fn(async () => {});
const mockWakeStop = vi.fn();

vi.mock("@/hooks/useWakeWord", () => ({
  useWakeWord: vi.fn((opts: { onWake: () => void }) => {
    onWakeCallback = opts.onWake;
    return {
      status: mockWakeStatus,
      errorReason: null,
      start: mockWakeStart,
      stop: mockWakeStop,
    };
  }),
}));

// ─── useSpeechRecognition mock ────────────────────────────────────────────────

const mockRecognitionStart = vi.fn();
const mockRecognitionStop = vi.fn();
const mockRecognitionAbort = vi.fn();
let onFinalResultCallback: ((text: string, confidence?: number) => void) | null = null;
let onInterimResultCallback: ((text: string) => void) | null = null;
let onRecognitionEndCallback: (() => void) | null = null;

vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: vi.fn(
    (options: {
      onFinalResult: (text: string, confidence?: number) => void;
      onInterimResult?: (text: string) => void;
      onEnd?: () => void;
    }) => {
      onFinalResultCallback = options.onFinalResult;
      onInterimResultCallback = options.onInterimResult ?? null;
      onRecognitionEndCallback = options.onEnd ?? null;
      return {
        start: mockRecognitionStart,
        stop: mockRecognitionStop,
        abort: mockRecognitionAbort,
        isListening: false,
        speechAvailable: true,
      };
    }
  ),
}));

// ─── useDuplexEars mock (188-03, D-04/D-08) ──────────────────────────────────
// useDuplexEars.ts does not exist yet -- it lands in 188-05, and 188-08 wires
// it into useAstridrVoice.ts. This mock's shape anticipates that contract
// (see 188-03-PLAN.md § interfaces) so the barge-in/dispatch reuse cases
// below are executable NOW and turn green the moment both land, without a
// second edit to this harness.

let onDuplexSpeechStartCallback: (() => void) | null = null;
let onDuplexFinalTranscriptCallback: ((text: string, durationMs?: number) => void) | null = null;
let onDuplexUnavailableCallback: ((reason: string) => void) | null = null;
let onDuplexSessionEndCallback: ((info: { seconds: number }) => void) | null = null;
const mockDuplexStart = vi.fn();
const mockDuplexStop = vi.fn();
let duplexStatusValue: "idle" | "connecting" | "connected" | "unavailable" = "idle";

vi.mock("@/hooks/useDuplexEars", () => ({
  useDuplexEars: vi.fn(
    (options: {
      onSpeechStart: () => void;
      onFinalTranscript: (text: string, durationMs?: number) => void;
      onUnavailable: (reason: string) => void;
      onSessionEnd: (info: { seconds: number }) => void;
      enabled: boolean;
    }) => {
      onDuplexSpeechStartCallback = options.onSpeechStart;
      onDuplexFinalTranscriptCallback = options.onFinalTranscript;
      onDuplexUnavailableCallback = options.onUnavailable;
      onDuplexSessionEndCallback = options.onSessionEnd;
      return {
        start: mockDuplexStart,
        stop: mockDuplexStop,
        status: duplexStatusValue,
      };
    }
  ),
}));

// ─── astridrApi mock (188-08 Task 3, usage reporting) ────────────────────────

const mockReportRealtimeUsage = vi.fn(async (_seconds: number) => {});

vi.mock("@/lib/astridrApi", () => ({
  // Wrapped (not referenced directly) so the reference resolves lazily, at
  // call time -- by which time mockReportRealtimeUsage is initialized. A
  // direct reference here is evaluated the instant this factory runs, which
  // (unlike the useWakeWord/useDuplexEars mocks above, whose mock-prefixed
  // fns are only reached inside a nested closure invoked at render time) is
  // during the SUT's own top-level import chain -- before this file's own
  // `const mockReportRealtimeUsage = ...` has executed.
  reportRealtimeUsage: (...args: [number]) => mockReportRealtimeUsage(...args),
}));

// ─── Fake chat engine ─────────────────────────────────────────────────────────

function makeChat(overrides: Partial<AstridrChat> = {}): AstridrChat {
  return {
    status: "connected",
    messages: [],
    sendMessage: vi.fn(async () => {}),
    isStreaming: false,
    ttsEnabled: false,
    setTtsEnabled: vi.fn(),
    playAudio: vi.fn(),
    stopAudio: vi.fn(),
    ttsIsPlaying: false,
    interrupt: vi.fn(() => ""),
    handleApprove: vi.fn(),
    handleReject: vi.fn(),
    activeSessionRef: { current: null },
    streamingReplyRef: { current: "" },
    ...overrides,
  } as unknown as AstridrChat;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderVoice(chat: AstridrChat, opts: Partial<Parameters<typeof useAstridrVoice>[0]> = {}) {
  return renderHook(
    (props: { chat: AstridrChat; enabled: boolean; strictMode?: boolean; onStrictModeChange?: (v: boolean) => void }) =>
      useAstridrVoice(props),
    { initialProps: { chat, enabled: true, ...opts } }
  );
}

/** Wake + move into a live conversation. */
function wake() {
  act(() => {
    onWakeCallback?.();
  });
}

/** Simulate her TTS starting/stopping by re-rendering with a new chat object. */
function setTtsPlaying(
  rerender: (props: { chat: AstridrChat; enabled: boolean; strictMode?: boolean; onStrictModeChange?: (v: boolean) => void }) => void,
  chat: AstridrChat,
  playing: boolean,
  enabled = true
): AstridrChat {
  const next = makeChat({
    ...(chat as unknown as Record<string, unknown>),
    ttsIsPlaying: playing,
  } as Partial<AstridrChat>);
  act(() => {
    rerender({ chat: next, enabled });
  });
  return next;
}

describe("useAstridrVoice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWakeStatus = "ready";
    onWakeCallback = null;
    onFinalResultCallback = null;
    onInterimResultCallback = null;
    onRecognitionEndCallback = null;
    onDuplexSpeechStartCallback = null;
    onDuplexFinalTranscriptCallback = null;
    onDuplexUnavailableCallback = null;
    onDuplexSessionEndCallback = null;
    duplexStatusValue = "idle";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── 1. Enable/disable gating ──────────────────────────────────────────────

  it("starts the wake engine when enabled and engine is idle", () => {
    mockWakeStatus = "idle";
    renderVoice(makeChat());
    expect(mockWakeStart).toHaveBeenCalled();
  });

  it("disabling stops the wake engine, aborts the recognizer, re-arms idle, and disables TTS", () => {
    const chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();
    expect(result.current.voiceState).toBe("listening");

    act(() => {
      rerender({ chat, enabled: false });
    });
    expect(mockWakeStop).toHaveBeenCalled();
    expect(mockRecognitionAbort).toHaveBeenCalled();
    expect(result.current.voiceState).toBe("idle");
    expect(chat.setTtsEnabled).toHaveBeenLastCalledWith(false);
  });

  it("mic toggle ON drives chat.setTtsEnabled(true)", () => {
    const chat = makeChat();
    renderVoice(chat);
    expect(chat.setTtsEnabled).toHaveBeenLastCalledWith(true);
  });

  // ─── 2. Wake opens a conversation ──────────────────────────────────────────

  it("wake → listening + recognition starts", () => {
    const { result } = renderVoice(makeChat());
    expect(result.current.voiceState).toBe("idle");
    wake();
    expect(result.current.voiceState).toBe("listening");
    expect(mockRecognitionStart).toHaveBeenCalled();
    expect(result.current.conversationActive).toBe(true);
  });

  it("wake while disabled is ignored", () => {
    const chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    act(() => {
      rerender({ chat, enabled: false });
    });
    wake();
    expect(result.current.voiceState).toBe("idle");
  });

  // ─── 3/4/5. Noise gate + pause-to-send ─────────────────────────────────────

  it("cold <3-word fragment is rejected — nothing sends", async () => {
    // 188.3 D-05/D-17: wake() alone now opens a bounded follow-up window
    // (minWords = 1), so this fixture's COLD intent can no longer rely on
    // wake() being non-warming. Repaired per D-17's cold-window requirement
    // by removing the wake() call outright — firing onFinalResultCallback
    // directly still reaches the same gate chain (proven by this plan's own
    // CTRL-NOWAKE control) without opening any window. Advancing fake timers
    // past FOLLOW_UP_WINDOW_MS instead was considered and rejected: the
    // window's own expiry calls teardownConversation("stop"), which would
    // make this fixture pass for the wrong reason.
    const chat = makeChat();
    renderVoice(chat);
    act(() => {
      onFinalResultCallback?.("hello there");
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("accepted utterance sends after the 2s debounce", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onFinalResultCallback?.("what's the weather like tomorrow");
    });
    expect(chat.sendMessage).not.toHaveBeenCalled(); // debounce pending
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "what's the weather like tomorrow",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  it("mid-thought pause: two finals accumulate into one send", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onFinalResultCallback?.("remind me to call the vet");
    });
    await act(async () => {
      vi.advanceTimersByTime(1000); // < debounce — user resumes
    });
    act(() => {
      onInterimResultCallback?.("tomorrow at"); // resuming cancels pending send
      onFinalResultCallback?.("tomorrow at nine am");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "remind me to call the vet tomorrow at nine am",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
  });

  // ─── 6. Barge-in during speaking ───────────────────────────────────────────

  it("interim 'stop' during speaking interrupts; partial rides into next send; conversation survives the trailing final", async () => {
    let chat = makeChat({ interrupt: vi.fn(() => "partial reply so far") });
    const { result, rerender } = renderVoice(chat);
    wake();
    // She starts speaking
    chat = setTtsPlaying(rerender, chat, true);
    expect(result.current.voiceState).toBe("speaking");

    // Interim "stop" → instant interrupt
    act(() => {
      onInterimResultCallback?.("stop");
    });
    expect(chat.interrupt).toHaveBeenCalledTimes(1);
    expect(result.current.voiceState).toBe("transcribing");
    expect(result.current.showInterruptFlash).toBe(true);

    // Chrome's trailing FINAL "stop" is swallowed — conversation does NOT end
    act(() => {
      onFinalResultCallback?.("stop");
    });
    expect(result.current.voiceState).not.toBe("idle");

    // Next utterance carries the interrupted partial (short reply OK — warm)
    act(() => {
      onFinalResultCallback?.("continue");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "continue",
      expect.objectContaining({ interruptedReply: "partial reply so far", voice: true, })
    );
  });

  // ─── 7. Pure "stop" while thinking ─────────────────────────────────────────

  it("pure 'stop' while a turn is in flight cancels it and is never sent", async () => {
    const chat = makeChat({ isStreaming: true, interrupt: vi.fn(() => "thinking partial") });
    const { result } = renderVoice(chat);
    wake();
    act(() => {
      onFinalResultCallback?.("what's on my calendar today");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    (chat.sendMessage as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      onFinalResultCallback?.("Stop.");
    });
    expect(chat.interrupt).toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(result.current.voiceState).not.toBe("idle"); // conversation survives
  });

  // ─── 8. End-phrase re-arms ─────────────────────────────────────────────────

  it("'goodbye' closes GRACEFULLY: sent to her, re-arms only after her reply ends", async () => {
    let chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.("goodbye");
      onFinalResultCallback?.("Goodbye.");
    });
    await act(async () => {
      vi.advanceTimersByTime(50); // graceful close sends immediately, no debounce
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "Goodbye.",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
    // Conversation stays live so her warm close can play…
    expect(result.current.voiceState).not.toBe("idle");

    // …and re-arms once her goodbye TTS finishes.
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);
    expect(result.current.voiceState).toBe("idle");
    expect(mockRecognitionStop).toHaveBeenCalled();
    expect(result.current.conversationActive).toBe(false);
  });

  it("'thanks' is never silently discarded — it sends and she gets to answer", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.("thanks");
      onFinalResultCallback?.("Thanks.");
    });
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "Thanks.",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  it("'stop' alone does NOT end an idle-listening conversation", () => {
    const { result } = renderVoice(makeChat());
    wake();
    act(() => {
      onFinalResultCallback?.("stop");
    });
    expect(result.current.voiceState).not.toBe("idle");
  });

  // ─── 9. Silence timeout ────────────────────────────────────────────────────

  it("30s of silence re-arms the wake word", () => {
    const { result } = renderVoice(makeChat());
    wake();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.voiceState).toBe("idle");
    expect(mockRecognitionStop).toHaveBeenCalled();
  });

  // ─── 186-01 voice timer guard: post-teardown interim straggler ────────────

  it("a post-teardown interim straggler while idle cannot arm a phantom silence timer", () => {
    const { result } = renderVoice(makeChat());
    wake();
    act(() => {
      vi.advanceTimersByTime(30_000); // real silence timeout -- conversation tears down
    });
    expect(result.current.voiceState).toBe("idle");
    expect(mockRecognitionStop).toHaveBeenCalled();
    mockRecognitionStop.mockClear();

    // A Web Speech recognizer straggler fires AFTER teardown (async stop) --
    // voiceState is already idle. Without the fix this unconditionally called
    // resetSilenceTimer(), arming a brand-new 30s timeout that would later
    // fire endConversation() -> teardownConversation() (recognitionStop())
    // into whatever conversation happens to be live 30s later.
    act(() => {
      onInterimResultCallback?.("stray interim after teardown");
    });
    expect(result.current.voiceState).toBe("idle"); // no state churn while idle

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    // The phantom timer must never have been armed -- no second teardown fires.
    expect(mockRecognitionStop).not.toHaveBeenCalled();
  });

  // ─── 10. Follow-up window ──────────────────────────────────────────────────

  it("TTS end (strict off) opens the follow-up window; short reply accepted; expiry re-arms", async () => {
    let chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);
    expect(result.current.voiceState).toBe("listening");
    expect(result.current.followUpOpen).toBe(true);

    // Warm gate: 1-word reply accepted now
    act(() => {
      onFinalResultCallback?.("yes");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "yes",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
  });

  it("follow-up window is the FULL 30s (no more 14s undercut) and expiry re-arms", () => {
    let chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);
    expect(result.current.followUpOpen).toBe(true);
    expect(result.current.followUpMs).toBe(30_000);
    act(() => {
      vi.advanceTimersByTime(14_500); // the old window would have expired here
    });
    expect(result.current.followUpOpen).toBe(true);
    act(() => {
      vi.advanceTimersByTime(16_000);
    });
    expect(result.current.followUpOpen).toBe(false);
    expect(result.current.voiceState).toBe("idle");
    expect(mockRecognitionStop).toHaveBeenCalled();
  });

  it("TTS end with strict mode ON re-arms immediately — no window", () => {
    let chat = makeChat();
    const { result, rerender } = renderHook(
      (props: { chat: AstridrChat; enabled: boolean; strictMode: boolean }) => useAstridrVoice(props),
      { initialProps: { chat, enabled: true, strictMode: true } }
    );
    wake();
    const playing = makeChat({ ...(chat as unknown as Record<string, unknown>), ttsIsPlaying: true } as Partial<AstridrChat>);
    act(() => {
      rerender({ chat: playing, enabled: true, strictMode: true });
    });
    const stopped = makeChat({ ...(playing as unknown as Record<string, unknown>), ttsIsPlaying: false } as Partial<AstridrChat>);
    act(() => {
      rerender({ chat: stopped, enabled: true, strictMode: true });
    });
    expect(result.current.followUpOpen).toBe(false);
    expect(result.current.voiceState).toBe("idle");
  });

  // ─── 188.1-04: plausibility gate on the shared final sink ─────────────────
  // Fixtures quoted byte-for-byte from 188.1-CALIBRATION.md's Fixture Corpus
  // (D-15) — every input string is copied verbatim (casing/punctuation
  // intact) from the archived evidence record. All four fire on the DUPLEX
  // ear (onDuplexFinalTranscriptCallback), matching the real defect: the
  // duplex ear, not the 183 recognizer, transcribed and dispatched these.

  /** Wake, then complete one full turn (TTS on → off) so the hook is
   *  `listening` inside an OPEN follow-up window — the exact state every
   *  188.1-CALIBRATION.md fixture fires in ("warm:true", "followUpOpen"). */
  function warmAndOpenFollowUp(
    chat: AstridrChat,
    rerender: (props: { chat: AstridrChat; enabled: boolean }) => void
  ): AstridrChat {
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);
    return chat;
  }

  describe("VOICE-DISPATCH-01: wake-phrase leak", () => {
    it('WAKE-1: duplex final "Hey Astrid." (wake-phrase-only) is NOT dispatched and the follow-up window is refreshed, not closed', async () => {
      let chat = makeChat();
      const { result, rerender } = renderVoice(chat);
      chat = warmAndOpenFollowUp(chat, rerender);
      expect(result.current.followUpOpen).toBe(true);

      act(() => {
        onDuplexFinalTranscriptCallback?.("Hey Astrid.");
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(chat.sendMessage).not.toHaveBeenCalled();
      // D-02: the window is REFRESHED (still open), not merely left alone —
      // the interim handler already consumed it for this same utterance, so
      // an open value here proves a genuine re-open, not a no-op.
      expect(result.current.followUpOpen).toBe(true);
      expect(result.current.filteredCount).toBe(1);
    });

    it('WAKE-2: duplex final "Hey Astrid. What\'s the weather like tomorrow in Cumming, Georgia?" dispatches with the wake phrase stripped, question verbatim', async () => {
      let chat = makeChat();
      const { result, rerender } = renderVoice(chat);
      chat = warmAndOpenFollowUp(chat, rerender);

      act(() => {
        onDuplexFinalTranscriptCallback?.(
          "Hey Astrid. What's the weather like tomorrow in Cumming, Georgia?"
        );
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(chat.sendMessage).toHaveBeenCalledWith(
      "What's the weather like tomorrow in Cumming, Georgia?",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
      expect(result.current.filteredCount).toBe(0);
    });
  });

  describe("VOICE-DISPATCH-01: duration plausibility", () => {
    it('NOISE-1: duplex final "Kulitnya." with a sub-floor duration is rejected by the duration gate', async () => {
      // Now fires on the REAL ARCHIVED MEASUREMENT, 241ms — no longer a
      // synthetic stand-in. Under the old PROVISIONAL 50ms floor this exact
      // case was documented as an accepted, uncaught gap, so the fixture had to
      // fake a 20ms duration to exercise the mechanism at all. The 320ms floor
      // re-derived from the 2026-08-06 live session actually catches it, so the
      // fixture now reproduces the defect as it was really captured.
      let chat = makeChat();
      const { result, rerender } = renderVoice(chat);
      chat = warmAndOpenFollowUp(chat, rerender);

      act(() => {
        onDuplexFinalTranscriptCallback?.("Kulitnya.", 241);
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(chat.sendMessage).not.toHaveBeenCalled();
      expect(result.current.filteredCount).toBe(1);
    });

    it('NOISE-2 (live 2026-08-06): the hallucinated "部屋" burst at its real 258ms is NOT dispatched', async () => {
      // Captured verbatim from the 188.1-07 live-mic session. "部屋" is Japanese
      // for "room" — nothing remotely like it was spoken; it is a pure STT
      // hallucination off ambient noise. Under the old 50ms floor it was
      // dispatched, answered by a full LLM turn, and spoken back over TTS:
      //   final    {"text":"部屋","durationMs":258,"state":"listening"}
      //   flushSend {"message":"部屋","closing":false}
      // It then compounded — the follow-up "Huh." merged with it and sent
      // "部屋 Huh." as a second turn.
      //
      // This is the regression that justifies the floor change, pinned at the
      // REAL measured duration rather than a synthetic one.
      // SCOPE, stated honestly: this asserts the OUTCOME (not dispatched), not
      // which gate produced it. A controlled pair (258ms vs 1500ms, text held
      // constant) was tried first and showed filteredCount staying 0 in BOTH
      // runs -- so in this harness "部屋" never reaches the duration gate at all.
      // CONV-03's noise gate claims it first, because "部屋" normalizes to zero
      // ASCII word characters. That gate now runs BEFORE the duration gate, as a
      // consequence of moving the duration check after the salvage rejoin.
      //
      // Live, this text WAS accepted (`final.accepted {"warm":true}`) and
      // dispatched, so the warm state here does not faithfully reproduce that
      // turn. The duration gate's own proof therefore lives in NOISE-1, which
      // uses ASCII text ("Kulitnya.", 241ms) that does reach it and does
      // increment filteredCount. This test guards the user-visible regression --
      // that this exact hallucination no longer becomes a chat turn -- and
      // deliberately claims nothing more.
      let chat = makeChat();
      const { rerender } = renderVoice(chat);
      chat = warmAndOpenFollowUp(chat, rerender);

      act(() => {
        onDuplexFinalTranscriptCallback?.("部屋", 258);
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(chat.sendMessage).not.toHaveBeenCalled();
    });

    it("fail-open (D-03, 188.1-CALIBRATION.md §d): a final with durationMs undefined passes the duration gate untouched", async () => {
      // The SAME "Kulitnya." text, but with durationMs undefined — the Web
      // Speech / 183 recognizer ear's PERMANENT structural condition (it
      // cannot supply a duration at all). The gate must never guess: an
      // undefined duration is a pass-through, not a rejection.
      let chat = makeChat();
      const { result, rerender } = renderVoice(chat);
      chat = warmAndOpenFollowUp(chat, rerender);

      act(() => {
        onDuplexFinalTranscriptCallback?.("Kulitnya.");
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(chat.sendMessage).toHaveBeenCalledWith(
      "Kulitnya.",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
      expect(result.current.filteredCount).toBe(0);
    });

    it('CTRL-SHORT: a legitimately short real utterance ("Yes.") with a plausible above-floor duration in an open follow-up window is STILL dispatched verbatim', async () => {
      // Guards against T-188.1-10 (D-16): a gate that drops on length/word-
      // count alone rather than the calibrated duration floor would fail
      // this control even though it turns every other fixture in this
      // describe block green — that is a FAILED fix, not a passing one.
      let chat = makeChat();
      const { rerender } = renderVoice(chat);
      chat = warmAndOpenFollowUp(chat, rerender);

      act(() => {
        // durationMs well above the 50ms floor — illustrative per
        // 188.1-CALIBRATION.md's Over-Block Controls table (no measured
        // real-utterance sample exists in this corpus; the property under
        // test is durationMs > DURATION_FLOOR_MS, not the specific number).
        onDuplexFinalTranscriptCallback?.("Yes.", 350);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // D-16 requires this control to be green BOTH before and after the fix
      // (proving the fix didn't over-block) — deliberately asserting ONLY
      // the dispatch outcome here, not filteredCount, since that field does
      // not exist pre-fix and would make the "green before" half of the
      // requirement impossible to satisfy by construction.
      expect(chat.sendMessage).toHaveBeenCalledWith(
      "Yes.",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
    });
  });

  describe("VOICE-DISPATCH-01: wake-warmth (criterion 3, D-05/D-06/D-07)", () => {
    it('WAKE-WARMTH-1: a short command spoken right after the wake word ("Right now.") is dispatched, not eaten by the cold 3-word floor', async () => {
      // SIGNAL. Built from the live "cold <3-word fragment is rejected" fixture
      // (:461-472) by changing only the assertion: after D-05, wake() alone
      // opens a bounded follow-up window, so the 1-word floor applies and this
      // dispatches. Before D-05, wake() opens nothing and this fixture is RED.
      //
      // Text choice deviates from the plan draft, which specified "Stop." —
      // corrected here because "Stop." normalizes to an EXACT match in
      // BARGE_IN_PHRASES (voiceState.ts) and is intercepted by the pure-barge
      // reflex (useAstridrVoice.ts ~:1506, "NEVER send it to Ástríðr as a
      // literal message") before the utterance ever reaches the noise gate
      // D-05 targets — that gate is permanent and unrelated to this plan, so
      // "Stop." can never dispatch regardless of D-05 and is not a valid
      // signal text. "Right now." is the ACTUAL live-evidence text from the
      // 22:13:08 2026-08-06 trace this plan's objective quotes verbatim
      // (final {"text":"Right now.","durationMs":765} →
      // final.noise-rejected {"warm":false,"followUpOpen":false}) and is
      // confirmed not a barge-in/vision/swap/end-phrase match.
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onFinalResultCallback?.("Right now.");
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(chat.sendMessage).toHaveBeenCalledWith(
      "Right now.",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
    });

    it('CTRL-NOWAKE: the SAME "Right now." with NO preceding wake() still gets the cold 3-word floor — nothing sends', async () => {
      // D-07 over-block control. This is WAKE-WARMTH-1 with exactly the
      // wake() call removed and nothing else changed — same makeChat(), same
      // renderVoice(chat), same onFinalResultCallback("Right now."), same
      // 3000ms advance. The one-variable difference between this and
      // WAKE-WARMTH-1 is the entire point: D-05 must not become a blanket
      // widening. This fixture must stay green before AND after the
      // production change.
      const chat = makeChat();
      renderVoice(chat);
      act(() => {
        onFinalResultCallback?.("Right now.");
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(chat.sendMessage).not.toHaveBeenCalled();
    });

    it("CTRL-WAKE-IGNORED: a wake landing on an already-open conversation (wake.ignored) does not refresh the follow-up countdown", () => {
      // D-06 control. First wake() opens the conversation; a second wake() at
      // t=25_000 hits the `conversationOpenRef.current` early-return branch
      // (wake.ignored) because the conversation is already open. If the
      // ignored wake refreshed the window, followUpOpen would still be true
      // at t=31_000 (25_000 + 6_000 > the original 30_000s window only if
      // refreshed from t=25_000). The assertion of record is followUpOpen at
      // t=31_000 — a window that had been refreshed would still be open then.
      const { result } = renderVoice(makeChat());
      wake();
      act(() => {
        vi.advanceTimersByTime(25_000);
      });
      window.__astridrVoiceTrace = [];
      wake(); // hits wake.ignored — conversationOpenRef.current is already true
      // Precondition check only (NOT the assertion of record): confirms the
      // second wake() actually took the ignored branch rather than, say,
      // silently no-op'ing for an unrelated reason.
      const traceAfterSecondWake = window.__astridrVoiceTrace ?? [];
      expect(traceAfterSecondWake.some((e) => e.ev === "wake.ignored")).toBe(true);
      act(() => {
        vi.advanceTimersByTime(6_000); // total elapsed 31_000ms
      });
      // Assertion of record: an ignored wake grants nothing. A refreshed
      // window would still be open here.
      expect(result.current.followUpOpen).toBe(false);
    });
  });

  // ─── 12+. Trace-driven fixes (2026-07-20 live repro) ──────────────────────

  it("recognizer keep-alive: unexpected end mid-conversation restarts recognition", () => {
    renderVoice(makeChat());
    wake();
    mockRecognitionStart.mockClear();

    act(() => {
      onRecognitionEndCallback?.(); // Chrome gave up (the live-trace bug)
      vi.advanceTimersByTime(400);
    });
    expect(mockRecognitionStart).toHaveBeenCalledTimes(1);
  });

  it("keep-alive does NOT restart after a completed graceful close", async () => {
    let chat = makeChat();
    const { rerender } = renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.("goodbye");
      onFinalResultCallback?.("goodbye");
    });
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    // Her goodbye plays out — conversation re-arms on its end.
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);

    mockRecognitionStart.mockClear();
    act(() => {
      onRecognitionEndCallback?.(); // the end our own stop() produced
      vi.advanceTimersByTime(1000);
    });
    expect(mockRecognitionStart).not.toHaveBeenCalled();
  });

  it("routine periodic recognizer deaths (healthy lifetime) restart PAST the storm cap — the countdown never goes deaf", () => {
    renderVoice(makeChat());
    wake();
    mockRecognitionStart.mockClear();
    act(() => {
      for (let i = 0; i < 5; i++) {
        onInterimResultCallback?.("still here talking to you"); // keeps the silence clock reset
        vi.advanceTimersByTime(15_000); // recognizer lived a healthy while
        onRecognitionEndCallback?.();
        vi.advanceTimersByTime(400); // restart delay elapses
      }
    });
    expect(mockRecognitionStart).toHaveBeenCalledTimes(5);
  });

  it("echo-tail anchor expires: an abandoned tail utterance stops stripping later speech", async () => {
    let chat = makeChat({
      streamingReplyRef: { current: "You're welcome. Is there anything else I can assist you with?" },
    } as Partial<AstridrChat>);
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);

    act(() => {
      vi.advanceTimersByTime(100);
      onInterimResultCallback?.(" you're welcome is there"); // echo tail, never finalized
    });
    act(() => {
      vi.advanceTimersByTime(6_000); // past ECHO_ANCHOR_MAX_MS — anchor dead
      onFinalResultCallback?.(" is there anything else I can assist");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    // Without expiry this would be anchored → stripped to "" → dropped.
    expect(chat.sendMessage).toHaveBeenCalledWith(
      " is there anything else I can assist".trim(),
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  it("keep-alive storm guard: restarts are capped inside the window", () => {
    renderVoice(makeChat());
    wake();
    mockRecognitionStart.mockClear();
    act(() => {
      for (let i = 0; i < 6; i++) {
        onRecognitionEndCallback?.();
        vi.advanceTimersByTime(400);
      }
    });
    expect(mockRecognitionStart.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("silence clock pauses during her turn: no teardown while processing/speaking a long reply", async () => {
    let chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();
    act(() => {
      onFinalResultCallback?.("what's the weather like the next two days");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000); // flushSend — her turn begins
    });
    // 40s of processing + speaking (the live trace showed teardown at 30s)
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    chat = setTtsPlaying(rerender, chat, true);
    await act(async () => {
      vi.advanceTimersByTime(25_000);
    });
    expect(result.current.conversationActive).toBe(true);
    expect(result.current.voiceState).toBe("speaking");
  });

  // SUPERSEDES "talk-over with content ... interrupts AND becomes the
  // message" (D-07 FINAL, Larry's decision 2026-07-30).
  //
  // Free-form talk-over during speech is gone. Content cannot distinguish her
  // echo from real speech over open speakers: degraded echo transcribes as
  // arbitrary garbage, and the version of this branch that trusted content
  // dispatched her OWN echo as a user message — "It's worth." was sent, and
  // she replied "Hey Larry! What can I do for you?" to herself.
  it("free-form speech during speaking is treated as echo — never barges, never sends", async () => {
    let chat = makeChat({
      interrupt: vi.fn(() => "the weather tomorrow is"),
      streamingReplyRef: { current: "Tomorrow brings rain showers near ninety degrees with strong winds" },
    } as Partial<AstridrChat>);
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    expect(result.current.voiceState).toBe("speaking");

    act(() => {
      onFinalResultCallback?.("actually just give me Tuesday please");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(chat.interrupt).not.toHaveBeenCalled();
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("a barge phrase in a longer utterance still interrupts AND becomes the message", async () => {
    let chat = makeChat({
      interrupt: vi.fn(() => "the weather tomorrow is"),
      streamingReplyRef: { current: "Tomorrow brings rain showers near ninety degrees with strong winds" },
    } as Partial<AstridrChat>);
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    expect(result.current.voiceState).toBe("speaking");

    // "hold on" is a barge phrase and does not appear in her reply.
    act(() => {
      onFinalResultCallback?.("hold on give me Tuesday instead");
    });
    expect(chat.interrupt).toHaveBeenCalled();
  });

  it("her own echo is never dispatched as a user message", async () => {
    // The live regression: duplex transcribed her TTS as the final
    // "It's worth." while state was "speaking"; it barged AND was sent.
    let chat = makeChat({
      streamingReplyRef: {
        current: "Under a bruised grey sky the longship Sea-Wolf cut through the North Sea swells",
      },
    } as Partial<AstridrChat>);
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    expect(result.current.voiceState).toBe("speaking");

    act(() => {
      onDuplexFinalTranscriptCallback?.("It's worth.");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(chat.interrupt).not.toHaveBeenCalled();
  });

  it("echo guard still drops her own reply text during speaking", async () => {
    let chat = makeChat({
      streamingReplyRef: { current: "Tomorrow brings rain showers near ninety degrees" },
    } as Partial<AstridrChat>);
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);

    act(() => {
      onFinalResultCallback?.("rain showers near ninety degrees");
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(chat.interrupt).not.toHaveBeenCalled();
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("adaptive send: a warm short answer flushes at ~800ms, not 2s", async () => {
    let chat = makeChat();
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false); // warm now, follow-up open

    act(() => {
      onFinalResultCallback?.("no");
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "no",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
  });

  it("stay-hot: her reply ending in a question opens a 45s window instead of 30s", () => {
    let chat = makeChat({
      streamingReplyRef: { current: "High of ninety tomorrow. Anything else you need?" },
    } as Partial<AstridrChat>);
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);

    expect(result.current.followUpOpen).toBe(true);
    expect(result.current.followUpMs).toBe(45_000);
    act(() => {
      vi.advanceTimersByTime(30_500); // the plain window would have expired here
    });
    expect(result.current.followUpOpen).toBe(true);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current.followUpOpen).toBe(false);
    expect(result.current.voiceState).toBe("idle");
  });

  it("silent-turn watchdog: a turn that ends with no audio returns to listening", async () => {
    let chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.("what is on my calendar"); // real speech: interim first
      onFinalResultCallback?.("what is on my calendar for today");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000); // flushSend → processing
    });
    expect(result.current.voiceState).toBe("processing");

    // Turn streams and completes with NO TTS
    chat = makeChat({ ...(chat as unknown as Record<string, unknown>), isStreaming: true } as Partial<AstridrChat>);
    act(() => {
      rerender({ chat, enabled: true });
    });
    chat = makeChat({ ...(chat as unknown as Record<string, unknown>), isStreaming: false } as Partial<AstridrChat>);
    act(() => {
      rerender({ chat, enabled: true });
    });
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.voiceState).toBe("listening");
    expect(result.current.followUpOpen).toBe(true);
  });

  // ─── 19:09 live-trace regression ──────────────────────────────────────────

  it("a mid-utterance Chrome reset rejoins the lost interim with the tail final", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" do I have any");
      // Chrome resets; the final carries only the tail.
      onFinalResultCallback?.(" on my personal account");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "do I have any on my personal account",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
  });

  // CTRL-SALVAGE (D-10/D-16, 188.1-CALIBRATION.md § Over-Block Controls) — the
  // duplex-sourced variant, which is the one that actually exercises the
  // ordering hazard. The 188.1-04 duration gate sits in handleFinalResultRef
  // BEFORE the rejoin block, so a final dropped for being sub-floor never
  // reaches the salvage that would have recovered it. Recognizer-sourced finals
  // are structurally immune (durationMs is permanently undefined there, so the
  // gate fails open), which is exactly why the test above cannot detect this —
  // only a final carrying a real duration can.
  //
  // This control is load-bearing going FORWARD, not just today: DURATION_FLOOR_MS
  // is PROVISIONAL at 50ms, derived from a corpus with zero real-utterance
  // samples, and 188.1-07's live-mic session is expected to re-derive it upward
  // (the observed junk burst was 241ms). At a higher floor a genuine short tail
  // final CAN fall below it, and this test is what fails when that happens.
  it("CTRL-SALVAGE: a duplex tail final still rejoins its lost interim and is dispatched, not dropped by the duration gate", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" do I have any");
      // Chrome resets mid-utterance; the tail arrives on the DUPLEX ear, so it
      // carries a real durationMs and IS subject to the gate.
      //
      // 200ms is deliberately BELOW DURATION_FLOOR_MS (320). That is the whole
      // point: the tail of a reset utterance is short precisely BECAUSE it is a
      // fragment, so the gate's salvage exemption is the only thing that saves
      // it. An earlier version of this control used a value equal to the floor,
      // which made it pass vacuously (`320 < 320` is false, so the gate never
      // fired and the exemption was never exercised) — a control that cannot
      // fail proves nothing. Mutation-verified: deleting `!salvaged &&` from the
      // gate turns this red.
      onDuplexFinalTranscriptCallback?.(" on my personal account", 200);
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "do I have any on my personal account",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
  });

  it("a final that already contains the interim is NOT double-prepended", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" what is the weather");
      onFinalResultCallback?.(" what is the weather in Cumming Georgia");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "what is the weather in Cumming Georgia",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
  });

  // ─── WAKE-REJOIN-1 (188.3-02, D-01) ────────────────────────────────────────
  // The rejoin at :1631 MUTATES `text` by prepending `lostInterim`, but the
  // wake-strip at :1427 INSPECTS `text` and already ran ~200 lines earlier —
  // it cannot re-run and so never judges anything the rejoin re-introduces.
  // If the lostInterim itself begins with a wake phrase (Chrome resets
  // mid-utterance right after "Hey Astrid, ..."), the direct-path strip sees
  // only the short duplex tail (no wake phrase in it) and passes it clean;
  // the wake phrase then survives, unjudged, into the rejoined dispatch.
  it("WAKE-REJOIN-1: a wake phrase carried in the rejoined lostInterim is stripped from the dispatched text, not just the raw final (D-01)", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" hey astrid what does my calendar");
      // Chrome resets mid-utterance; the tail arrives on the DUPLEX ear, so it
      // carries a real durationMs and is subject to the (post-rejoin) duration
      // gate. 200ms is below DURATION_FLOOR_MS (320) — the same salvage
      // exemption CTRL-SALVAGE proves — so the rejoin actually fires and this
      // fixture exercises the real mutate-after-inspect ordering defect.
      onDuplexFinalTranscriptCallback?.(" look like tonight", 200);
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    // Exact dispatched string: the wake phrase must be gone AND the rescued
    // head ("what does my calendar") must survive — an assertion that only
    // checked the wake phrase was gone would also pass if the whole rejoin
    // had been dropped instead of correctly re-stripped.
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "what does my calendar look like tonight",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
    const dispatched = (chat.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string | undefined;
    expect(dispatched).not.toContain("hey astrid");
    expect(dispatched).toContain("what does my calendar");
  });

  // ─── COLD-FRAGMENT-1 (188.3-03, D-02/D-03/D-17) ───────────────────────────
  // Criterion 2: observed live 2026-08-06 22:16:18 —
  // `final.noise-rejected {"text":"like tonight","warm":false}` fired
  // mid-utterance while the earlier half ("what does my calendar look") sat
  // as a lost interim the rejoin exists to recover, but the noise gate at
  // :1573 judges `text` before the rejoin at :1621 ever runs. This fixture
  // is deliberately COLD: no wake(), no warmAndOpenFollowUp(). D-17 trap —
  // after 188.3-01 (D-05), wake() alone opens a bounded follow-up window
  // (minWords = 1), which would let a sub-floor fragment through for the
  // WRONG reason (the open window, not the widened accumulationPending
  // leniency). followUpOpen === false is asserted FIRST, before anything
  // else, as the D-17 precondition proving this run is genuinely cold.
  it("COLD-FRAGMENT-1: a cold sub-floor fragment with an eligible pending lostInterim survives the noise gate and rejoins (D-02/D-03)", async () => {
    const chat = makeChat();
    const { result } = renderVoice(chat);

    // D-17 precondition — the FIRST assertion in the test body: no wake()
    // was called, so the follow-up window is closed and minWords is the
    // cold floor (3), not the warm floor (1).
    expect(result.current.followUpOpen).toBe(false);

    act(() => {
      // Chrome hears the head as an interim, then resets mid-utterance —
      // the final carries only the tail. 5 words, non-speaking-era, and not
      // an echo of the (empty) reply: eligible per the rejoin's own gate
      // at :1621-1625.
      onInterimResultCallback?.("what does my calendar look");
      onFinalResultCallback?.("like tonight"); // 2 words — fails the cold 3-word floor
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(chat.sendMessage).toHaveBeenCalledWith(
      "what does my calendar look like tonight",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
    const dispatched = (chat.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string | undefined;
    expect(dispatched).toContain("what does my calendar look");
    expect(dispatched).toContain("like tonight");
  });

  // CTRL-NO-ELIGIBLE-INTERIM (D-03 over-block control) — COLD-FRAGMENT-1
  // with exactly ONE eligibility term flipped: the pending lostInterim now
  // has fewer than 3 words, failing the rejoin's own word-count floor.
  // Nothing else differs (same makeChat(), same final text, same timer
  // advance, no wake()). This is what stops the widened leniency from
  // letting a fragment past the noise gate that then gets no rejoin and
  // dispatches bare — the exact failure mode D-03 exists to prevent.
  it("CTRL-NO-ELIGIBLE-INTERIM: the same cold sub-floor fragment with an INELIGIBLE pending lostInterim (fewer than 3 words) is still rejected — nothing sends (D-03)", async () => {
    const chat = makeChat();
    const { result } = renderVoice(chat);

    expect(result.current.followUpOpen).toBe(false);

    act(() => {
      // Only the word-count eligibility term is flipped vs COLD-FRAGMENT-1 —
      // 2 words, below the rejoin's own >= 3 floor.
      onInterimResultCallback?.("what does");
      onFinalResultCallback?.("like tonight");
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  // ─── ORDER-INVARIANT (188.3-04, D-04) ──────────────────────────────────────
  // A class guard, not a fourth instance patch. This fixture is the UNION of
  // WAKE-REJOIN-1 (188.3-02) and COLD-FRAGMENT-1 (188.3-03) in ONE input: the
  // lostInterim carries a wake phrase at its head AND is long enough to clear
  // the rejoin's own >= 3 word eligibility floor, while the final is a
  // sub-word-floor tail that fails the cold 3-word noise-gate floor on its
  // own. Reaching the rejoin at all depends on Plan 03's leniency
  // (eligibleLostInterimPending); coming out of it clean depends on Plan 02's
  // guarded re-strip (gated on salvaged === true). It fails if EITHER ordering
  // regresses: a mutator (the rejoin's `appendWithOverlapCheck` text rebuild)
  // moved above an inspector (the wake-strip or the noise gate), or an
  // inspector moved below a mutator. It observes the DISPATCHED STRING only —
  // no assertion here reads voiceState.ts or useAstridrVoice.ts source text.
  it("ORDER-INVARIANT: a lostInterim carrying a wake phrase AND enough tokens to rejoin, glued to a sub-floor final, dispatches with no wake residue, the rescued interim, and the tail all present (D-04)", async () => {
    const chat = makeChat();
    const { result } = renderVoice(chat);

    // D-17 precondition, asserted FIRST: no wake() was called, so the
    // follow-up window is closed and the noise gate uses the cold 3-word
    // floor, not the warm 1-word floor. Run warm, the sub-floor tail would
    // dispatch for the wrong reason (the open window) and this guard would
    // measure nothing — the same confound class COLD-FRAGMENT-1 guards
    // against.
    expect(result.current.followUpOpen).toBe(false);

    act(() => {
      // 6 tokens, wake phrase ("hey astrid") at the head — clears the
      // rejoin's own >= 3 word eligibility floor (D-03) and the mirrored
      // noise-gate leniency (D-02) with tokens to spare.
      onInterimResultCallback?.("hey astrid what does my calendar");
      // 2 words — fails the cold 3-word noise-gate floor on its own; only
      // D-02/D-03's leniency lets it survive to the rejoin.
      onFinalResultCallback?.("like tonight");
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Exact dispatched string, asserted with toHaveBeenCalledWith rather than
    // substring checks alone (the live option-object shape allows it).
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "what does my calendar like tonight",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
    const dispatched = (chat.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string | undefined;
    // (1) no wake-phrase residue — the rejoin-site re-strip (Plan 02) ran.
    expect(dispatched).not.toContain("hey astrid");
    // (2) the rescued interim content survived the rejoin (Plan 03's
    // leniency let the fragment reach it).
    expect(dispatched).toContain("what does my calendar");
    // (3) the sub-floor tail survived — it was not itself dropped.
    expect(dispatched).toContain("like tonight");
  });

  // ─── 22:07 live-trace regression (186-01 follow-up, Defect B) ─────────────
  // A talk-over interim misclassified during active TTS ("I couldn't find"
  // — Defect A's own failure mode, same live trace) never finalized and sat
  // as the tracked "longest interim" across a silent gap. A LATER, completely
  // unrelated utterance ("try on grok", heard by STT as "Tryon Rock") then
  // got the stale fragment prepended: "I couldn't find Tryon Rock" was sent
  // instead of "Tryon Rock". The fix must be STICKY: the trace shows the
  // barge-triggering interim (" I couldn't") captured while voiceStateRef
  // is still literally "speaking" (dispatch() only queues the transition),
  // but the very NEXT, LONGER interim in the SAME orphaned utterance
  // (" I couldn't find") lands after React has already re-rendered into
  // "transcribing" — a naive per-update check would wrongly call THAT one
  // trustworthy even though it's still the same misclassified utterance.

  it("a stale speaking-era (talk-over-misclassified) interim is never rejoined into a later unrelated final", async () => {
    let chat = makeChat({ interrupt: vi.fn(() => "") });
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    expect(result.current.voiceState).toBe("speaking");

    // D-07 FINAL (2026-07-30): the misclassification this test was written
    // for is now IMPOSSIBLE AT SOURCE, not merely guarded downstream. A
    // non-barge-phrase interim heard while she speaks is treated as echo and
    // dropped, so it never becomes a "longest interim" and never taints a
    // later utterance. Content-based echo/real discrimination was removed
    // because degraded echo transcribes as arbitrary garbage (live: "World
    // Cup" from her own story cut her off mid-sentence).
    act(() => {
      onInterimResultCallback?.(" I couldn't");
    });
    // Was "transcribing" when this fragment was misread as talk-over.
    expect(result.current.voiceState).toBe("speaking");

    chat = setTtsPlaying(rerender, chat, false); // she stops; the fragment is orphaned
    act(() => {
      vi.advanceTimersByTime(2000); // clear the (unrelated) post-TTS echo-tail window
      // The SAME orphaned utterance grows past the barge boundary — still
      // captured while the taint must remain sticky (state is "transcribing"
      // here, matching the live trace's 22:06:52.110 line exactly).
      onInterimResultCallback?.(" I couldn't find");
    });

    // Deliberately NOT the exact live-trace phrase ("Tryon Rock") — Defect
    // C's fix makes THAT phrase dispatch as a swap fast-path before ever
    // reaching the rejoin logic (see the dedicated end-to-end test below).
    // This test isolates the rejoin guard itself with an ordinary utterance.
    (chat.sendMessage as ReturnType<typeof vi.fn>).mockClear();
    act(() => {
      onFinalResultCallback?.("what's on my calendar today"); // a real, unrelated later utterance
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "what's on my calendar today",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  it("end-to-end 22:07 trace shape: the stale 'I couldn't find' fragment does not leak into the swap-dispatched 'Tryon Rock' turn (Defects B+C together)", async () => {
    let chat = makeChat({ interrupt: vi.fn(() => "") });
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    act(() => {
      onInterimResultCallback?.(" I couldn't"); // misclassified talk-over, never finalizes
    });
    chat = setTtsPlaying(rerender, chat, false);
    act(() => {
      vi.advanceTimersByTime(2000); // clear the post-TTS echo-tail window
      onInterimResultCallback?.(" I couldn't find"); // same orphaned utterance, now post-barge
    });

    (chat.sendMessage as ReturnType<typeof vi.fn>).mockClear();
    act(() => {
      // STT's exact live-trace rendering of "try on grok".
      onFinalResultCallback?.("Tryon Rock");
    });
    // Defect C: the grammar-join fix makes this dispatch as a swap fast-path
    // immediately (no debounce) — it never even reaches the rejoin logic.
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "Tryon Rock",
      expect.objectContaining({ voice: true, swapHandled: true, })
    );
  });

  it("a NON-speaking-era lost interim still rejoins normally (the fix does not widen)", async () => {
    // Same shape as the pre-existing "mid-utterance Chrome reset" regression
    // above, confirming the speaking-era guard doesn't over-reach: this
    // interim is captured entirely in "listening"/"transcribing" state.
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" do I have any");
      onFinalResultCallback?.(" on my personal account");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "do I have any on my personal account",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
  });

  // ─── 19:05 live-trace regression ──────────────────────────────────────────

  it("post-barge, a garbled short 'continue' utterance normalizes to a clean resume", async () => {
    let chat = makeChat({ interrupt: vi.fn(() => "The forecast for tomorrow shows") });
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    act(() => {
      onInterimResultCallback?.("hold on"); // barge — partial now pending
    });
    act(() => {
      onInterimResultCallback?.(" not continue");
      onFinalResultCallback?.(" not continue"); // STT flipped "no, continue"
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "continue",
      expect.objectContaining({ interruptedReply: "The forecast for tomorrow shows", voice: true, })
    );
  });

  it("a longer resume sentence is NOT normalized — user's qualifiers survive", async () => {
    let chat = makeChat({ interrupt: vi.fn(() => "The forecast for tomorrow shows") });
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    act(() => {
      onInterimResultCallback?.("hold on");
    });
    act(() => {
      onFinalResultCallback?.(" continue but only give me tomorrow's forecast");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "continue but only give me tomorrow's forecast",
      expect.objectContaining({ interruptedReply: "The forecast for tomorrow shows", voice: true })
    );
  });

  // ─── 18:50 live-trace regressions ─────────────────────────────────────────

  it("a chopped sentence merges into one message instead of a fragment cancelling the answer", async () => {
    const chat = makeChat({ isStreaming: true }); // her turn stays in flight after send #1
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" do I have any calendar entries this afternoon");
      onFinalResultCallback?.(" do I have any calendar entries this afternoon");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000); // debounce fires mid-pause — send #1
    });
    act(() => {
      onInterimResultCallback?.(" for my personal");
      onFinalResultCallback?.(" for my personal");
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenLastCalledWith(
      "do I have any calendar entries this afternoon for my personal",
      expect.objectContaining({ voice: true })
    );

    // D-08 (188.3-05): the actual gap this closes — one utterance should
    // produce ONE user bubble, not two separate sendMessage calls with the
    // first left un-superseded. Assert the call COUNT and the supersede
    // linkage, not just the merged string (which the assertion above already
    // proved correct on its own).
    expect(chat.sendMessage).toHaveBeenCalledTimes(2);
    const sendMessageMock = chat.sendMessage as unknown as ReturnType<typeof vi.fn>;
    const firstCallOpts = sendMessageMock.mock.calls[0][1] as { clientMessageId?: string };
    const secondCallOpts = sendMessageMock.mock.calls[1][1] as {
      clientMessageId?: string;
      supersedes?: string;
    };
    expect(typeof firstCallOpts.clientMessageId).toBe("string");
    expect(firstCallOpts.clientMessageId).toBeTruthy();
    expect(secondCallOpts.supersedes).toBe(firstCallOpts.clientMessageId);
  });

  it("post-TTS single-word echo residue is dropped, but a fresh short answer still sends", async () => {
    let chat = makeChat({
      streamingReplyRef: { current: "I found three unread emails in your personal email inbox." },
    } as Partial<AstridrChat>);
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);

    // Her leaked " email" finalizes just after tts.end → dropped.
    act(() => {
      vi.advanceTimersByTime(300);
      onFinalResultCallback?.(" email");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();

    // A genuine short answer whose word is NOT in her reply still goes out.
    act(() => {
      onFinalResultCallback?.(" no");
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "no",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  // ─── 18:36 live-trace regressions ─────────────────────────────────────────

  it("a mic-off teardown with NO live recognizer does not eat the next session's keep-alive restart", () => {
    const chat = makeChat();
    const { rerender } = renderVoice(chat);
    // Toggle off while armed-idle: teardown runs, no recognizer was live —
    // the intentional-stop latch would go stale here.
    act(() => {
      rerender({ chat, enabled: false });
    });
    act(() => {
      rerender({ chat, enabled: true });
    });
    wake();
    mockRecognitionStart.mockClear();
    act(() => {
      vi.advanceTimersByTime(15_000); // healthy lifetime
      onRecognitionEndCallback?.(); // Chrome's routine death
      vi.advanceTimersByTime(400);
    });
    expect(mockRecognitionStart).toHaveBeenCalledTimes(1);
  });

  it("post-talk-over trailing final that is her echo is swallowed, not sent", async () => {
    let chat = makeChat({
      interrupt: vi.fn(() => "Today is mostly clear"),
      streamingReplyRef: { current: "Today is mostly clear at ninety one degrees" },
    } as Partial<AstridrChat>);
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    act(() => {
      onInterimResultCallback?.(" today hold"); // talk-over fires the barge
    });
    (chat.sendMessage as ReturnType<typeof vi.fn>).mockClear();
    act(() => {
      onFinalResultCallback?.(" today"); // Chrome's trailing final = her echo
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("recognizer death mid-utterance salvages the longest interim as the message", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" do I have any");
      onInterimResultCallback?.(" do I have any entries on");
      onInterimResultCallback?.(" today"); // Chrome resets the utterance…
    });
    act(() => {
      vi.advanceTimersByTime(15_000);
      onRecognitionEndCallback?.(); // …then dies without ever finalizing
    });
    await act(async () => {
      vi.advanceTimersByTime(2100); // normal accept path debounce
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "do I have any entries on",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  // ─── 12:32 live-trace regression (186-01, D-16) ────────────────────────────
  // "she does not recognize goodbye anymore" — a SHORT end-phrase interim
  // ("goodbye") died with a periodic recognizer death (Chrome's ~60s
  // recognizer lifetime cap in the live trace) before ever finalizing. The
  // old ≥3-word salvage floor never fired for it (1 word), leaving the
  // reducer stuck in "transcribing" — which both ate the end-phrase AND made
  // the wake path look dead (a real wake detection while stuck there is
  // silently ignored via wake.ignored). This test reproduces that same
  // shape (interim dies mid-transcribing, non-storm lifetime) and asserts
  // the wake path re-arms once her (now-sent) goodbye reply finishes.
  it("wake rearm survives a keepalive-restart death mid-'goodbye' — the interim salvages as an end-phrase, not silently dropped", async () => {
    let chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();

    act(() => {
      onInterimResultCallback?.(" good");
      onInterimResultCallback?.(" goodbye"); // never finalizes before the death below
    });
    expect(result.current.voiceState).toBe("transcribing");

    // Same "healthy" (non-storm) lifetime window as the existing longest-
    // interim salvage test above — comfortably clear of both
    // RECOGNIZER_MIN_HEALTHY_MS (2s, storm-guard floor) and the 30s silence
    // timeout the interim just reset, so nothing else fires prematurely.
    act(() => {
      vi.advanceTimersByTime(15_000); // Chrome's periodic recognizer death (live trace: ~60s cap)
      onRecognitionEndCallback?.(); // dies mid-utterance, no final ever arrives
    });
    await act(async () => {
      vi.advanceTimersByTime(50); // synthesized end-phrase sends immediately, no debounce
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "goodbye",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
    // Conversation stays live so her warm close can play — NOT wedged in
    // "transcribing" (the bug's actual mechanism).
    expect(result.current.voiceState).not.toBe("idle");

    // …and re-arms once her goodbye TTS finishes, same as the plain-final
    // "goodbye" case above — proving the wake path is never left stuck.
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);
    expect(result.current.voiceState).toBe("idle");
    expect(mockRecognitionStop).toHaveBeenCalled();
    expect(result.current.conversationActive).toBe(false);
  });

  it("a short NON-end-phrase interim lost to a recognizer death is still NOT salvaged (noise floor unchanged)", () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onInterimResultCallback?.(" the"); // 1 word, not an end-phrase — pure noise
    });
    act(() => {
      vi.advanceTimersByTime(15_000);
      onRecognitionEndCallback?.();
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  // ─── 16:41 live-trace regressions ─────────────────────────────────────────

  it("her own closing line ('all right…') never fires a false barge-in", () => {
    let chat = makeChat({
      streamingReplyRef: { current: "Alright, I'm here if you need me." },
    } as Partial<AstridrChat>);
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);

    act(() => {
      onInterimResultCallback?.(" all");
      onInterimResultCallback?.(" all right");
      onInterimResultCallback?.(" all right I'm");
    });
    expect(chat.interrupt).not.toHaveBeenCalled();
  });

  it("echo tail: her glued trailing question is stripped, only the user's answer sends", async () => {
    let chat = makeChat({
      streamingReplyRef: { current: "You're welcome. Is there anything else I can assist you with?" },
    } as Partial<AstridrChat>);
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false); // tts.end — tail window arms

    act(() => {
      vi.advanceTimersByTime(100); // utterance starts just after tts.end
      onInterimResultCallback?.(" you're welcome is there anything else I");
    });
    act(() => {
      vi.advanceTimersByTime(2000); // final arrives past the tail window itself
      onFinalResultCallback?.(
        " you're welcome is there anything else I can assist you with no I'm good thank you"
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "no I'm good thank you",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  it("echo tail: pure echo final is dropped entirely — nothing sends", async () => {
    let chat = makeChat({
      streamingReplyRef: { current: "You're welcome. Is there anything else I can assist you with?" },
    } as Partial<AstridrChat>);
    const { rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);

    act(() => {
      vi.advanceTimersByTime(200);
      onFinalResultCallback?.(" is there anything else I can assist you with");
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("a barge-in-caused TTS end does not open a follow-up window", () => {
    // 188.3 D-05 repair (bucket a — legitimately now warm, assertion-level
    // variant): wake() alone now opens a follow-up window immediately
    // (D-05), so `followUpOpen` is `true` by the time this sequence even
    // starts — a plain boolean read can no longer distinguish "wake already
    // opened one" from "the barge-caused TTS end opened ANOTHER one", which
    // is the actual invariant this fixture protects (useAstridrVoice.ts
    // :1852-1855: a barge-caused tts.end calls resetSilenceTimer(), NOT
    // onTurnEnd()/openFollowUpWindow() — that production code is untouched
    // by this plan). wake() cannot be deleted per the usual bucket-(a) repair
    // here: it is structurally required to reach the speaking/barge state
    // this fixture exercises. Repair: reset the trace buffer right after
    // wake() (which itself fires exactly one "followup.open"), then assert
    // NO SECOND "followup.open" trace fires from the barge-caused end —
    // that is the precise, D-05-proof form of the original assertion.
    let chat = makeChat({
      interrupt: vi.fn(() => "partial"),
      streamingReplyRef: { current: "Tomorrow brings rain showers near ninety degrees" },
    } as Partial<AstridrChat>);
    const { result, rerender } = renderVoice(chat);
    wake();
    expect(result.current.followUpOpen).toBe(true); // D-05: wake alone opened it
    window.__astridrVoiceTrace = [];
    chat = setTtsPlaying(rerender, chat, true);
    act(() => {
      onInterimResultCallback?.("stop"); // barge-in cuts TTS
    });
    chat = setTtsPlaying(rerender, chat, false); // TTS stops BECAUSE of the barge
    const trace = window.__astridrVoiceTrace ?? [];
    expect(trace.some((entry) => entry.ev === "followup.open")).toBe(false);
  });

  // ─── 11. Spoken strict-mode command ────────────────────────────────────────

  it("'strict mode on' fast-paths to onStrictModeChange — no send", async () => {
    const chat = makeChat();
    const onStrictModeChange = vi.fn();
    renderHook(
      (props: { chat: AstridrChat; enabled: boolean; onStrictModeChange: (v: boolean) => void }) =>
        useAstridrVoice(props),
      { initialProps: { chat, enabled: true, onStrictModeChange } }
    );
    wake();
    act(() => {
      onFinalResultCallback?.("strict mode on");
    });
    expect(onStrictModeChange).toHaveBeenCalledWith(true);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  // ─── 185-07: brain/voice hot-swap fast-path (SWAP-01/02/03, D-09/D-11) ─────

  it("'try on grok' fast-paths to a swap send with the swapHandled dedup marker — no accumulate debounce", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onFinalResultCallback?.("try on grok");
    });
    // Zero-latency: no debounce wait needed, unlike the normal accumulate path.
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "try on grok",
      expect.objectContaining({ voice: true, swapHandled: true, })
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    // Only the one swap-dispatch send — never doubles into the normal pipeline.
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("'switch your voice to rachel' fast-paths to a swap send with the swapHandled dedup marker", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onFinalResultCallback?.("switch your voice to rachel");
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "switch your voice to rachel",
      expect.objectContaining({ voice: true, swapHandled: true, })
    );
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("a non-swap utterance is unaffected — normal accumulate/send pipeline still fires without swapHandled", async () => {
    const chat = makeChat();
    renderVoice(chat);
    wake();
    act(() => {
      onFinalResultCallback?.("what's the weather like tomorrow");
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "what's the weather like tomorrow",
      expect.objectContaining({ interruptedReply: undefined, voice: true, })
    );
  });

  // ─── 184 code-review CR-03: vision fast-path capture failure ──────────────
  // FINAL_RESULT moves the reducer into `processing` BEFORE captureFrame runs;
  // if capture throws (track ends mid-capture), no send ever happens, so no
  // TTS_START/TTS_END fires and the silent-turn watchdog never arms (it only
  // arms on a chat.isStreaming falling edge). Without an explicit close the
  // conversation wedges in "Thinking…" until a manual mic toggle.
  it("CR-03: captureFrame rejection closes the turn back to listening (not wedged in processing)", async () => {
    const chat = makeChat();
    const failingShare = {
      state: "active" as const,
      arm: vi.fn(),
      captureFrame: vi.fn().mockRejectedValue(new Error("Screen share track is not live")),
    };
    const { result } = renderHook(() =>
      useAstridrVoice({ chat, enabled: true, screenShare: failingShare })
    );
    wake();

    // Real flow: an interim moves listening → transcribing, THEN the final
    // moves transcribing → processing (listening + FINAL_RESULT is a no-op
    // transition, which would mask the wedge).
    act(() => {
      onInterimResultCallback?.("what's on");
    });
    expect(result.current.voiceState).toBe("transcribing");
    act(() => {
      onFinalResultCallback?.("what's on my screen");
    });

    // Let the async capture attempt reject and its catch run.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(failingShare.captureFrame).toHaveBeenCalledTimes(1);
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(result.current.isLooking).toBe(false);
    expect(result.current.voiceState).toBe("listening");
  });

  // ─── Duplex ears -- barge-in reuse (188-03, D-04/D-08) ─────────────────────
  // useDuplexEars.ts lands in 188-05; 188-08 composes it into this hook. RED
  // here is the anti-drift defense D-08/T-188-09 require: a future duplex
  // implementation that satisfies these cases via a DIFFERENT internal path
  // than the 183 recognizer still fails, because assertions only look at the
  // fake chat's public sinks (chat.interrupt / showInterruptFlash).

  describe("duplex ears — barge-in reuse (D-04/D-08)", () => {
    // SUPERSEDES "duplex speech_started triggers the SAME barge-in" (188-03).
    //
    // D-04's intent — ONE barge-in implementation, never a second parallel
    // path — is unchanged and still honoured. What changed is which source
    // may TRIGGER it. The duplex ears' VAD is OpenAI's server-side energy
    // detector: it carries no text, so at the instant it fires it cannot
    // distinguish Larry's voice from her own reply returning through open
    // speakers. Two guards were tried and both failed live on 2026-07-30
    // (time window: echo arrived 1.7s into playback; recognizer
    // corroboration: the duplex VAD won the race by 158ms), so barge-in now
    // belongs solely to the content-aware recognizer path.
    it("duplex speech_started does NOT barge in — it cannot tell her voice from Larry's", () => {
      let chat = makeChat();
      const { result, rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);
      expect(result.current.voiceState).toBe("speaking");

      act(() => {
        onDuplexSpeechStartCallback?.();
      });
      expect(chat.interrupt).not.toHaveBeenCalled();
    });

    it("duplex speech_started while idle does NOT barge in", () => {
      const chat = makeChat();
      renderVoice(chat);
      act(() => {
        onDuplexSpeechStartCallback?.();
      });
      expect(chat.interrupt).not.toHaveBeenCalled();
    });

    it("barge-in is idempotent across sources", () => {
      let chat = makeChat();
      const { result, rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);
      expect(result.current.voiceState).toBe("speaking");

      // Barge from the 183 recognizer path first...
      act(() => {
        onInterimResultCallback?.("stop");
      });
      // ...then immediately from duplex — the existing bargeInFiredRef latch
      // must cover both sources, so this must NOT fire a second interrupt.
      act(() => {
        onDuplexSpeechStartCallback?.();
      });
      expect(chat.interrupt).toHaveBeenCalledTimes(1);
    });

    // ─── Self-barge over open speakers (live 2026-07-30 16:16) ──────────────
    // Larry was SILENT. Her own TTS came back through open speakers, the
    // recognizer correctly logged interim.echo-dropped at 16:16:09.603, and
    // 770ms later the duplex ears' textless VAD fired barge-in.fired at
    // 16:16:10.371 and cut her off mid-sentence. ECHO_SUPPRESS_MS (400ms)
    // could not catch it — the echo arrived 1.7s into playback.
    it("does NOT self-barge when the recognizer just content-matched an echo", () => {
      let chat = makeChat({
        streamingReplyRef: { current: "Honestly I'm not seeing anything logged from today" },
      });
      const { result, rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);
      expect(result.current.voiceState).toBe("speaking");

      // Her own voice reaches the recognizer first and is identified by content.
      act(() => {
        onInterimResultCallback?.("honestly I'm not seeing anything");
      });
      // The duplex VAD then reacts to the SAME audio. It carries no text, so
      // it must corroborate against the recognizer's verdict.
      act(() => {
        onDuplexSpeechStartCallback?.();
      });

      expect(chat.interrupt).not.toHaveBeenCalled();
    });

    // ─── D-07 FINAL: only barge phrases interrupt while she speaks ──────────
    it("garbled echo of her own voice never barges, however unlike her text", () => {
      // Live 2026-07-30: her Viking story produced "bentuk", " Wolf", "Hej",
      // "kilometraje", "الوحدة", "Oração" and " World Cup" from Chrome
      // mis-hearing her OWN audio. " World Cup" cleared every short-token
      // guard, matched nothing in her story, and cut her off while Larry was
      // silent. No fingerprint can match garbage — so nothing but an explicit
      // barge phrase is allowed to interrupt.
      for (const garbage of [" World Cup", "kilometraje", "bentuk", "Oração"]) {
        let chat = makeChat({
          streamingReplyRef: { current: "Under a bruised grey sky the longship Sea-Wolf cut through the North Sea swells" },
        });
        const { result, rerender } = renderVoice(chat);
        wake();
        chat = setTtsPlaying(rerender, chat, true);
        expect(result.current.voiceState).toBe("speaking");

        act(() => {
          onInterimResultCallback?.(garbage);
        });

        expect(chat.interrupt).not.toHaveBeenCalled();
      }
    });

    it("her own reply containing 'stop' does NOT self-barge", () => {
      // Larry's live story ended: "...the sea only keeps those who stop
      // fighting it." isBargeInPhrase matches "stop" ANYWHERE in an
      // utterance, so echo of her own closing line would have interrupted
      // her — the phrase-only rule would have INTRODUCED this bug.
      let chat = makeChat({
        streamingReplyRef: {
          current: "proof, once again, that the sea only keeps those who stop fighting it",
        },
      });
      const { result, rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);
      expect(result.current.voiceState).toBe("speaking");

      act(() => {
        onInterimResultCallback?.("stop fighting it");
      });

      expect(chat.interrupt).not.toHaveBeenCalled();
    });

    it("a real 'stop' DOES barge when her reply does not contain it", () => {
      let chat = makeChat({
        streamingReplyRef: { current: "Under a bruised grey sky the longship cut through the swells" },
      });
      const { result, rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);
      expect(result.current.voiceState).toBe("speaking");

      act(() => {
        onInterimResultCallback?.("stop");
      });

      expect(chat.interrupt).toHaveBeenCalledTimes(1);
    });

    it("a REAL interruption still barges — via the content-aware recognizer", () => {
      let chat = makeChat({
        streamingReplyRef: { current: "Honestly I'm not seeing anything logged from today" },
      });
      const { result, rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);
      expect(result.current.voiceState).toBe("speaking");

      // Larry genuinely talks over her. The text does NOT match her reply,
      // so the recognizer's talk-over branch fires barge-in. This is the
      // path that must keep working now that duplex no longer barges.
      act(() => {
        onInterimResultCallback?.("actually hold on a second");
      });

      expect(chat.interrupt).toHaveBeenCalledTimes(1);
    });

    it("the interrupt flash is not duplicated", () => {
      let chat = makeChat({
        streamingReplyRef: { current: "Honestly I'm not seeing anything logged from today" },
      });
      const { result, rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);

      // Two talk-over interims in a row must still flash and interrupt once
      // (the bargeInFiredRef latch). Driven through the recognizer now that
      // it is the sole barge-in trigger.
      act(() => {
        onInterimResultCallback?.("actually hold on");
        onInterimResultCallback?.("actually hold on a second");
      });
      expect(result.current.showInterruptFlash).toBe(true);
      expect(chat.interrupt).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Duplex ears — transcript dispatch and silent fallback (188-03, D-08/D-13) ─
  // Same RED posture as the barge-in block above: onFinalTranscript is never
  // invoked because useAstridrVoice.ts does not yet compose useDuplexEars
  // (188-05/188-08), so the mock's captured callback stays null and every
  // affirmative "it dispatches/hits the gate" case below fails cleanly on the
  // observable sink (chat.sendMessage) rather than on a thrown error.

  describe("duplex ears — transcript dispatch and silent fallback (D-08/D-13)", () => {
    it("duplex finalized transcript dispatches through the SAME sendMessage call site", async () => {
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onDuplexFinalTranscriptCallback?.("what's the weather like tomorrow");
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(chat.sendMessage).toHaveBeenCalledWith(
        "what's the weather like tomorrow",
        expect.objectContaining({ voice: true })
      );
    });

    // ─── Double-transcript concatenation (live 2026-07-30 16:15) ────────────
    // activeEarsRef was assigned but never READ, so both ears dispatched
    // finals into handleFinalResult's accumulator (`accumulated + text`) and
    // the two transcripts were GLUED. Larry asked one question and she
    // received: "what did we work on today What did we work on today?"
    it("does NOT send the question twice when both ears finalize it", async () => {
      duplexStatusValue = "connected";
      const chat = makeChat();
      renderVoice(chat);
      wake();

      act(() => {
        // Duplex (the active ear) finalizes...
        onDuplexFinalTranscriptCallback?.("what did we work on today");
        // ...and the 183 recognizer finalizes the SAME utterance.
        onFinalResultCallback?.("what did we work on today", 0.97);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      expect(chat.sendMessage).toHaveBeenCalledWith(
        "what did we work on today",
        expect.objectContaining({ voice: true })
      );
    });

    it("the recognizer still drives finals when duplex is NOT active", async () => {
      duplexStatusValue = "idle";
      const chat = makeChat();
      renderVoice(chat);
      wake();

      act(() => {
        onFinalResultCallback?.("what did we work on today", 0.97);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("duplex transcript passes through the existing noise gate", async () => {
      // shouldReject (useAstridrVoice.ts:274) rejects any utterance under 3
      // words from a COLD conversation (not warm, no open follow-up window);
      // "um" is 1 word and neither a barge-in phrase, end-phrase, nor
      // control verb, so it is a real input the current gate rejects --
      // verified by reading shouldReject directly, not guessed.
      //
      // 188.3 D-05/D-17: wake() call removed (same repair as the fixture at
      // :461) since wake() alone now opens a follow-up window; the duplex
      // callback reaches the same handleFinalResultRef sink without it.
      const chat = makeChat();
      renderVoice(chat);
      act(() => {
        onDuplexFinalTranscriptCallback?.("um");
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(chat.sendMessage).not.toHaveBeenCalled();
    });

    it("duplex transcript still hits the control-verb fast path", () => {
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onDuplexFinalTranscriptCallback?.("try on grok");
      });
      // Same dispatch shape as the 183 recognizer's swap fast-path (line
      // 1237 above): no debounce, swapHandled:true dedup marker.
      expect(chat.sendMessage).toHaveBeenCalledWith(
      "try on grok",
      expect.objectContaining({ voice: true, swapHandled: true, })
    );
    });

    it("duplex unavailable is silent (D-08)", () => {
      duplexStatusValue = "unavailable";
      const chat = makeChat();
      const { result } = renderVoice(chat);
      wake();
      const stateBefore = result.current.voiceState;
      act(() => {
        onDuplexUnavailableCallback?.("network");
      });
      // No user-visible state change out of whatever voice state we were in --
      // the 183 recognizer keeps driving the session silently underneath.
      expect(result.current.voiceState).toBe(stateBefore);
      expect(mockRecognitionStart).toHaveBeenCalled();
    });

    it("duplex unavailable is disclosed ONLY on the debug trace", () => {
      const chat = makeChat();
      renderVoice(chat);
      wake();
      window.__astridrVoiceTrace = [];
      act(() => {
        onDuplexUnavailableCallback?.("network");
      });
      const trace = window.__astridrVoiceTrace ?? [];
      expect(trace.some((entry) => entry.ev.startsWith("duplex."))).toBe(true);
    });

    // 188.1-02 (D-03/D-05): proves durationMs physically REACHES the shared
    // sink's trace -- not merely that a parameter was declared somewhere
    // upstream. Threshold-free: this plan makes no gate decision on the value.
    it("durationMs fired at the duplex ear reaches the shared sink's trace", async () => {
      const chat = makeChat();
      renderVoice(chat);
      wake();
      window.__astridrVoiceTrace = [];
      act(() => {
        onDuplexFinalTranscriptCallback?.("what's the weather like tomorrow", 1800);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      const trace = window.__astridrVoiceTrace ?? [];
      // MUST match ONLY the shared sink's own "final" trace (useAstridrVoice.ts
      // handleFinalResultRef). Accepting "duplex.transcript" here would be a
      // confound: that entry is emitted at onDuplexFinalTranscript one line
      // BEFORE the value is forwarded to the sink, so the assertion would pass
      // with the forwarding call severed and prove nothing about the boundary
      // this test exists to cross. Verified 2026-08-06 by mutation: dropping
      // durationMs from the handleFinalResultRef call left the old two-event
      // predicate green.
      const entry = trace.find(
        (e) => e.ev === "final" &&
          (e.d as { durationMs?: number } | undefined)?.durationMs !== undefined
      );
      expect(entry).toBeDefined();
      expect((entry?.d as { durationMs?: number }).durationMs).toBe(1800);
    });
  });

  // ─── Duplex ears — usage reporting (188-08 Task 3, D-09/D-10) ──────────────

  describe("duplex ears — usage reporting", () => {
    it("onSessionEnd reports usage through reportRealtimeUsage exactly once", () => {
      const chat = makeChat();
      renderVoice(chat);
      act(() => {
        onDuplexSessionEndCallback?.({ seconds: 42 });
      });
      expect(mockReportRealtimeUsage).toHaveBeenCalledTimes(1);
      expect(mockReportRealtimeUsage).toHaveBeenCalledWith(42);
    });

    it("a rejecting reporter does not throw out of the hook or block teardown", () => {
      mockReportRealtimeUsage.mockRejectedValueOnce(new Error("network down"));
      const chat = makeChat();
      renderVoice(chat);
      expect(() => {
        act(() => {
          onDuplexSessionEndCallback?.({ seconds: 7 });
        });
      }).not.toThrow();
      expect(mockReportRealtimeUsage).toHaveBeenCalledWith(7);
    });
  });

  // ─── VOICE-GLUE-01: glue dedupe (188.1-06, D-06/D-07/D-08/D-09/D-16) ───────
  // Every string quoted byte-for-byte from 188.1-CALIBRATION.md's Fixture
  // Corpus / Over-Block Controls tables. See
  // .planning/todos/pending/2026-08-05-voice-transcript-glue-and-wake-phrase-leak.md
  // for the underlying evidence record.

  describe("VOICE-GLUE-01: glue dedupe", () => {
    it('GLUE-A: an accumulator subsume dispatches ONE non-duplicated message ("what does my business calendar look like? " + "...today")', async () => {
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onFinalResultCallback?.("What does my business calendar look like?");
        onFinalResultCallback?.("what does my business calendar look like today");
      });
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      expect(chat.sendMessage).toHaveBeenCalledWith(
      "what does my business calendar look like today",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
    });

    it('GLUE-B: a rejoin trim dispatches the shared span exactly once ("do you have access to higgsfield" + "Access to Higgs Field CLI")', async () => {
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onInterimResultCallback?.("do you have access to higgsfield");
        onFinalResultCallback?.("Access to Higgs Field CLI");
      });
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      expect(chat.sendMessage).toHaveBeenCalledWith(
      "do you have Access to Higgs Field CLI",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
    });

    it("GLUE-COMPOUND: the accepted clause followed by a self-glued rejoin product dispatches the opening clause exactly once, never the observed triple", async () => {
      // 16:28:21-25 live trace: "Is there anything on my" was accepted into
      // the accumulator; a mid-utterance Chrome reset then orphaned the
      // interim "is there anything on my Consulting calendar for", and the
      // tail final "Consulting calendar today?" triggered the rejoin --
      // pre-fix, the RAW rejoin re-glued "Consulting calendar" and the outer
      // accumulator join then re-glued "Is there anything on my" AGAIN,
      // producing the observed triple: "Is there anything on my is there
      // anything on my Consulting calendar for Consulting calendar today?"
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onFinalResultCallback?.("Is there anything on my");
        onInterimResultCallback?.("is there anything on my Consulting calendar for");
        onFinalResultCallback?.("Consulting calendar today?");
      });
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      const dispatched = (chat.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(dispatched).toBe("is there anything on my Consulting calendar for today?");
      // No 3-or-more-word span appears twice in the dispatched string --
      // the property the observed-wrong triple violated three separate
      // ways (the opening clause, the connective, AND "Consulting calendar"
      // all repeated).
      const words = dispatched
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);
      const seenSpans = new Set<string>();
      let duplicatedSpan = false;
      for (let i = 0; i <= words.length - 3; i++) {
        const span = words.slice(i, i + 3).join(" ");
        if (seenSpans.has(span)) duplicatedSpan = true;
        seenSpans.add(span);
      }
      expect(duplicatedSpan).toBe(false);
    });

    it("CTRL-REPEAT: a genuine short emphatic repeat straddling the accumulator boundary dispatches with BOTH copies intact", async () => {
      // Fired as TWO separate finals (the shape 188.1-CALIBRATION.md pins) --
      // never as one final already containing both copies, which would never
      // reach the accumulator's append helper at all and would prove nothing.
      // Needs a warm/open-follow-up context: "Right now." is 2 words, below
      // the COLD noise floor (3 words) -- unrelated to the glue fix itself.
      let chat = makeChat();
      const { rerender } = renderVoice(chat);
      wake();
      chat = setTtsPlaying(rerender, chat, true);
      chat = setTtsPlaying(rerender, chat, false);
      act(() => {
        onFinalResultCallback?.("Right now.");
        onFinalResultCallback?.("Right now.");
      });
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      expect(chat.sendMessage).toHaveBeenCalledWith(
      "Right now. Right now.",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
    });

    it("existing regression: does NOT send the question twice when both ears finalize it (both-ears dedup is upstream of this helper)", async () => {
      duplexStatusValue = "connected";
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onDuplexFinalTranscriptCallback?.("what did we work on today");
        onFinalResultCallback?.("what did we work on today", 0.97);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      expect(chat.sendMessage).toHaveBeenCalledWith(
        "what did we work on today",
        expect.objectContaining({ voice: true })
      );
    });
  });

  // ─── VOICE-GLUE-01 (D-09): the fragment-LOSS case, folded in per the ──────
  // amended ROADMAP criterion 2. 16:29:07-14 live trace: "Is there anything"
  // was accepted, "On" was noise-rejected (dropped before ever reaching the
  // accumulator), then "The news wire about Anthropic today." was accepted --
  // dispatching "Is there anything The news wire about Anthropic today.",
  // the middle of the sentence simply gone.

  describe("VOICE-GLUE-01: fragment-LOSS (GLUE-LOSS, D-09)", () => {
    it("GLUE-LOSS: a mid-accumulation 1-word fragment survives instead of being noise-rejected", async () => {
      const chat = makeChat();
      renderVoice(chat);
      wake();
      act(() => {
        onFinalResultCallback?.("Is there anything"); // starts accumulation, arms the send timer
        onFinalResultCallback?.("On"); // fails only the word-count floor, mid-accumulation
        onFinalResultCallback?.("The news wire about Anthropic today.");
      });
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      const dispatched = (chat.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      // Property assertion per 188.1-CALIBRATION.md (the exact wording a fix
      // produces depends on which mechanism recovers "On", which is
      // implementation work, not calibration scope): the middle token "on"
      // is present, positioned between "anything" and "the news wire", and
      // no 3-or-more-word span repeats.
      expect(/\banything\b[^]*\bon\b[^]*\bnews wire\b/i.test(dispatched)).toBe(true);
      const words = dispatched
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);
      const seenSpans = new Set<string>();
      let duplicatedSpan = false;
      for (let i = 0; i <= words.length - 3; i++) {
        const span = words.slice(i, i + 3).join(" ");
        if (seenSpans.has(span)) duplicatedSpan = true;
        seenSpans.add(span);
      }
      expect(duplicatedSpan).toBe(false);
    });

    it("scoping: a cold 1-word fragment with NO accumulation pending is still rejected", async () => {
      // 188.3 D-05/D-17: wake() call removed — same repair as :461/:2134,
      // since wake() alone now opens a follow-up window and this fixture's
      // intent is specifically the COLD floor.
      const chat = makeChat();
      renderVoice(chat);
      window.__astridrVoiceTrace = [];
      act(() => {
        onFinalResultCallback?.("On");
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(chat.sendMessage).not.toHaveBeenCalled();
      const trace = window.__astridrVoiceTrace ?? [];
      expect(trace.some((entry) => entry.ev === "final.noise-rejected")).toBe(true);
    });

    it("ordering: Plan 04's wake-strip and duration gates still fire while an accumulation is pending", async () => {
      const chat = makeChat();
      const { result } = renderVoice(chat);
      wake();
      act(() => {
        onFinalResultCallback?.("Is there anything"); // starts accumulation, arms the send timer
      });
      act(() => {
        // A wake-phrase-only utterance mid-accumulation is still dropped by
        // the wake-strip gate, which runs BEFORE this task's leniency.
        onDuplexFinalTranscriptCallback?.("Hey Astrid.");
      });
      act(() => {
        // A sub-floor-duration burst mid-accumulation is still dropped by
        // the duration gate, for the same reason.
        onDuplexFinalTranscriptCallback?.("Kulitnya.", 20);
      });
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(chat.sendMessage).toHaveBeenCalledTimes(1);
      expect(chat.sendMessage).toHaveBeenCalledWith(
      "Is there anything",
      expect.objectContaining({ interruptedReply: undefined, voice: true })
    );
      expect(result.current.filteredCount).toBe(2);
    });
  });
});
