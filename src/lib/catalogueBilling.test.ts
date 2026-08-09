/**
 * catalogueBilling.test.ts — Task 1 (Phase 109 Plan 07). Behavioral coverage of D-13's vendor
 * translation, per this file's own module docstring: `mapCatalogueVendorToBilling` never calls
 * `getBillingType()` to detect the unclassified case, and Unclassified is reachable ONLY on
 * genuinely empty/missing vendor data.
 */

import { describe, it, expect } from "vitest";
import { mapCatalogueVendorToBilling } from "./catalogueBilling";

describe("mapCatalogueVendorToBilling", () => {
  it('maps "anthropic" to the anthropic_direct registry entry — group "api", costTier not "unknown"', () => {
    const result = mapCatalogueVendorToBilling("anthropic");
    expect(result.group).toBe("api");
    expect(result.billing).toBe("api");
    expect(result.costTier).not.toBe("unknown");
    expect(result.group).not.toBe("unclassified");
  });

  it("maps every other non-empty vendor to the OpenRouter catch-all — group api, costTier normal", () => {
    for (const vendor of ["google", "x-ai", "meta-llama", "deepseek", "mistralai", "qwen"]) {
      const result = mapCatalogueVendorToBilling(vendor);
      expect(result).toEqual({ group: "api", billing: "api", costTier: "normal" });
    }
  });

  it('returns "unclassified"/"unknown" for an empty vendor, paired with a control that a real vendor is NOT unclassified', () => {
    const empty = mapCatalogueVendorToBilling("");
    expect(empty.group).toBe("unclassified");
    expect(empty.costTier).toBe("unknown");

    // Control: an implementation that always returns "unclassified" (an always-unclassified stub)
    // must fail this pairing — "google" is a real, mapped vendor.
    const control = mapCatalogueVendorToBilling("google");
    expect(control.group).toBe("api");
    expect(control.costTier).toBe("normal");
  });

  it('returns "unclassified"/"unknown" for an undefined vendor, never "api"/"normal"', () => {
    const result = mapCatalogueVendorToBilling(undefined);
    expect(result.group).toBe("unclassified");
    expect(result.billing).toBe("api"); // irrelevant for an unclassified entry, but must never be "sub" by accident
    expect(result.costTier).toBe("unknown");
  });

  it("never returns unclassified for a genuinely reported vendor — anthropic is the case a literal registry lookup would get wrong", () => {
    // A literal `vendor in PROVIDER_BILLING` lookup would classify "anthropic" as unclassified,
    // since "anthropic" is not itself a PROVIDER_BILLING key (the key is "anthropic_direct").
    // This is the exact defect D-13 exists to prevent.
    const result = mapCatalogueVendorToBilling("anthropic");
    expect(result.group).not.toBe("unclassified");
  });

  it("resolves a vendor slug that happens to collide with a PROVIDER_BILLING key (e.g. \"ollama\") through the same OpenRouter catch-all rule, not by accident", () => {
    // "ollama" is itself a PROVIDER_BILLING key mapped to "subscription" — but the vendor axis and
    // the billing-channel axis are unrelated, so this must NOT resolve to group "subscription".
    // Documented and asserted per Task 1's requirement that this behavior be decided, not emergent.
    const result = mapCatalogueVendorToBilling("ollama");
    expect(result).toEqual({ group: "api", billing: "api", costTier: "normal" });
  });
});
