import { describe, it, expect } from "vitest";
import { COLOR_HEX, categoryHex } from "./categoryColors";

describe("categoryHex", () => {
  it("returns the hex for a known color name", () => {
    expect(categoryHex("cyan")).toBe("#06b6d4");
    expect(categoryHex("red")).toBe("#ef4444");
  });

  it("falls back to gray for unknown, null, and undefined", () => {
    expect(categoryHex("chartreuse")).toBe(COLOR_HEX.gray);
    expect(categoryHex(null)).toBe(COLOR_HEX.gray);
    expect(categoryHex(undefined)).toBe(COLOR_HEX.gray);
  });
});
