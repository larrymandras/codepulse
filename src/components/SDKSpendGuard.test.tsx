import { describe, it, expect } from "vitest";
import { classifyCapStatus, DAILY_CAP, ALERT_THRESHOLD, projectDayEndSpend } from "./SDKSpendGuard";

describe("SDKSpendGuard", () => {
  describe("classifyCapStatus (regression)", () => {
    it("returns 'ok' when spend is well under threshold", () => {
      expect(classifyCapStatus(2.00, 5.00, 0.8)).toBe("ok");
    });
    it("returns 'warning' at exactly 80% ($4 of $5)", () => {
      expect(classifyCapStatus(4.00, 5.00, 0.8)).toBe("warning");
    });
    it("returns 'exceeded' at exactly the cap", () => {
      expect(classifyCapStatus(5.00, 5.00, 0.8)).toBe("exceeded");
    });
    it("uses exported constants", () => {
      expect(DAILY_CAP).toBe(5.00);
      expect(ALERT_THRESHOLD).toBe(0.8);
    });
  });

  describe("projectDayEndSpend", () => {
    it("returns projected total based on elapsed hours and current spend", () => {
      const result = projectDayEndSpend(2.50, 12);
      expect(result.projectedTotal).toBe(5.00);
      expect(result.willExceedCap).toBe(false);
    });
    it("returns 0 when elapsedHours is 0", () => {
      const result = projectDayEndSpend(2.50, 0);
      expect(result.projectedTotal).toBe(0);
      expect(result.willExceedCap).toBe(false);
      expect(result.projectedHitTime).toBeNull();
    });
    it("flags willExceedCap when projected > DAILY_CAP", () => {
      const result = projectDayEndSpend(3.00, 8);
      expect(result.projectedTotal).toBe(9.00);
      expect(result.willExceedCap).toBe(true);
      expect(result.projectedHitTime).not.toBeNull();
    });
  });
});
