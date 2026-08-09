/**
 * brainsApi.test.ts — Phase 109 Plan 03 (D-01 seam retirement), extended by Plan 05 (D-08).
 *
 * `resolveModelDisplayName`/`buildModelNameMap`/`CatalogueEntry` behavior is already fully covered
 * by `src/lib/brainsDisplayNames.test.ts` (the pure-function fixtures pre-date this plan and were
 * left untouched). This file's job is narrower: (a) D-01-specific — prove the seam's deleted
 * symbols are genuinely gone from the module's exports, not merely renamed or re-exported under
 * cover, and that the survivors are still exactly what the header badge/Chat pill/Settings rows
 * import; and (b) D-08-specific — the shared `modelIdsMatch` comparator's own behavior, including
 * the paired-control shape (a case `===` would judge differently, plus a must-stay-unequal
 * negative) every consuming component's own test relies on this module having gotten right.
 */

import { describe, it, expect } from "vitest";
import * as brainsApi from "./brainsApi";

describe("brainsApi module shape — D-01 seam retirement", () => {
  it("exports only the display-name survivors plus D-08's comparator pair, nothing from the deleted stub/live/validator seam", () => {
    const exported = Object.keys(brainsApi).sort();
    expect(exported).toEqual(
      ["buildModelNameMap", "resolveModelDisplayName", "stripVendorPrefix", "modelIdsMatch"].sort()
    );
  });

  it("never exports the deleted stub/live adapter factories, the validator, the flag, or the registrar", () => {
    const mod = brainsApi as Record<string, unknown>;
    expect(mod.createStubBrainsAdapter).toBeUndefined();
    expect(mod.stubBrainsAdapter).toBeUndefined();
    expect(mod.createLiveBrainsAdapter).toBeUndefined();
    expect(mod.brainsApi).toBeUndefined();
    expect(mod.validateGatewayModelSet).toBeUndefined();
    expect(mod.registerBrainsWsSender).toBeUndefined();
    expect(mod.BRAINS_STUB_ACTIVE).toBeUndefined();
  });

  it("keeps resolveModelDisplayName and buildModelNameMap as callable functions", () => {
    expect(typeof brainsApi.resolveModelDisplayName).toBe("function");
    expect(typeof brainsApi.buildModelNameMap).toBe("function");
  });
});

describe("modelIdsMatch — D-08 shared comparator", () => {
  it("treats a vendor-prefixed id and its bare suffix as the same model — the case raw === judged differently", () => {
    expect(brainsApi.modelIdsMatch("anthropic/claude-sonnet-5", "claude-sonnet-5")).toBe(true);
  });

  it("CONTROL: two genuinely different bare models still compare unequal", () => {
    expect(brainsApi.modelIdsMatch("claude-opus-4-8", "claude-sonnet-5")).toBe(false);
  });

  it("matches two identical bare ids", () => {
    expect(brainsApi.modelIdsMatch("claude-sonnet-5", "claude-sonnet-5")).toBe(true);
  });

  it("matches two identical prefixed ids", () => {
    expect(
      brainsApi.modelIdsMatch("anthropic/claude-sonnet-5", "anthropic/claude-sonnet-5")
    ).toBe(true);
  });

  it("matches across two DIFFERENT vendor namespaces sharing a bare suffix — the stated, deliberate consequence of suffix-only identity", () => {
    expect(
      brainsApi.modelIdsMatch("anthropic/claude-sonnet-5", "openai/claude-sonnet-5")
    ).toBe(true);
  });

  it("treats two empty strings as equal, and an empty string as unequal to a non-empty one", () => {
    expect(brainsApi.modelIdsMatch("", "")).toBe(true);
    expect(brainsApi.modelIdsMatch("x", "")).toBe(false);
  });
});

describe("stripVendorPrefix — now exported for D-08 call sites", () => {
  it("strips a leading vendor namespace", () => {
    expect(brainsApi.stripVendorPrefix("anthropic/claude-sonnet-5")).toBe("claude-sonnet-5");
  });

  it("returns an id with no vendor namespace unchanged", () => {
    expect(brainsApi.stripVendorPrefix("claude-sonnet-5")).toBe("claude-sonnet-5");
  });
});
