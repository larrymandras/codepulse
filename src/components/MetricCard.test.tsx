import { describe, it, expect } from "vitest";
import { thresholdTone } from "./MetricCard";

describe("thresholdTone", () => {
  describe("lower-is-better (default direction)", () => {
    const config = { ok: 10, warn: 20 };

    it("returns 'good' when value <= ok", () => {
      expect(thresholdTone(5, config)).toBe("good");
      expect(thresholdTone(10, config)).toBe("good");
    });

    it("returns 'warn' when value > ok and <= warn", () => {
      expect(thresholdTone(15, config)).toBe("warn");
      expect(thresholdTone(20, config)).toBe("warn");
    });

    it("returns 'danger' when value > warn", () => {
      expect(thresholdTone(25, config)).toBe("danger");
      expect(thresholdTone(100, config)).toBe("danger");
    });
  });

  describe("higher-is-better (invertDirection)", () => {
    const config = { ok: 70, warn: 40, invertDirection: true as const };

    it("returns 'good' when value >= ok", () => {
      expect(thresholdTone(80, config)).toBe("good");
      expect(thresholdTone(70, config)).toBe("good");
    });

    it("returns 'warn' when value >= warn and < ok", () => {
      expect(thresholdTone(50, config)).toBe("warn");
      expect(thresholdTone(40, config)).toBe("warn");
    });

    it("returns 'danger' when value < warn", () => {
      expect(thresholdTone(30, config)).toBe("danger");
      expect(thresholdTone(0, config)).toBe("danger");
    });
  });

  it("returns 'good' at exact boundary (lower-is-better)", () => {
    expect(thresholdTone(10, { ok: 10, warn: 20 })).toBe("good");
  });

  it("returns 'good' at exact boundary (higher-is-better)", () => {
    expect(thresholdTone(70, { ok: 70, warn: 40, invertDirection: true })).toBe("good");
  });
});
