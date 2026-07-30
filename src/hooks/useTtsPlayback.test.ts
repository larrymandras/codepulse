import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTtsPlayback } from "./useTtsPlayback";

// ─── Mock Audio ───────────────────────────────────────────────────────────────

type MockAudio = {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  src: string;
};

let mockAudio: MockAudio;

function MockAudioClass(this: MockAudio, src: string) {
  this.src = src;
  this.play = vi.fn(() => Promise.resolve());
  this.pause = vi.fn();
  this.onended = null;
  // Store reference for test introspection
  mockAudio = this;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useTtsPlayback", () => {
  beforeEach(() => {
    vi.stubGlobal("Audio", MockAudioClass);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("play() sets isPlaying true and calls audio.play()", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    expect(result.current.isPlaying).toBe(false);

    await act(async () => {
      result.current.play("https://example.com/audio.mp3");
      // Allow the play() promise to settle
      await Promise.resolve();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it("audio.onended sets isPlaying false", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    await act(async () => {
      result.current.play("https://example.com/audio.mp3");
      await Promise.resolve();
    });

    expect(result.current.isPlaying).toBe(true);

    // Simulate audio finishing
    act(() => {
      mockAudio.onended?.();
    });

    expect(result.current.isPlaying).toBe(false);
  });

  it("play() constructs full URL from relative audio_url", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    await act(async () => {
      result.current.play("/api/audio/file.mp3");
      await Promise.resolve();
    });

    // Should have constructed an absolute URL (default base is http://localhost:8181)
    expect(mockAudio.src).toBe("http://localhost:8181/api/audio/file.mp3");
  });

  it("play() passes absolute http URLs through unchanged", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    await act(async () => {
      result.current.play("https://cdn.example.com/audio.mp3");
      await Promise.resolve();
    });

    expect(mockAudio.src).toBe("https://cdn.example.com/audio.mp3");
  });

  it("stop() pauses audio and sets isPlaying false", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    await act(async () => {
      result.current.play("https://example.com/audio.mp3");
      await Promise.resolve();
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  // ─── Duplicate run.tts must not cut a live reply (live 2026-07-30) ─────────
  // The backend emits run.tts TWICE for one reply with an IDENTICAL url
  // (tts_00d8a35b1fec.mp3, 8ms apart). Playback is replacement-based, so the
  // second event tore down playback 1 and started playback 2. It was harmless
  // only because it landed at currentTime:0 — arriving after audio has begun,
  // it cuts her mid-sentence and logs barged:false, which is exactly the
  // "she got cut off while I was silent" symptom.
  it("a duplicate play() of the SAME url does not tear down live playback", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    await act(async () => {
      result.current.play("https://example.com/reply.mp3");
      await Promise.resolve();
    });
    const firstAudio = mockAudio;

    await act(async () => {
      result.current.play("https://example.com/reply.mp3"); // same url, duplicate event
      await Promise.resolve();
    });

    expect(firstAudio.pause).not.toHaveBeenCalled();
    expect(mockAudio).toBe(firstAudio); // no replacement element was created
    expect(result.current.isPlaying).toBe(true);
  });

  it("a DIFFERENT url still replaces — genuine chunked TTS is unaffected", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    await act(async () => {
      result.current.play("https://example.com/chunk-1.mp3");
      await Promise.resolve();
    });
    const firstAudio = mockAudio;

    await act(async () => {
      result.current.play("https://example.com/chunk-2.mp3");
      await Promise.resolve();
    });

    expect(firstAudio.pause).toHaveBeenCalled();
    expect(mockAudio).not.toBe(firstAudio);
  });

  it("the same url plays again once the previous playback has ENDED", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    await act(async () => {
      result.current.play("https://example.com/reply.mp3");
      await Promise.resolve();
    });
    const firstAudio = mockAudio;

    act(() => {
      firstAudio.onended?.(); // natural completion
    });
    expect(result.current.isPlaying).toBe(false);

    await act(async () => {
      result.current.play("https://example.com/reply.mp3"); // e.g. REPLAY
      await Promise.resolve();
    });

    expect(mockAudio).not.toBe(firstAudio);
    expect(result.current.isPlaying).toBe(true);
  });

  it("play() while audio is already playing replaces the prior audio (pauses old one first)", async () => {
    const { result } = renderHook(() => useTtsPlayback());

    // First play
    await act(async () => {
      result.current.play("https://example.com/first.mp3");
      await Promise.resolve();
    });

    const firstAudio = mockAudio;

    // Second play while first is still playing
    await act(async () => {
      result.current.play("https://example.com/second.mp3");
      await Promise.resolve();
    });

    // First audio should have been paused
    expect(firstAudio.pause).toHaveBeenCalled();
    // New audio should be playing
    expect(result.current.isPlaying).toBe(true);
    expect(mockAudio.src).toBe("https://example.com/second.mp3");
  });
});
