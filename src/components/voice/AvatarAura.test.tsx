/**
 * AvatarAura.test.tsx — Phase 188 Plan 06 (D-16 Tier-1 lipsync)
 *
 * Canvas-context spy coverage of the mouth-region draw call added to
 * AvatarAura's render(t) loop. Stubs HTMLCanvasElement.prototype.getContext
 * with a recorder object so assertions land on 2D-CONTEXT CALL ARGUMENTS
 * (ellipse/beginPath/fill), never on pixels.
 *
 * requestAnimationFrame is stubbed to CAPTURE the loop callback rather than
 * auto-invoke it (auto-invoking recursively would either infinite-loop or,
 * bounded naively, unwind LIFO and corrupt the `now`-vs-`lastDraw` throttle
 * ordering the component relies on). The test drives frames deterministically
 * via a manual tick() helper that calls the captured callback with a strictly
 * increasing timestamp each time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { AvatarAura } from "./AvatarAura";

// Intentionally NOT cast to CanvasRenderingContext2D here — that would erase
// the vi.fn() mock typing (no `.mock.calls` access below). Cast only at the
// point where the object is handed to getContext's mocked return value.
function makeCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    globalCompositeOperation: "source-over",
  };
}

function stubMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/** Fake AnalyserNode: getByteTimeDomainData fills a loud or silent waveform. */
function makeFakeAnalyser(loud: boolean): AnalyserNode {
  return {
    fftSize: 256,
    frequencyBinCount: 128,
    getByteTimeDomainData: (buf: Uint8Array) => {
      for (let i = 0; i < buf.length; i++) {
        // Loud: alternates hard between the byte extremes (RMS ~1.0).
        // Silent/flat: sits at the analyser's zero-crossing midpoint (128).
        buf[i] = loud ? (i % 2 === 0 ? 255 : 0) : 128;
      }
    },
  } as unknown as AnalyserNode;
}

describe("AvatarAura — mouth-region motion (D-16 Tier 1)", () => {
  let ctx: ReturnType<typeof makeCtx>;
  let rafCb: FrameRequestCallback | null;
  let t: number;

  beforeEach(() => {
    ctx = makeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as RenderingContext,
    );
    rafCb = null;
    t = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafCb = cb;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Manually advances the captured rAF loop callback by `deltaMs` (default
   *  comfortably exceeds the component's ~33.33ms/30fps throttle). */
  function tick(deltaMs = 50) {
    t += deltaMs;
    rafCb?.(t);
  }

  it("draws a mouth ellipse while speaking with a loud analyser", () => {
    render(<AvatarAura state="speaking" ttsAnalyser={makeFakeAnalyser(true)} />);
    tick();
    tick();
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it("still draws a mouth ellipse while speaking when ttsAnalyser is null (synthetic breathing fallback — never static, never an error)", () => {
    render(<AvatarAura state="speaking" ttsAnalyser={null} />);
    tick();
    tick();
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it("draws no mouth ellipse when idle", () => {
    render(<AvatarAura state="idle" ttsAnalyser={null} />);
    tick();
    tick();
    expect(ctx.ellipse).not.toHaveBeenCalled();
  });

  it("draws no mouth ellipse while listening (only speaking triggers the mouth)", () => {
    render(<AvatarAura state="listening" ttsAnalyser={null} />);
    tick();
    tick();
    expect(ctx.ellipse).not.toHaveBeenCalled();
  });

  it("renders the mouth as one static (non-pulsing) shape under prefers-reduced-motion", () => {
    // Reduced motion draws exactly one static frame on mount (no rAF loop at
    // all — see AvatarAura.tsx's `if (reduced) { render(0); return; }`).
    // Two successive mounts under the same reduced-motion stub therefore
    // stand in for "two successive frames": both draw via the identical
    // `render(0)` code path, so their recorded ellipse args must match
    // byte-for-byte if the shape is genuinely static rather than pulsing.
    stubMatchMedia(true);
    const { unmount } = render(<AvatarAura state="speaking" ttsAnalyser={null} />);
    const firstArgs = ctx.ellipse.mock.calls.at(-1);
    unmount();

    render(<AvatarAura state="speaking" ttsAnalyser={null} />);
    const secondArgs = ctx.ellipse.mock.calls.at(-1);

    expect(firstArgs).toBeDefined();
    expect(secondArgs).toBeDefined();
    expect(secondArgs).toEqual(firstArgs);
  });
});

/**
 * Regression guard for the 192-01 D-03 diagnostic surface.
 *
 * `mountCount` is incremented unconditionally once the canvas/ctx guards pass,
 * but the reduced-motion branch used to `render(0); return;` — returning no
 * cleanup, so React never ran one and `unmountCount` never moved. Every
 * reduced-motion mount therefore left a permanent +1 mount/unmount imbalance,
 * which is the exact signature the surface exists to detect (StrictMode
 * double-invoke, parent-`key` churn). The instrument manufactured the evidence
 * it was built to gather, and `reducedMotion` is a single overwritten boolean
 * rather than a count, so the skew could not be netted back out by a reader.
 *
 * The animated-path case below is a CONTROL, not redundancy: it passed both
 * before and after the fix. Without it, three failing reduced-motion
 * assertions would be indistinguishable from a broken harness.
 */
describe("AvatarAura — draw-loop lifecycle counters (192-01 D-03)", () => {
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    ctx = makeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as RenderingContext,
    );
    // Capture-only rAF: this block never drives frames, it only cares that a
    // cleanup runs. Returning a handle keeps the animated control realistic.
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    // The bag is a lazily-created window global shared across the whole file;
    // clear it so these assertions are absolute counts, not deltas that some
    // earlier test's mounts could mask.
    delete window.__avatarAuraDebug;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.__avatarAuraDebug;
  });

  function counters() {
    const d = window.__avatarAuraDebug;
    return { mounts: d?.mountCount ?? 0, unmounts: d?.unmountCount ?? 0 };
  }

  it("counts an unmount for every mount under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    const { unmount } = render(
      <AvatarAura state="speaking" ttsAnalyser={null} />,
    );
    expect(counters()).toEqual({ mounts: 1, unmounts: 0 });

    unmount();
    expect(counters()).toEqual({ mounts: 1, unmounts: 1 });
  });

  it("stays balanced across repeated reduced-motion mount/unmount cycles", () => {
    stubMatchMedia(true);
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(
        <AvatarAura state="idle" ttsAnalyser={null} />,
      );
      unmount();
    }
    const c = counters();
    expect(c.mounts).toBe(3);
    // The pre-fix failure mode: mounts climb, unmounts stay pinned at 0.
    expect(c.unmounts).toBe(c.mounts);
  });

  it("control — the animated path was already balanced, so a failure above is the reduced-motion branch and not the harness", () => {
    stubMatchMedia(false);
    const { unmount } = render(<AvatarAura state="idle" ttsAnalyser={null} />);
    unmount();
    expect(counters()).toEqual({ mounts: 1, unmounts: 1 });
  });
});
