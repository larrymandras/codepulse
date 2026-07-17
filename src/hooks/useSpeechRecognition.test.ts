import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechRecognition } from "./useSpeechRecognition";

// ─── Mock SpeechRecognition ──────────────────────────────────────────────────

type MockRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onresult: ((event: MockSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type MockSpeechRecognitionEvent = {
  results: {
    [index: number]: {
      [index: number]: { transcript: string; confidence?: number };
      isFinal: boolean;
    };
    length: number;
  };
  resultIndex: number;
};

let mockRecognition: MockRecognition;

class MockSpeechRecognitionImpl {
  continuous = false;
  interimResults = false;
  lang = "";
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  onresult: ((event: MockSpeechRecognitionEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    mockRecognition = this as unknown as MockRecognition;
  }
}

const MockSpeechRecognitionClass = vi.fn(
  function MockSpeechRecognition(this: MockRecognition) {
    this.continuous = false;
    this.interimResults = false;
    this.lang = "";
    this.start = vi.fn();
    this.stop = vi.fn();
    this.abort = vi.fn();
    this.onresult = null;
    this.onend = null;
    this.onerror = null;
    mockRecognition = this;
  }
);
// Silence unused variable
void MockSpeechRecognitionImpl;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useSpeechRecognition", () => {
  beforeEach(() => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognitionClass);
    MockSpeechRecognitionClass.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("speechAvailable is true when SpeechRecognition global is present", () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: vi.fn() })
    );
    expect(result.current.speechAvailable).toBe(true);
  });

  it("speechAvailable is false when SpeechRecognition global is absent", () => {
    vi.unstubAllGlobals();
    // Remove the global
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);

    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: vi.fn() })
    );
    expect(result.current.speechAvailable).toBe(false);
  });

  it("onFinalResult fires with transcript when recognition delivers a final result", () => {
    const onFinalResult = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult })
    );

    act(() => {
      result.current.start();
    });

    // Simulate final result
    act(() => {
      mockRecognition.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "hello world" }, isFinal: true },
          length: 1,
        },
      });
    });

    expect(onFinalResult).toHaveBeenCalledWith("hello world", undefined);
  });

  // ─── CONV-03 (Phase 183): confidence forwarded additively, no reject logic ──

  it("forwards confidence as the second onFinalResult argument when the result includes it", () => {
    const onFinalResult = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      mockRecognition.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "hello world", confidence: 0.87 }, isFinal: true },
          length: 1,
        },
      });
    });

    expect(onFinalResult).toHaveBeenCalledWith("hello world", 0.87);
  });

  it("still invokes onFinalResult for a short (single-word) dictated transcript — no regression for ChatInput", () => {
    const onFinalResult = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult, continuous: false, interimResults: false })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      mockRecognition.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "yes" }, isFinal: true },
          length: 1,
        },
      });
    });

    // The hook itself must never reject short transcripts — that gate lives
    // only in VoiceModePanel.tsx, never inside this shared hook (Pitfall 3).
    expect(onFinalResult).toHaveBeenCalledWith("yes", undefined);
  });

  it("onInterimResult fires with transcript when interimResults:true and non-final result arrives", () => {
    const onInterimResult = vi.fn();
    const onFinalResult = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult, onInterimResult, interimResults: true })
    );

    act(() => {
      result.current.start();
    });

    // Simulate non-final result
    act(() => {
      mockRecognition.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "hello" }, isFinal: false },
          length: 1,
        },
      });
    });

    expect(onInterimResult).toHaveBeenCalledWith("hello");
    expect(onFinalResult).not.toHaveBeenCalled();
  });

  it("onEnd fires and isListening becomes false when recognition.onend fires", () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: vi.fn(), onEnd })
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      mockRecognition.onend?.();
    });

    expect(result.current.isListening).toBe(false);
    expect(onEnd).toHaveBeenCalled();
  });

  it("start() when already listening does not throw or create a second recognition instance", () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: vi.fn() })
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.isListening).toBe(true);
    const callCountBefore = MockSpeechRecognitionClass.mock.calls.length;

    // Call start again while already listening — should be a no-op
    act(() => {
      result.current.start();
    });

    expect(MockSpeechRecognitionClass.mock.calls.length).toBe(callCountBefore);
  });

  it("configures recognition with provided options on start", () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({
        onFinalResult: vi.fn(),
        continuous: true,
        interimResults: true,
        lang: "fr-FR",
      })
    );

    act(() => {
      result.current.start();
    });

    expect(mockRecognition.continuous).toBe(true);
    expect(mockRecognition.interimResults).toBe(true);
    expect(mockRecognition.lang).toBe("fr-FR");
  });

  it("abort() cleans up recognition and sets isListening false", () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: vi.fn() })
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.abort();
    });

    expect(result.current.isListening).toBe(false);
    expect(mockRecognition.abort).toHaveBeenCalled();
  });
});
