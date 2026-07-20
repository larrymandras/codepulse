import { describe, it, expect } from "vitest";
import { packCircles, type Packable } from "./circlePack";

function circles(radii: number[]): Packable[] {
  return radii.map((r) => ({ r }));
}

function anyOverlap(items: Packable[], gap = 2): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      const dx = (a.x ?? 0) - (b.x ?? 0);
      const dy = (a.y ?? 0) - (b.y ?? 0);
      const dist = Math.hypot(dx, dy);
      // allow a tiny epsilon under the gap for float error
      if (dist < a.r + b.r + gap - 1e-6) return true;
    }
  }
  return false;
}

describe("packCircles", () => {
  it("handles empty and single", () => {
    expect(packCircles([])).toBe(0);
    const one = circles([10]);
    const R = packCircles(one);
    expect(one[0]!.x).toBe(0);
    expect(one[0]!.y).toBe(0);
    expect(R).toBeCloseTo(10);
  });

  it("produces NO overlaps for a mix of sizes", () => {
    const items = circles([20, 15, 15, 10, 10, 10, 8, 8, 6, 6, 5, 5, 4, 3]);
    packCircles(items);
    expect(anyOverlap(items)).toBe(false);
  });

  it("produces no overlaps for many equal circles", () => {
    const items = circles(Array.from({ length: 40 }, () => 5));
    packCircles(items);
    expect(anyOverlap(items)).toBe(false);
  });

  it("recenters around the origin (bbox center ~ 0) and returns a positive radius", () => {
    const items = circles([12, 9, 9, 7, 7, 5, 5, 4]);
    const R = packCircles(items);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of items) {
      minX = Math.min(minX, (c.x ?? 0) - c.r);
      maxX = Math.max(maxX, (c.x ?? 0) + c.r);
      minY = Math.min(minY, (c.y ?? 0) - c.r);
      maxY = Math.max(maxY, (c.y ?? 0) + c.r);
    }
    expect(Math.abs((minX + maxX) / 2)).toBeLessThan(1e-6);
    expect(Math.abs((minY + maxY) / 2)).toBeLessThan(1e-6);
    expect(R).toBeGreaterThan(12);
  });

  it("is deterministic", () => {
    const a = circles([10, 8, 8, 6, 6, 4]);
    const b = circles([10, 8, 8, 6, 6, 4]);
    packCircles(a);
    packCircles(b);
    expect(a.map((c) => [c.x, c.y])).toEqual(b.map((c) => [c.x, c.y]));
  });
});
