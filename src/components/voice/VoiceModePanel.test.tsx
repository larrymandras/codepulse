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

  it("sends chat.send when final transcript received (non-end-phrase)", async () => {
    render(<VoiceModePanel voiceState="listening" onClose={onClose} />);

    await act(async () => {
      onFinalResultCallback?.("show me agents");
    });

    await waitFor(() => {
      expect(mockSendCommand).toHaveBeenCalledWith({
        type: "chat.send",
        message: "show me agents",
      });
    });
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

  // ─── 7. Feedback guard ──────────────────────────────────────────────────────
  // These tests use the module mock to control isPlaying via re-import.
  // We test the reactive effect via the useEffect that watches isPlaying.
  // Note: feedback guard is tested as an integration behavior via the panel's
  // internal useEffect — we spy on recognition.stop/start being invoked.

  it("calls recognition.stop when isPlaying becomes true", async () => {
    // Start with isPlaying=false, render panel
    mockIsPlaying = false;
    const { unmount, rerender } = render(
      <VoiceModePanel voiceState="listening" onClose={onClose} />
    );

    // Simulate isPlaying flipping to true by patching mock and re-rendering
    const { useTtsPlayback } = await import("@/hooks/useTtsPlayback");
    (useTtsPlayback as unknown as MockInstance).mockReturnValue({
      play: mockTtsPlay,
      stop: mockTtsStop,
      isPlaying: true,
    });

    await act(async () => {
      rerender(<VoiceModePanel voiceState="speaking" onClose={onClose} />);
    });

    expect(mockRecognitionStop).toHaveBeenCalled();

    unmount();
  });

  it("calls recognition.start when isPlaying transitions from true to false", async () => {
    const { useTtsPlayback } = await import("@/hooks/useTtsPlayback");

    // First render with isPlaying=true
    (useTtsPlayback as unknown as MockInstance).mockReturnValue({
      play: mockTtsPlay,
      stop: mockTtsStop,
      isPlaying: true,
    });

    const { rerender, unmount } = render(
      <VoiceModePanel voiceState="speaking" onClose={onClose} />
    );

    // Now isPlaying flips to false
    (useTtsPlayback as unknown as MockInstance).mockReturnValue({
      play: mockTtsPlay,
      stop: mockTtsStop,
      isPlaying: false,
    });

    await act(async () => {
      rerender(<VoiceModePanel voiceState="speaking" onClose={onClose} />);
    });

    expect(mockRecognitionStart).toHaveBeenCalled();

    unmount();
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
});
