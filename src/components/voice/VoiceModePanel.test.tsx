/**
 * VoiceModePanel.test.tsx — Unit tests for the voice mode panel.
 *
 * Covers the 6 behavior points from the plan:
 * 1. final-transcript → sendCommand with { type: 'chat.send', message }
 * 2. run.text event → reply text appended
 * 3. run.tts event → useTtsPlayback.play called
 * 4. isPlaying true → recognition.stop() (feedback guard)
 * 5. isPlaying false (after true) → recognition.start() (feedback guard resumes)
 * 6. end-phrase "stop" → END dispatched, sendCommand NOT called
 * 7. per-state label rendering
 *
 * Phase 92, Plan 04 — TDD RED gate.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import { VoiceModePanel } from "./VoiceModePanel";

// ─── AstridrWSContext mock ────────────────────────────────────────────────────

const mockSendCommand = vi.fn();
const mockSubscribeEvent = vi.fn(() => vi.fn()); // returns unsub function

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribeEvent: mockSubscribeEvent,
    reconnect: vi.fn(),
  }),
}));

// ─── useSpeechRecognition mock ────────────────────────────────────────────────

const mockRecognitionStart = vi.fn();
const mockRecognitionStop = vi.fn();
const mockRecognitionAbort = vi.fn();
let onFinalResultCallback: ((text: string) => void) | null = null;
let onInterimResultCallback: ((text: string) => void) | null = null;

vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: vi.fn((options: {
    onFinalResult: (text: string) => void;
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
  }),
}));

// ─── useTtsPlayback mock ──────────────────────────────────────────────────────

let mockIsPlaying = false;
const mockTtsPlay = vi.fn();
const mockTtsStop = vi.fn();

vi.mock("@/hooks/useTtsPlayback", () => ({
  useTtsPlayback: vi.fn(() => ({
    play: mockTtsPlay,
    stop: mockTtsStop,
    isPlaying: mockIsPlaying,
  })),
}));

// ─── Helper: get the subscribeEvent handler for a given event type ────────────

function getSubscribeHandler(eventType: string) {
  const calls = (mockSubscribeEvent as unknown as MockInstance).mock.calls;
  const call = calls.find((c: unknown[]) => c[0] === eventType);
  return call ? (call[1] as (event: Record<string, unknown>) => void) : null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("VoiceModePanel", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onFinalResultCallback = null;
    onInterimResultCallback = null;
    mockIsPlaying = false;
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "req-1",
      status: "ok",
      session_id: "sess-abc",
    });
    mockSubscribeEvent.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Per-state label rendering ──────────────────────────────────────────

  it("renders 'Listening…' label when state is listening", () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);
    expect(screen.getByText(/listening/i)).toBeInTheDocument();
  });

  it("renders 'Hearing you' label when state is transcribing", () => {
    render(<VoiceModePanel voiceState="transcribing" onClose={onClose} />);
    expect(screen.getByText(/hearing you/i)).toBeInTheDocument();
  });

  it("renders 'Thinking…' label when state is processing", () => {
    render(<VoiceModePanel voiceState="processing" onClose={onClose} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("renders 'Ástríðr speaking' label when state is speaking", () => {
    render(<VoiceModePanel voiceState="speaking" onClose={onClose} />);
    // The label contains "speaking"
    expect(screen.getByText(/speaking/i)).toBeInTheDocument();
  });

  it("renders 'Voice unavailable' label when state is error-disabled", () => {
    render(<VoiceModePanel voiceState="error-disabled" onClose={onClose} />);
    expect(screen.getByText(/voice unavailable/i)).toBeInTheDocument();
  });

  // ─── 2. Close button present ────────────────────────────────────────────────

  it("renders close button with aria-label", () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);
    expect(screen.getByRole("button", { name: /close voice mode/i })).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /close voice mode/i }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  // ─── 3. Final transcript → sendCommand with chat.send ──────────────────────

  it("sends chat.send after the end-of-turn pause (non-end-phrase)", async () => {
    vi.useFakeTimers();
    try {
      render(<VoiceModePanel voiceState="listening" onClose={onClose} />);

      await act(async () => {
        onFinalResultCallback?.("show me agents");
      });

      // Pause-to-send: nothing is sent until ~2s of silence elapses.
      expect(mockSendCommand).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(mockSendCommand).toHaveBeenCalledWith({
        type: "chat.send",
        message: "show me agents",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("accumulates segments across a pause and sends them as one message", async () => {
    vi.useFakeTimers();
    try {
      render(<VoiceModePanel voiceState="listening" onClose={onClose} />);

      // Two finalized segments split by a mid-thought pause...
      await act(async () => {
        onFinalResultCallback?.("show me the agents");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800); // shorter than the 2s debounce
      });
      await act(async () => {
        onFinalResultCallback?.("that are online");
      });

      // ...are still unsent until the full pause elapses,
      expect(mockSendCommand).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      // ...then sent as a single combined utterance.
      expect(mockSendCommand).toHaveBeenCalledTimes(1);
      expect(mockSendCommand).toHaveBeenCalledWith({
        type: "chat.send",
        message: "show me the agents that are online",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // ─── 4. End-phrase → END dispatched, sendCommand NOT called ────────────────

  it("does NOT call sendCommand when final transcript is end-phrase 'stop'", async () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);

    await act(async () => {
      onFinalResultCallback?.("stop");
    });

    expect(mockSendCommand).not.toHaveBeenCalled();
  });

  it("calls onClose when end-phrase 'stop' received", async () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);

    await act(async () => {
      onFinalResultCallback?.("stop");
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT call sendCommand for end-phrase 'goodbye'", async () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);

    await act(async () => {
      onFinalResultCallback?.("goodbye");
    });

    expect(mockSendCommand).not.toHaveBeenCalled();
  });

  // ─── 5. run.text event → reply text appended ───────────────────────────────

  it("appends text chunks from run.text events to reply stream", async () => {
    render(<VoiceModePanel voiceState="speaking" onClose={onClose} />);

    const textHandler = getSubscribeHandler("run.text");
    expect(textHandler).toBeTruthy();

    await act(async () => {
      textHandler?.({ data: { text_chunk: "Hello " } });
      textHandler?.({ data: { text_chunk: "world" } });
    });

    expect(screen.getByText(/hello\s*world/i)).toBeInTheDocument();
  });

  // ─── 6. run.tts event → useTtsPlayback.play called ────────────────────────

  it("calls useTtsPlayback.play with audio_url from run.tts event", async () => {
    render(<VoiceModePanel voiceState="processing" onClose={onClose} />);

    const ttsHandler = getSubscribeHandler("run.tts");
    expect(ttsHandler).toBeTruthy();

    await act(async () => {
      ttsHandler?.({ data: { session_id: "sess-abc", audio_url: "/api/audio/reply.mp3" } });
    });

    expect(mockTtsPlay).toHaveBeenCalledWith("/api/audio/reply.mp3");
  });

  // ─── 7. Feedback guard / echo guard (CONV-01, D-06, rewritten) ─────────────
  // The recognizer must now stay LIVE through `speaking` — barge-in is
  // impossible without a live recognizer during TTS playback.

  it("does NOT call recognition.stop when isPlaying becomes true (barge-in requires a live recognizer)", async () => {
    mockIsPlaying = false;
    const { unmount, rerender } = render(
      <VoiceModePanel voiceState="listening" onClose={onClose} />
    );

    const { useTtsPlayback } = await import("@/hooks/useTtsPlayback");
    (useTtsPlayback as unknown as MockInstance).mockReturnValue({
      play: mockTtsPlay,
      stop: mockTtsStop,
      isPlaying: true,
    });

    await act(async () => {
      rerender(<VoiceModePanel voiceState="speaking" onClose={onClose} />);
    });

    expect(mockRecognitionStop).not.toHaveBeenCalled();

    unmount();
  });

  // ─── 9. Barge-in (CONV-01, D-06/D-08/D-11/D-12) ────────────────────────────

  it("fires agent.stop with the tracked session_id and pauses TTS audio on a barge-in phrase during speaking", async () => {
    render(<VoiceModePanel voiceState="speaking" onClose={onClose} />);

    // Establish an active session the same way flushSend does — simulate a
    // prior chat.send ack that set activeSessionRef via a run.tts/run.text flow.
    // Since this test starts already in "speaking", we exercise the barge-in
    // path directly against whatever activeSessionRef currently holds (null by
    // default, matching the component's fallback).
    await act(async () => {
      onFinalResultCallback?.("stop");
    });

    expect(mockTtsStop).toHaveBeenCalled();
    expect(mockSendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "agent.stop", session_id: null })
    );
  });

  it("shows the interrupt flash on a recognized barge-in phrase during speaking", async () => {
    render(<VoiceModePanel voiceState="speaking" onClose={onClose} />);

    await act(async () => {
      onFinalResultCallback?.("wait");
    });

    expect(screen.getByText(/— interrupted —/i)).toBeInTheDocument();
  });

  it("drops a non-barge-in transcript recognized during speaking (echo guard) — no chat.send, no flash", async () => {
    render(<VoiceModePanel voiceState="speaking" onClose={onClose} />);

    await act(async () => {
      onFinalResultCallback?.("show me the agents dashboard");
    });

    expect(mockSendCommand).not.toHaveBeenCalled();
    expect(screen.queryByText(/— interrupted —/i)).not.toBeInTheDocument();
  });

  it("carries interrupted_reply (from the reply accumulator) on the chat.send after a barge-in", async () => {
    vi.useFakeTimers();
    try {
      render(<VoiceModePanel voiceState="speaking" onClose={onClose} />);

      // She had streamed a partial reply before being interrupted.
      const textHandler = getSubscribeHandler("run.text");
      await act(async () => {
        textHandler?.({ data: { text_chunk: "The weather today is" } });
      });

      // Barge-in fires.
      await act(async () => {
        onFinalResultCallback?.("wait");
      });

      mockSendCommand.mockClear();

      // The next turn's utterance lands (component transitions out of
      // "speaking" via BARGE_IN internally — the reducer moves to
      // "transcribing", so a subsequent final result flows through the normal
      // accumulate/flush path).
      await act(async () => {
        onFinalResultCallback?.("never mind, what's the weather in tokyo");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(mockSendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chat.send",
          interrupted_reply: "The weather today is",
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // ─── 8. aria-live regions ───────────────────────────────────────────────────

  it("has aria-live=assertive on state label", () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);
    const assertive = document.querySelector('[aria-live="assertive"]');
    expect(assertive).toBeInTheDocument();
  });

  it("has aria-live=polite on transcript area", () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);
    const polite = document.querySelectorAll('[aria-live="polite"]');
    expect(polite.length).toBeGreaterThanOrEqual(1);
  });

  // ─── 10. Follow-up window + Strict Mode (CONV-02, D-05) ────────────────────

  async function triggerTtsEnd(strictMode: boolean) {
    const { useTtsPlayback } = await import("@/hooks/useTtsPlayback");
    (useTtsPlayback as unknown as MockInstance).mockReturnValue({
      play: mockTtsPlay,
      stop: mockTtsStop,
      isPlaying: true,
    });
    const { rerender, unmount } = render(
      <VoiceModePanel voiceState="speaking" onClose={onClose} strictMode={strictMode} />
    );
    (useTtsPlayback as unknown as MockInstance).mockReturnValue({
      play: mockTtsPlay,
      stop: mockTtsStop,
      isPlaying: false,
    });
    await act(async () => {
      rerender(
        <VoiceModePanel voiceState="speaking" onClose={onClose} strictMode={strictMode} />
      );
    });
    return unmount;
  }

  it("strict-off TTS_END opens the follow-up window: countdown bar + 'Still listening…'", async () => {
    const unmount = await triggerTtsEnd(false);
    expect(screen.getByText(/still listening/i)).toBeInTheDocument();
    expect(document.querySelector(".h-\\[3px\\]")).toBeInTheDocument();
    unmount();
  });

  it("strict-on TTS_END renders neither the countdown bar nor 'Still listening…'", async () => {
    const unmount = await triggerTtsEnd(true);
    expect(screen.queryByText(/still listening/i)).not.toBeInTheDocument();
    expect(document.querySelector(".h-\\[3px\\]")).not.toBeInTheDocument();
    unmount();
  });

  it("dispatches FOLLOW_UP_EXPIRE at the 14s timeout (window closes silently)", async () => {
    vi.useFakeTimers();
    try {
      const unmount = await triggerTtsEnd(false);
      expect(screen.getByText(/still listening/i)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(14_100);
      });

      expect(screen.queryByText(/still listening/i)).not.toBeInTheDocument();
      expect(screen.getByText(/^idle$/i)).toBeInTheDocument();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("intercepts a spoken 'strict mode on' command before dispatch — calls onStrictModeChange, no chat.send", async () => {
    const onStrictModeChange = vi.fn();
    render(
      <VoiceModePanel
        voiceState="listening"
        onClose={onClose}
        strictMode={false}
        onStrictModeChange={onStrictModeChange}
      />
    );

    await act(async () => {
      onFinalResultCallback?.("strict mode on");
    });

    expect(onStrictModeChange).toHaveBeenCalledWith(true);
    expect(mockSendCommand).not.toHaveBeenCalled();
  });

  it("intercepts a spoken 'strict mode off' command — calls onStrictModeChange(false), no chat.send", async () => {
    const onStrictModeChange = vi.fn();
    render(
      <VoiceModePanel
        voiceState="listening"
        onClose={onClose}
        strictMode={true}
        onStrictModeChange={onStrictModeChange}
      />
    );

    await act(async () => {
      onFinalResultCallback?.("strict mode off");
    });

    expect(onStrictModeChange).toHaveBeenCalledWith(false);
    expect(mockSendCommand).not.toHaveBeenCalled();
  });
});
