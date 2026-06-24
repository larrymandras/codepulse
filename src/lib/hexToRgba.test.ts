import { describe, it, expect } from "vitest";
import { hexToRgba } from "./hexToRgba";

describe("hexToRgba", () => {
  it("converts a 6-digit hex to rgba", () => {
    expect(hexToRgba("#10b981", 0.18)).toBe("rgba(16, 185, 129, 0.18)");
  });

  it("converts another 6-digit hex to rgba", () => {
    expect(hexToRgba("#5eead4", 0.55)).toBe("rgba(94, 234, 212, 0.55)");
  });

  it("trims leading whitespace from getComputedStyle output", () => {
    expect(hexToRgba(" #06b6d4", 0.18)).toBe("rgba(6, 182, 212, 0.18)");
  });

  it("handles 3-digit shorthand hex (#fff)", () => {
    expect(hexToRgba("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("handles 3-digit shorthand hex (#abc)", () => {
    // #abc expands to #aabbcc → r=170, g=187, b=204
    expect(hexToRgba("#abc", 0.5)).toBe("rgba(170, 187, 204, 0.5)");
  });

  it("returns trimmed input unchanged for oklch values (defensive pass-through)", () => {
    expect(hexToRgba("oklch(0.65 0.15 142)", 0.18)).toBe(
      "oklch(0.65 0.15 142)"
    );
  });

  it("returns trimmed input unchanged for non-hex input", () => {
    expect(hexToRgba("not-a-color", 0.5)).toBe("not-a-color");
  });

  it("handles uppercase hex", () => {
    expect(hexToRgba("#10B981", 1)).toBe("rgba(16, 185, 129, 1)");
  });
});
