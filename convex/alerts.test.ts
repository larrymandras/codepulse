import { describe, it, expect } from "vitest";

// Test the pure evaluation logic extracted from evaluateCondition
// Since evaluateCondition is internal to alerts.ts and requires ctx (database access),
// test the metric comparison logic in isolation

describe("alerts - sdk_spend_usd_today evaluation", () => {
  describe("threshold comparison logic", () => {
    const DAILY_CAP = 5.00;
    const ALERT_THRESHOLD = 0.8;
    const threshold = DAILY_CAP * ALERT_THRESHOLD; // 4.00

    it("fires when API spend equals threshold ($4.00)", () => {
      const value = 4.00;
      expect(value >= threshold).toBe(true);
    });

    it("fires when API spend exceeds threshold", () => {
      const value = 4.50;
      expect(value >= threshold).toBe(true);
    });

    it("does not fire when API spend is below threshold", () => {
      const value = 3.99;
      expect(value >= threshold).toBe(false);
    });

    it("does not fire when no spend (zero)", () => {
      const value = 0;
      expect(value >= threshold).toBe(false);
    });
  });

  describe("billingType filtering", () => {
    it("includes api billingType rows", () => {
      const rows = [
        { value: 2.50, dimensions: { billingType: "api" } },
        { value: 1.50, dimensions: { billingType: "subscription" } },
        { value: 1.00, dimensions: { billingType: "api" } },
      ];
      const apiTotal = rows
        .filter(r => (r.dimensions as any)?.billingType === "api")
        .reduce((sum, r) => sum + r.value, 0);
      expect(apiTotal).toBe(3.50);
    });

    it("excludes subscription billingType rows", () => {
      const rows = [
        { value: 5.00, dimensions: { billingType: "subscription" } },
      ];
      const apiTotal = rows
        .filter(r => (r.dimensions as any)?.billingType === "api")
        .reduce((sum, r) => sum + r.value, 0);
      expect(apiTotal).toBe(0);
    });
  });
});
