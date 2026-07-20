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
import { useAstridrVoice } from "./useAstridrVoice";
import type { AstridrChat } from "./useAstridrChat";

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

vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: vi.fn(
    (options: {
      onFinalResult: (text: string, confidence?: number) => void;
      onInterimResult?: (text: string) => void;
    }) => {
      onFinalResultCallback = options.onFinalResult;
      onInterimResultCallback = options.onInterimResult ?? null;
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
      { interruptedReply: undefined }
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

  it("'goodbye' ends the conversation and re-arms (recognition stopped)", () => {
    const { result } = renderVoice(makeChat());
    wake();
    act(() => {
      onFinalResultCallback?.("Goodbye.");
    });
    expect(result.current.voiceState).toBe("idle");
    expect(mockRecognitionStop).toHaveBeenCalled();
    expect(result.current.conversationActive).toBe(false);
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
    expect(chat.sendMessage).toHaveBeenCalledWith("yes", { interruptedReply: undefined });
  });

  it("follow-up window expiry re-arms the wake word", () => {
    let chat = makeChat();
    const { result, rerender } = renderVoice(chat);
    wake();
    chat = setTtsPlaying(rerender, chat, true);
    chat = setTtsPlaying(rerender, chat, false);
    expect(result.current.followUpOpen).toBe(true);
    act(() => {
      vi.advanceTimersByTime(14_000);
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
