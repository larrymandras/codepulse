import { describe, it } from "vitest";

describe("alerts - evaluateCondition", () => {
  describe("sdk_spend_usd_today metric (GW-14)", () => {
    it.todo("returns true when API spend exceeds threshold");
    it.todo("returns false when API spend is under threshold");
    it.todo("falls back to hourly aggregates when daily rollup is missing");
    it.todo("filters to billingType=api only (ignores subscription spend)");
  });
});
