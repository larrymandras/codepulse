/**
 * brainsApi.test.ts — Phase 109 Plan 03 (D-01 seam retirement).
 *
 * `resolveModelDisplayName`/`buildModelNameMap`/`CatalogueEntry` behavior is already fully covered
 * by `src/lib/brainsDisplayNames.test.ts` (the pure-function fixtures pre-date this plan and were
 * left untouched). This file's job is narrower and D-01-specific: prove the seam's deleted symbols
 * are genuinely gone from the module's exports, not merely renamed or re-exported under cover, and
 * that the survivors are still exactly what the header badge/Chat pill/Settings rows import.
 */

import { describe, it, expect } from "vitest";
import * as brainsApi from "./brainsApi";

describe("brainsApi module shape — D-01 seam retirement", () => {
  it("exports only the display-name survivors, nothing from the deleted stub/live/validator seam", () => {
    const exported = Object.keys(brainsApi).sort();
    expect(exported).toEqual(["buildModelNameMap", "resolveModelDisplayName"].sort());
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
