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
