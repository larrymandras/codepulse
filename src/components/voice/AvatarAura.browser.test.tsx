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
import { describe, it, expect } from "vitest";
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
});
