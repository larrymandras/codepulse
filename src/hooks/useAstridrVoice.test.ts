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
import { useAstridrVoice, isEchoOfReply, stripEchoPrefix } from "./useAstridrVoice";
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
    const chat = makeChat();
    renderVoice(chat);
    wake();
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
    expect(chat.sendMessage).toHaveBeenCalledWith("what's the weather like tomorrow", {
      interruptedReply: undefined,
      voice: true,
    });
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
      { interruptedReply: undefined, voice: true }
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
    expect(chat.sendMessage).toHaveBeenCalledWith("continue", {
      interruptedReply: "partial reply so far",
      voice: true,
    });
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
    expect(chat.sendMessage).toHaveBeenCalledWith("Goodbye.", {
      interruptedReply: undefined,
      voice: true,
    });
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
    expect(chat.sendMessage).toHaveBeenCalledWith("Thanks.", {
      interruptedReply: undefined,
      voice: true,
    });
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
    expect(chat.sendMessage).toHaveBeenCalledWith("yes", { interruptedReply: undefined, voice: true });
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
    expect(chat.sendMessage).toHaveBeenCalledWith(" is there anything else I can assist".trim(), {
      interruptedReply: undefined,
      voice: true,
    });
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

  it("talk-over with content: non-echo speech during speaking interrupts AND becomes the message", async () => {
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
    expect(chat.interrupt).toHaveBeenCalled(); // interrupted her
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(chat.sendMessage).toHaveBeenCalledWith("actually just give me Tuesday please", {
      interruptedReply: "the weather tomorrow is",
      voice: true,
    });
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
    expect(chat.sendMessage).toHaveBeenCalledWith("no", { interruptedReply: undefined, voice: true });
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
    expect(chat.sendMessage).toHaveBeenCalledWith("no I'm good thank you", {
      interruptedReply: undefined,
      voice: true,
    });
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
    let chat = makeChat({
      interrupt: vi.fn(() => "partial"),
      streamingReplyRef: { current: "Tomorrow brings rain showers near ninety degrees" },
    } as Partial<AstridrChat>);
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    act(() => {
      onInterimResultCallback?.("stop"); // barge-in cuts TTS
    });
    chat = setTtsPlaying(rerender, chat, false); // TTS stops BECAUSE of the barge
    expect(result.current.followUpOpen).toBe(false);
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
});
