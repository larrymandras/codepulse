/**
 * AvatarAura.browser.test.tsx — Phase 192 Plan 02 (LIP-01 regression guard)
 *
 * THE CADENCE GUARD. Runs in real headless Chromium via the `browser` project
 * in vitest.config.ts, against the real requestAnimationFrame.
 *
 * Why this file exists: AvatarAura.test.tsx runs in jsdom and hand-drives the
 * rAF callback, so it asserts only that an ellipse IS drawn — it passes
 * identically at 1 draw or 200, and it ratified LIP-01 (mouth opens once, then
 * freezes for the rest of the reply) for two weeks. A cadence defect is only
 * visible where the browser owns the frame clock, which is here.
 *
 * Three rules this file must keep, or it becomes the thing it replaced:
 *   1. NEVER stub requestAnimationFrame. Letting the real browser drive the
 *      loop is the entire point.
 *   2. A missing window.__avatarAuraDebug is a HARD FAILURE, never a skip
 *      (D-12a). No optional chaining, no early return, and no conditional
 *      test-skipping helper of any kind. (Their names are deliberately not
 *      written out here: 192-02's acceptance grep counts skip constructs in
 *      this file and cannot tell a warning against one from a use of one.)
 *   3. Assert DELTAS against a FLOOR, never absolute totals and never the
 *      measured ideal. The counters accumulate for the page lifetime, so a
 *      sibling test's mounts would inflate an absolute total; and a tight
 *      band around the healthy value would make this spec flaky under CI load
 *      rather than sensitive to the defect.
 *
 * Expected console noise: "ResizeObserver loop completed with undelivered
 * notifications", ~3x per run. It is the browser reacting to a real reflow
 * that jsdom never produces, it is non-fatal, and it must NOT be silenced —
 * broad error suppression here would also hide a genuine render() throw, which
 * is the one failure mode the D-04 instrumentation exists to catch.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AvatarAura } from "./AvatarAura";

type AuraCounters = NonNullable<Window["__avatarAuraDebug"]>;

/**
 * Reads the 192-01 counter surface, or throws.
 *
 * D-12(a): an absent surface means the instrumentation was reverted (which has
 * already happened twice to this defect) or the component never mounted. Both
 * are exactly the states this guard exists to catch, so neither may degrade
 * into a skip or a silent pass. Read directly off `window` — the test body
 * already executes inside the page, and Vitest's exported `page` is a locator
 * API with no evaluate method.
 */
function readCounters(): AuraCounters {
  const counters = window.__avatarAuraDebug;
  if (!counters) {
    throw new Error(
      "window.__avatarAuraDebug is undefined — the AvatarAura draw-loop " +
        "instrumentation (Phase 192-01) is missing or was reverted. This is a " +
        "hard failure by design (D-12a): without the counter surface this " +
        "spec cannot see cadence at all, and a skip here would restore the " +
        "vacuous pass that let LIP-01 ship.",
    );
  }
  return counters;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Time-varying fake analyser for the 193-01 D-18.1 modulation guard. Local to
 * this file (the jsdom sibling's makeFakeAnalyser is a static loud/silent
 * toggle, not varying — and its makeCtx() full-getContext replacement in the
 * same file is forbidden here).
 *
 * Implements only what analyserLevel() reads (getByteTimeDomainData), plus
 * fftSize/frequencyBinCount for the AnalyserNode cast. Every sample in the
 * buffer is filled with the SAME byte value each call, so analyserLevel()'s
 * RMS reduces to exactly |v| with no cross-sample noise to confound the
 * assertion.
 *
 * Range is [0.05, 0.40] for v (=~lvl): comfortably above the render loop's
 * `lvl > 0.01` gate (0.05 is 5x the gate, well clear of the ~0.008 byte-
 * quantization step), while still crossing the `Math.min(1, lvl * 5)`
 * saturation point at lvl=0.2 — so `level` genuinely swings across the window
 * rather than pinning at the 1.0 ceiling throughout. Period ~377ms
 * (`now / 60` inside a sine), giving ~4 full cycles inside the 1500ms window
 * below.
 */
function makeVaryingAnalyser(): AnalyserNode {
  return {
    fftSize: 256,
    frequencyBinCount: 128,
    getByteTimeDomainData: (buf: Uint8Array) => {
      const now = performance.now();
      const v = 0.225 + 0.175 * Math.sin(now / 60);
      const byte = Math.max(0, Math.min(255, Math.round(v * 128 + 128)));
      for (let i = 0; i < buf.length; i++) {
        buf[i] = byte;
      }
    },
  } as unknown as AnalyserNode;
}

describe("AvatarAura — real-browser draw cadence (LIP-01 guard)", () => {
  it(
    "keeps calling render() while idle — the loop runs in every state",
    async () => {
      const { unmount } = render(<AvatarAura state="idle" ttsAnalyser={null} />);

      const before = readCounters();

      // Reduced motion draws exactly one static frame and never creates a
      // loop, so zero draws would be CORRECT there. Assert we are not in that
      // state before asserting anything about cadence, or a legitimate
      // zero-draw environment reads as the defect.
      expect(before.reducedMotion).toBe(false);

      const renderBefore = before.renderCount;
      const rafBefore = before.rafCount;

      await wait(5000);

      const after = readCounters();
      const renderDelta = after.renderCount - renderBefore;
      const rafDelta = after.rafCount - rafBefore;

      // Floor, not the ideal. Measured healthy in this exact setup: ~113
      // render() calls per 5000ms (the 30fps throttle gate, sampled off a
      // ~60Hz rAF, lands near ~22.6/sec once frame jitter is accounted for).
      // The historical defect signature is 1-2 draws for the whole window.
      // 60 sits ~47% below the measurement and 30x above the defect, so it
      // survives a loaded CI runner without going blind to a stall.
      expect(renderDelta).toBeGreaterThanOrEqual(60);

      // rAF must outpace render(): the throttle gate skips ticks, it does not
      // stop them. A renderDelta that passes while rAF is flat would mean the
      // counters are lying, not that the loop is healthy.
      expect(rafDelta).toBeGreaterThanOrEqual(renderDelta);

      unmount();
    },
    7000,
  );

  it("keeps redrawing the mouth for the whole time she is speaking", async () => {
    // ttsAnalyser={null} exercises the synthetic breathing fallback, so this
    // needs no TTS, no audio graph, no backend and no Convex. The jsdom spec
    // already covers the same null-analyser path for branch logic; what it
    // cannot see is whether the draw REPEATS.
    const { unmount } = render(
      <AvatarAura state="speaking" ttsAnalyser={null} />,
    );

    const before = readCounters();
    expect(before.reducedMotion).toBe(false);
    const mouthBefore = before.mouthDrawCount;

    await wait(1000);

    const mouthDelta = readCounters().mouthDrawCount - mouthBefore;

    // ~22 expected at the measured ~22.6 draws/sec; floor at 10 keeps the same
    // ~55% margin as the idle spec. The floor is deliberately far above 1:
    // "the mouth drew once and then froze" IS the reported symptom, and a
    // presence-only assertion (ellipse was called) passes on it — which is
    // precisely how the jsdom spec ratified this defect.
    expect(mouthDelta).toBeGreaterThanOrEqual(10);

    unmount();
  });

  // D-18.1: 192's cadence guards above prove the loop draws repeatedly, but
  // both drive the synthetic-breathing fallback (ttsAnalyser=null), which
  // also varies — they cannot distinguish a healthy amplitude signal from
  // AvatarAura's TIER-1 defect (frozen `level`, draw count still healthy).
  // This spec feeds a real varying analyser and asserts the DRAWN GEOMETRY
  // itself changes, which is what LIP-01's actual symptom is measured on.
  //
  // Named to not contain "keeps": the two specs above are filtered with
  // `-t "keeps"` in the gating verify command specifically so a deliberate,
  // recorded RED here cannot hard-fail that command's exit code.
  it("the drawn mouth rx/ry track a varying analyser reading, not a frozen one (D-18.1)", async () => {
    const ellipseSpy = vi.spyOn(CanvasRenderingContext2D.prototype, "ellipse");
    try {
      const { unmount } = render(
        <AvatarAura state="speaking" ttsAnalyser={makeVaryingAnalyser()} />,
      );

      await wait(1500);

      unmount();

      // AvatarAura.tsx:470 (`ctx.ellipse(mouthCx, mouthCy, mouthRx, mouthRy,
      // 0, 0, Math.PI * 2)`) is the ONLY `.ellipse(` call site in this
      // component (confirmed by grep) — filter on its fixed
      // (rotation=0, startAngle=0, endAngle=2*PI) argument shape anyway, so a
      // future sibling ellipse() draw call cannot silently get folded into
      // this assertion.
      const mouthCalls = ellipseSpy.mock.calls.filter(
        (args) =>
          args.length === 7 &&
          args[4] === 0 &&
          args[5] === 0 &&
          Math.abs((args[6] as number) - Math.PI * 2) < 1e-9,
      );

      // Floor before range: an empty array's Math.min/Math.max are
      // Infinity/-Infinity, which would otherwise satisfy a naive inequality
      // vacuously.
      expect(mouthCalls.length).toBeGreaterThanOrEqual(10);

      const rxs = mouthCalls.map((args) => args[2] as number);
      const rys = mouthCalls.map((args) => args[3] as number);
      const rxMin = Math.min(...rxs);
      const rxMax = Math.max(...rxs);
      const ryMin = Math.min(...rys);
      const ryMax = Math.max(...rys);

      // RELATIVE margin, not absolute pixels: mouthRx/mouthRy =
      // base * RATIO * (1 + level * GAIN), so (max-min)/min cancels `base`
      // entirely — the assertion stays meaningful regardless of the real
      // container/canvas size this browser-mode harness produces (unknown at
      // authoring time), tracking only whether `level` itself is varying.
      expect((rxMax - rxMin) / rxMin).toBeGreaterThan(0.05);
      expect((ryMax - ryMin) / ryMin).toBeGreaterThan(0.05);

      // ── The two assertions above are NECESSARY BUT NOT SUFFICIENT, and were
      // vacuous on their own until 2026-08-21. Their original comment claimed
      // the relative margin "cancels `base` entirely" — it does not. It cancels
      // base only if base is CONSTANT, and in this browser-mode harness the
      // container resizes mid-run, so both spreads are satisfied by base drift
      // with `level` hard-frozen. Measured, with `const level = smoothed`
      // mutated to `const level = 0.5`:
      //
      //   frozen : rxSpread 1.4069767441860466, rySpread 1.4069767441860468,
      //            3 distinct radii across 35 draws  -> STILL PASSED
      //   healthy: rxSpread 2.0240, rySpread 2.3680,
      //            36 distinct radii across 36 draws
      //
      // Two signals separate those columns, and both are asserted below.
      //
      // (1) ry/rx is base-free FOR REAL. Since
      //         rx = base * 0.16 * (1 + level * 0.6)
      //         ry = base * 0.08 * (1 + level * 1.1)
      //     the ratio is 0.5 * (1 + level*1.1) / (1 + level*0.6) — `base`
      //     divides out algebraically, and the ratio is monotonic in `level`.
      //     A resize therefore cannot move it; only `level` can. With level
      //     frozen this spread is exactly 0.
      const ratios = mouthCalls.map(
        (args) => (args[3] as number) / (args[2] as number),
      );
      const ratioMin = Math.min(...ratios);
      const ratioMax = Math.max(...ratios);
      expect((ratioMax - ratioMin) / ratioMin).toBeGreaterThan(0.02);

      // (2) A frozen `level` collapses the radii onto the handful of discrete
      //     sizes the container passed through (3 of 35 when measured); a live
      //     one produces a fresh value essentially every draw (36 of 36).
      //     Half the draws is far above the frozen case and far below healthy.
      expect(new Set(rys).size).toBeGreaterThan(mouthCalls.length / 2);
    } finally {
      ellipseSpy.mockRestore();
    }
  });
});
