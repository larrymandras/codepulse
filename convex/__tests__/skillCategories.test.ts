import { describe, it, expect } from "vitest";
import {
  DEFAULT_ICONS,
  DEFAULT_COLORS,
  extractPrefix,
  generateDisplayName,
} from "../skillCategories";

describe("extractPrefix", () => {
  it("extracts prefix before first hyphen", () => {
    expect(extractPrefix("gsd-plan-phase")).toBe("gsd");
  });

  it("extracts prefix for single-hyphen names", () => {
    expect(extractPrefix("legal-nda")).toBe("legal");
  });

  it('returns "uncategorized" for names without hyphens', () => {
    expect(extractPrefix("init")).toBe("uncategorized");
  });

  it('returns "uncategorized" for empty string', () => {
    expect(extractPrefix("")).toBe("uncategorized");
  });
});

describe("generateDisplayName", () => {
  it("strips prefix and titlecases segments", () => {
    expect(generateDisplayName("gsd-plan-phase", "gsd")).toBe("Plan Phase");
  });

  it("handles single segment after prefix", () => {
    expect(generateDisplayName("legal-nda", "legal")).toBe("Nda");
  });

  it("titlecases the full name for uncategorized skills", () => {
    expect(generateDisplayName("init", "uncategorized")).toBe("Init");
  });

  it("handles multi-word segments", () => {
    expect(generateDisplayName("gsd-code-review-fix", "gsd")).toBe(
      "Code Review Fix"
    );
  });
});

describe("DEFAULT_ICONS", () => {
  it("has entries for known prefixes", () => {
    expect(DEFAULT_ICONS["gsd"]).toBe("📋");
    expect(DEFAULT_ICONS["legal"]).toBe("⚖️");
    expect(DEFAULT_ICONS["sales"]).toBe("💼");
  });
});

describe("DEFAULT_COLORS", () => {
  it("has entries for known prefixes", () => {
    expect(DEFAULT_COLORS["gsd"]).toBe("indigo");
    expect(DEFAULT_COLORS["legal"]).toBe("red");
    expect(DEFAULT_COLORS["sales"]).toBe("amber");
  });
});
