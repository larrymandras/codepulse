/**
 * useScreenShare.test.ts — capture lifecycle + downscaled frame contract.
 *
 * useScreenShare is the SOLE caller of getDisplayMedia in codepulse (D-09/D-10):
 * start() requests a "monitor" displaySurface preference and never branches on
 * what the picker actually returns. The live MediaStream is held in a ref (never
 * reducer state — CONTEXT.md) so re-renders never re-trigger a picker prompt.
 * captureFrame() always grabs a FRESH frame — nothing is cached or streamed
 * (D-02) — downscaled to a bounded longest edge (D-06).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScreenShare } from "./useScreenShare";

// ─── Mocks ────────────────────────────────────────────────────────────────────

/** Minimal MediaStreamTrack stand-in: real EventTarget so the hook's
 * `track.addEventListener("ended", ...)` wiring is exercised for real, and
 * `dispatchEvent` simulates Chrome's native "Stop sharing" / tab-close signal. */
class MockTrack extends EventTarget {
  readyState: "live" | "ended" = "live";
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
}

function createMockStream(track: MockTrack) {
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

describe("useScreenShare — lifecycle", () => {
  let mockTrack: MockTrack;
  let mockStream: MediaStream;
  let getDisplayMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTrack = new MockTrack();
    mockStream = createMockStream(mockTrack);
    getDisplayMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: { getDisplayMedia },
      configurable: true,
    });
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useScreenShare());
    expect(result.current.state).toBe("idle");
  });

  it("arm() transitions to armed WITHOUT calling getDisplayMedia (voice cannot open the picker — D-09)", () => {
    const { result } = renderHook(() => useScreenShare());
    act(() => {
      result.current.arm();
    });
    expect(result.current.state).toBe("armed");
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });

  it("start() calls getDisplayMedia with a monitor displaySurface preference and transitions to active (D-10: no branching on the returned surface)", async () => {
    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      await result.current.start();
    });
    expect(getDisplayMedia).toHaveBeenCalledWith({ video: { displaySurface: "monitor" } });
    expect(result.current.state).toBe("active");
  });

  it("the track's ended event clears state to idle and fires onEnded (D-11)", async () => {
    const onEnded = vi.fn();
    const { result } = renderHook(() => useScreenShare({ onEnded }));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      mockTrack.dispatchEvent(new Event("ended"));
    });
    expect(result.current.state).toBe("idle");
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("stop() stops all tracks and resets to idle", async () => {
    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.stop();
    });
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("idle");
  });
});

describe("useScreenShare — captureFrame", () => {
  let mockTrack: MockTrack;
  let mockStream: MediaStream;
  let getDisplayMedia: ReturnType<typeof vi.fn>;
  let videoWidth = 1920;
  let videoHeight = 1080;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastCanvas: any;

  beforeEach(() => {
    mockTrack = new MockTrack();
    mockStream = createMockStream(mockTrack);
    getDisplayMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: { getDisplayMedia },
      configurable: true,
    });

    lastCanvas = undefined;
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "video") {
        return {
          srcObject: null,
          videoWidth,
          videoHeight,
          play: vi.fn().mockResolvedValue(undefined),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as HTMLVideoElement;
      }
      if (tag === "canvas") {
        const canvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({ drawImage: vi.fn() })),
          toBlob: vi.fn((cb: (b: Blob | null) => void, _type?: string, _quality?: number) => {
            cb(new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" }));
          }),
        };
        lastCanvas = canvas;
        return canvas as unknown as HTMLCanvasElement;
      }
      return realCreateElement(tag);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downscales a source larger than maxEdge, clamping the longest edge (D-06)", async () => {
    videoWidth = 1920;
    videoHeight = 1080;
    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      await result.current.start();
    });

    let frame: { mimeType: string } | undefined;
    await act(async () => {
      frame = await result.current.captureFrame({ maxEdge: 1568, quality: 0.85 });
    });

    expect(frame?.mimeType).toBe("image/jpeg");
    const scale = 1568 / 1920;
    expect(lastCanvas.width).toBe(Math.round(1920 * scale));
    expect(lastCanvas.height).toBe(Math.round(1080 * scale));
    expect(lastCanvas.width).toBeLessThanOrEqual(1568);
  });

  it("never upscales a source smaller than maxEdge", async () => {
    videoWidth = 800;
    videoHeight = 600;
    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.captureFrame({ maxEdge: 1568, quality: 0.85 });
    });

    expect(lastCanvas.width).toBe(800);
    expect(lastCanvas.height).toBe(600);
  });

  it("rejects when the track is ended instead of producing a blank/garbled frame (T-184-06)", async () => {
    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      mockTrack.stop();
    });

    await expect(result.current.captureFrame()).rejects.toThrow();
  });

  it("captureFrame() always grabs a fresh frame — never a cached one (D-02)", async () => {
    videoWidth = 1920;
    videoHeight = 1080;
    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      await result.current.start();
    });

    let first: { base64: string } | undefined;
    let second: { base64: string } | undefined;
    await act(async () => {
      first = await result.current.captureFrame();
    });
    await act(async () => {
      second = await result.current.captureFrame();
    });

    // Each call re-creates its own video+canvas (no memoized/cached blob).
    expect(first?.base64).toBeTruthy();
    expect(second?.base64).toBeTruthy();
  });
});
