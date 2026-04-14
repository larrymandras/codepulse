import { describe, test, expect } from "vitest";
import { computeZScore, classifySeverity } from "./anomalyDetection";

describe("anomalyDetection", () => {
  // computeZScore tests
  describe("computeZScore", () => {
    test("returns 0 when stdDev is 0 (all same values)", () => {
      expect(computeZScore(10, [5, 5, 5, 5, 5])).toBe(0);
    });

    test("returns 0 when stdDev is 0 (value equals constant history)", () => {
      expect(computeZScore(15, [10, 10, 10, 10, 10])).toBe(0);
    });

    test("returns 0 when historicalValues is empty", () => {
      expect(computeZScore(42, [])).toBe(0);
    });

    test("returns correct z-score in warning range (~2.12sigma)", () => {
      const result = computeZScore(13, [8, 10, 12, 9, 11]);
      expect(result).toBeGreaterThan(2.0);
      expect(result).toBeLessThan(3.0);
    });

    test("returns correct z-score in critical range (~4.24sigma)", () => {
      const result = computeZScore(16, [8, 10, 12, 9, 11]);
      expect(result).toBeGreaterThan(3.0);
    });

    test("returns 0 when 12 equals mean with zero deviation", () => {
      expect(computeZScore(12, [10, 10, 10, 10, 10, 10, 10])).toBe(0);
    });
  });

  // classifySeverity tests
  describe("classifySeverity", () => {
    test("returns null when absZScore is below 2sigma threshold", () => {
      expect(classifySeverity(1.5)).toBeNull();
    });

    test("returns 'warning' when absZScore is in 2-3sigma range", () => {
      expect(classifySeverity(2.5)).toBe("warning");
    });

    test("returns 'critical' when absZScore is at or above 3sigma", () => {
      expect(classifySeverity(3.5)).toBe("critical");
    });

    test("returns 'warning' at exactly 2sigma boundary", () => {
      expect(classifySeverity(2.0)).toBe("warning");
    });

    test("returns 'critical' at exactly 3sigma boundary", () => {
      expect(classifySeverity(3.0)).toBe("critical");
    });
  });

  // Mutation-level tests deferred — requires Convex test harness
  test.todo("evaluateInternal creates alert for critical anomaly via api.alerts.create");
  test.todo("evaluateInternal creates anomalyEvents row with correct fields");
});
