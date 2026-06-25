import { describe, it, expect } from "vitest";
import { normalizeMelFrame } from "./melNormalize";

describe("normalizeMelFrame", () => {
  it("maps 0 to 2 (0/10 + 2)", () => {
    expect(normalizeMelFrame([0])).toEqual([2]);
  });

  it("maps [10, -10] to [3, 1]", () => {
    expect(normalizeMelFrame([10, -10])).toEqual([3, 1]);
  });

  it("handles Float32Array input and preserves length", () => {
    const input = new Float32Array([0, 10, -10, 5]);
    const result = normalizeMelFrame(input);
    expect(result).toHaveLength(4);
    expect(result[0]).toBeCloseTo(2.0);
    expect(result[1]).toBeCloseTo(3.0);
    expect(result[2]).toBeCloseTo(1.0);
    expect(result[3]).toBeCloseTo(2.5);
  });

  it("returns an empty array for empty input (no throw)", () => {
    expect(normalizeMelFrame([])).toEqual([]);
    expect(normalizeMelFrame(new Float32Array(0))).toEqual([]);
  });
});
