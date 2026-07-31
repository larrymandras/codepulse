import { describe, test, expect } from "vitest";
import { classifyCapStatus } from "./SDKSpendCapGauge";

describe("SDKSpendCapGauge", () => {
  describe("classifyCapStatus", () => {
    test("returns 'ok' when spend is well under threshold", () => {
      expect(classifyCapStatus(2.00, 5.00, 0.8)).toBe("ok");
    });

    test("returns 'ok' at exactly 79% of cap", () => {
      expect(classifyCapStatus(3.95, 5.00, 0.8)).toBe("ok");
    });

    test("returns 'warning' at exactly 80% ($4 of $5) per D-04", () => {
      expect(classifyCapStatus(4.00, 5.00, 0.8)).toBe("warning");
    });

    test("returns 'warning' between 80% and 100%", () => {
      expect(classifyCapStatus(4.50, 5.00, 0.8)).toBe("warning");
    });

    test("returns 'exceeded' at exactly the cap", () => {
      expect(classifyCapStatus(5.00, 5.00, 0.8)).toBe("exceeded");
    });

    test("returns 'exceeded' over the cap", () => {
      expect(classifyCapStatus(6.50, 5.00, 0.8)).toBe("exceeded");
    });

    test("returns 'ok' when spend is 0", () => {
      expect(classifyCapStatus(0, 5.00, 0.8)).toBe("ok");
    });
  });
});
