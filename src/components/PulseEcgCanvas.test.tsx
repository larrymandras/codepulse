/**
 * PulseEcgCanvas.test.tsx — Phase 125 Plan 06.
 *
 * Proves D-11's render-loop gates, D-06's colour pass-through, D-08's
 * empty-state split, and the 60s window bound, against a RECORDING fake 2D
 * context (never pixels) so the colour claim is a behavioural assertion,
 * not a source grep. Canvas-under-jsdom conventions (stub
 * HTMLCanvasElement.prototype.getContext, capture rather than auto-invoke
 * requestAnimationFrame) follow AvatarAura.test.tsx — this project's house
 * pattern for a jsdom canvas test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PulseEcgCanvas, drawEcgFrame } from "./PulseEcgCanvas";
import type { EcgBlip, EcgPalette } from "./PulseEcgCanvas";

const PALETTE: EcgPalette = {
  astridr: "oklch(0.6 0.2 300)",
  machine: "oklch(0.7 0.15 200)",
  error: "oklch(0.65 0.18 27)",
  baseline: "oklch(0.556 0 0)",
};

/**
 * Recording fake 2D context: `fillStyle`/`strokeStyle` setters push their
 * assigned values onto a log, path methods push their call args onto a
 * shared log. The `fillStyle` setter deliberately mirrors real <canvas>
 * behaviour — an empty string is silently ignored rather than assigned —
 * because PulseEcgCanvas.tsx's sentinel check depends on exactly that
 * no-op.
 */
function makeRecordingCtx() {
  const strokeStyleLog: string[] = [];
  const fillStyleLog: string[] = [];
  const calls: { method: string; args: unknown[] }[] = [];
  let _strokeStyle = "";
  let _fillStyle = "";
  const ctx = {
    clearRect: (...args: unknown[]) => calls.push({ method: "clearRect", args }),
    beginPath: (...args: unknown[]) => calls.push({ method: "beginPath", args }),
    moveTo: (...args: unknown[]) => calls.push({ method: "moveTo", args }),
    lineTo: (...args: unknown[]) => calls.push({ method: "lineTo", args }),
    stroke: (...args: unknown[]) => calls.push({ method: "stroke", args }),
    setLineDash: (...args: unknown[]) => calls.push({ method: "setLineDash", args }),
    get strokeStyle() {
      return _strokeStyle;
    },
    set strokeStyle(v: string) {
      _strokeStyle = v;
      strokeStyleLog.push(v);
    },
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(v: string) {
      if (v === "") return; // real <canvas> ignores an unparseable value
      _fillStyle = v;
      fillStyleLog.push(v);
    },
    lineWidth: 0,
    globalAlpha: 1,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, strokeStyleLog, fillStyleLog, calls };
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

// ─── drawEcgFrame — pure function, no component needed ─────────────────────

describe("drawEcgFrame — colour path, spike direction, window bound", () => {
  it("(a) hands the palette's oklch strings straight to strokeStyle — never converted, never substituted", () => {
    const { ctx, strokeStyleLog } = makeRecordingCtx();
    const now = 10_000;
    const blips: EcgBlip[] = [
      { t: now - 1000, hue: "machine" },
      { t: now - 2000, hue: "astridr" },
      { t: now - 3000, hue: "error" },
    ];
    drawEcgFrame(ctx, {
      width: 300,
      height: 96,
      dpr: 1,
      now,
      blips,
      feedState: "live",
      palette: PALETTE,
      animate: true,
    });
    expect(strokeStyleLog).toContain(PALETTE.machine);
    expect(strokeStyleLog).toContain(PALETTE.astridr);
    expect(strokeStyleLog).toContain(PALETTE.error);
    // Control: nothing was converted or substituted on the way in.
    expect(strokeStyleLog.some((s) => /^rgb/.test(s))).toBe(false);
    expect(strokeStyleLog.some((s) => /^#/.test(s))).toBe(false);
  });

  it("(b) error blips spike DOWN, machine blips spike UP — one test, both directions, so a sign flip cannot pass", () => {
    const { ctx, calls } = makeRecordingCtx();
    const now = 10_000;
    const mid = 96 * 0.62;
    drawEcgFrame(ctx, {
      width: 300,
      height: 96,
      dpr: 1,
      now,
      blips: [
        { t: now - 500, hue: "error" },
        { t: now - 1500, hue: "machine" },
      ],
      feedState: "live",
      palette: PALETTE,
      animate: true,
    });
    const lineToYs = calls.filter((c) => c.method === "lineTo").map((c) => c.args[1] as number);
    const blipYs = lineToYs.filter((y) => y !== mid); // exclude the baseline's own lineTo
    expect(Math.max(...blipYs)).toBeGreaterThan(mid); // error: below baseline (larger y)
    expect(Math.min(...blipYs)).toBeLessThan(mid); // machine: above baseline (smaller y)
  });

  it("(c) drops a blip at the 60s window edge, keeps one just inside — two assertions, one control pair", () => {
    const now = 60_000;

    const { ctx: ctxDropped, calls: callsDropped } = makeRecordingCtx();
    drawEcgFrame(ctxDropped, {
      width: 300,
      height: 96,
      dpr: 1,
      now,
      blips: [{ t: now - 60_000, hue: "machine" }], // age === windowMs -> dropped
      feedState: "live",
      palette: PALETTE,
      animate: true,
    });
    const baselineOnlyPathCalls = callsDropped.filter(
      (c) => c.method === "moveTo" || c.method === "lineTo",
    ).length;

    const { ctx: ctxKept, calls: callsKept } = makeRecordingCtx();
    drawEcgFrame(ctxKept, {
      width: 300,
      height: 96,
      dpr: 1,
      now,
      blips: [{ t: now - 59_999, hue: "machine" }], // age === windowMs - 1 -> kept
      feedState: "live",
      palette: PALETTE,
      animate: true,
    });
    const withBlipPathCalls = callsKept.filter((c) => c.method === "moveTo" || c.method === "lineTo").length;

    expect(withBlipPathCalls).toBeGreaterThan(baselineOnlyPathCalls);
  });
});

// ─── PulseEcgCanvas — render loop gates (D-11) ──────────────────────────────

describe("PulseEcgCanvas — render loop gates (D-11)", () => {
  let rafSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const { ctx } = makeRecordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as RenderingContext);
    rafSpy = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", rafSpy);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    document.documentElement.dataset.theme = "cyan";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete document.documentElement.dataset.theme;
  });

  it("(d) draws one static frame and calls requestAnimationFrame ZERO times under reduced motion", () => {
    stubMatchMedia(true);
    render(<PulseEcgCanvas blips={[]} feedState="idle" />);
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("(d control) calls requestAnimationFrame when motion is not reduced — proves (d) is about the gate, not a component that never draws", () => {
    stubMatchMedia(false);
    render(<PulseEcgCanvas blips={[]} feedState="idle" />);
    expect(rafSpy).toHaveBeenCalled();
  });

  it("(f) the readable theme stops the loop — requestAnimationFrame is called ZERO times", () => {
    stubMatchMedia(false);
    document.documentElement.dataset.theme = "readable";
    render(<PulseEcgCanvas blips={[]} feedState="idle" />);
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("(f control) a non-readable theme keeps the loop running", () => {
    stubMatchMedia(false);
    document.documentElement.dataset.theme = "cyan";
    render(<PulseEcgCanvas blips={[]} feedState="idle" />);
    expect(rafSpy).toHaveBeenCalled();
  });
});

// ─── PulseEcgCanvas — hidden-tab gate (D-11) ────────────────────────────────

describe("PulseEcgCanvas — hidden-tab gate (D-11)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });

  it("(e) stops drawing while document.hidden is true, but keeps scheduling requestAnimationFrame", () => {
    stubMatchMedia(false);
    document.documentElement.dataset.theme = "cyan";
    // A holder object, not a reassignable `let` -- avoids TS narrowing the
    // captured-in-a-closure variable to `never` at the read sites below.
    const captured: { cb: FrameRequestCallback | null } = { cb: null };
    const raf = vi.fn((cb: FrameRequestCallback) => {
      captured.cb = cb;
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { ctx, calls } = makeRecordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as RenderingContext);

    render(<PulseEcgCanvas blips={[]} feedState="idle" />);
    const callsAfterMount = calls.length;
    const rafCallsAfterMount = raf.mock.calls.length;

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    captured.cb?.(1000);
    captured.cb?.(1016);

    expect(raf.mock.calls.length).toBeGreaterThan(rafCallsAfterMount); // kept rescheduling
    expect(calls.length).toBe(callsAfterMount); // no new draw calls while hidden

    delete document.documentElement.dataset.theme;
  });
});

// ─── PulseEcgCanvas — empty states (D-08) ───────────────────────────────────

describe("PulseEcgCanvas — empty states (D-08)", () => {
  beforeEach(() => {
    const { ctx } = makeRecordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as RenderingContext);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("(g) unavailable renders data-ecg-state and the shared 'no signal yet' copy", () => {
    const { container } = render(<PulseEcgCanvas blips={[]} feedState="unavailable" />);
    expect(container.querySelector('[data-ecg-state="unavailable"]')).toBeTruthy();
    expect(screen.getByText("no signal yet")).toBeInTheDocument();
  });

  it("(g control) idle renders data-ecg-state but NOT the copy — a quiet system is nominal", () => {
    const { container } = render(<PulseEcgCanvas blips={[]} feedState="idle" />);
    expect(container.querySelector('[data-ecg-state="idle"]')).toBeTruthy();
    expect(screen.queryByText("no signal yet")).not.toBeInTheDocument();
  });
});

// ─── PulseEcgCanvas — sentinel (D-06/T-125-06-02) ───────────────────────────

describe("PulseEcgCanvas — palette sentinel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("(h) logs a console.error naming a palette token that fails to parse, instead of silently painting the previous colour", () => {
    stubMatchMedia(false);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { ctx } = makeRecordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as RenderingContext);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (prop: string) => (prop === "--astridr" ? "" : "oklch(0.7 0.15 200)"),
    } as unknown as CSSStyleDeclaration);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<PulseEcgCanvas blips={[]} feedState="idle" />);

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("astridr"));
  });
});
