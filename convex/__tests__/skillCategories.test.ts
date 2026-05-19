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

  it("strips cc_ namespace and extracts real prefix", () => {
    expect(extractPrefix("cc_article-writer")).toBe("article");
  });

  it("strips cc_ and extracts prefix from gsd skill", () => {
    expect(extractPrefix("cc_gsd-plan-phase")).toBe("gsd");
  });

  it("handles alphanumeric prefixes like d3js", () => {
    expect(extractPrefix("cc_d3js-visualization")).toBe("d3js");
  });

  it("extracts prefix from names without separators", () => {
    expect(extractPrefix("init")).toBe("init");
  });

  it('returns "uncategorized" for empty string', () => {
    expect(extractPrefix("")).toBe("uncategorized");
  });

  it('returns "uncategorized" for non-alpha start', () => {
    expect(extractPrefix("123-test")).toBe("uncategorized");
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

  it("strips cc_ namespace before generating display name", () => {
    expect(generateDisplayName("cc_article-writer", "article")).toBe("Writer");
  });

  it("strips cc_ and prefix for gsd skills", () => {
    expect(generateDisplayName("cc_gsd-plan-phase", "gsd")).toBe("Plan Phase");
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
