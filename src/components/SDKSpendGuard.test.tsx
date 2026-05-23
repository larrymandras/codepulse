import { describe, it, expect } from "vitest";
import { classifyCapStatus, DAILY_CAP, ALERT_THRESHOLD } from "./SDKSpendGuard";

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
    it.todo("returns projected total based on elapsed hours and current spend");
    it.todo("returns 0 when elapsedHours is 0");
    it.todo("flags willExceedCap when projected > DAILY_CAP");
  });
});
