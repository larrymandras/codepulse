import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./prefersReducedMotion";

describe("prefersReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    // Restore matchMedia after every case so a stub cannot leak into another
    // suite (this repo has a documented history of shared-fixture leakage).
    if (originalMatchMedia === undefined) {
      // @ts-expect-error — deliberately removing to restore the jsdom-default
      // "undefined" shape some cases below simulate.
      delete window.matchMedia;
    } else {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("returns false when window.matchMedia is undefined — the jsdom case (load-bearing: this is what keeps `animate-pulse` present in every existing test that asserts it)", () => {
    // @ts-expect-error — simulating the real jsdom shape, where matchMedia is
    // not implemented at all.
    delete window.matchMedia;

    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns false when the reduced-motion query does not match", () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true only when the reduced-motion query reports matches: true — the control proving the predicate is not simply hardwired to false", () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    expect(prefersReducedMotion()).toBe(true);
  });

  it("never throws when matchMedia is undefined (optional-call safety)", () => {
    // @ts-expect-error — same undefined-matchMedia simulation as above.
    delete window.matchMedia;

    expect(() => prefersReducedMotion()).not.toThrow();
  });

  it("returns false when window itself is undefined (SSR-safety, matching the ReadinessPill precedent) without throwing", () => {
    // `typeof x` on an identifier bound to the value `undefined` evaluates to
    // "undefined" exactly as it would for a genuinely absent global, so
    // stubbing the global to `undefined` exercises the real
    // `typeof window !== "undefined"` guard rather than merely asserting it
    // exists by inspection.
    vi.stubGlobal("window", undefined);

    expect(() => prefersReducedMotion()).not.toThrow();
    expect(prefersReducedMotion()).toBe(false);

    vi.unstubAllGlobals();
  });
});
