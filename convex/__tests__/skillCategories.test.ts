import { describe, it, expect } from "vitest";
import {
  DEFAULT_ICONS,
  DEFAULT_COLORS,
  extractPrefix,
  generateDisplayName,
  computeFamilyPrefixes,
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

describe("computeFamilyPrefixes", () => {
  it("flags a prefix shared by >=3 distinct skills as a family", () => {
    const families = computeFamilyPrefixes([
      "gsd-plan-phase",
      "gsd-new-project",
      "gsd-execute-phase",
      "deep-research",
    ]);
    expect(families.has("gsd")).toBe(true);
    expect(families.has("deep")).toBe(false);
  });

  it("does not treat a coincidental 2-word overlap as a family", () => {
    const families = computeFamilyPrefixes([
      "agent-browser",
      "agent-development",
    ]);
    expect(families.has("agent")).toBe(false);
  });

  it("dedupes cc_ bridge twins so a standalone skill is not a family", () => {
    // native + bridge twin of the SAME skill must count once
    const families = computeFamilyPrefixes([
      "deep-research",
      "cc_deep-research",
    ]);
    expect(families.has("deep")).toBe(false);
  });

  it("ignores uncategorized names", () => {
    const families = computeFamilyPrefixes(["123-x", "456-y"]);
    expect(families.has("uncategorized")).toBe(false);
    expect(families.size).toBe(0);
  });
});

describe("generateDisplayName", () => {
  it("strips the prefix for a real family", () => {
    expect(generateDisplayName("gsd-plan-phase", "gsd", true)).toBe("Plan Phase");
  });

  it("handles single segment after a family prefix", () => {
    expect(generateDisplayName("legal-nda", "legal", true)).toBe("Nda");
  });

  it("keeps the full name for a standalone (non-family) skill", () => {
    expect(generateDisplayName("agent-browser", "agent", false)).toBe(
      "Agent Browser"
    );
    expect(generateDisplayName("deploy-to-vercel", "deploy", false)).toBe(
      "Deploy To Vercel"
    );
  });

  it("strips the plugin namespace for colon skills (regardless of isFamily)", () => {
    expect(generateDisplayName("vercel:deploy", "vercel", false)).toBe("Deploy");
    expect(
      generateDisplayName("superpowers:brainstorming", "superpowers", false)
    ).toBe("Brainstorming");
  });

  it("strips only the first colon segment for hyphenated plugin names", () => {
    expect(
      generateDisplayName("code-review:code-review", "code", false)
    ).toBe("Code Review");
    expect(
      generateDisplayName("feature-dev:code-reviewer", "feature", false)
    ).toBe("Code Reviewer");
  });

  it("titlecases the full name for uncategorized skills", () => {
    expect(generateDisplayName("init", "uncategorized")).toBe("Init");
  });

  it("strips cc_ namespace before generating display name", () => {
    expect(generateDisplayName("cc_gsd-plan-phase", "gsd", true)).toBe(
      "Plan Phase"
    );
  });

  it("keeps cc_ standalone names full", () => {
    expect(generateDisplayName("cc_agent-browser", "agent", false)).toBe(
      "Agent Browser"
    );
  });

  it("handles multi-word segments in a family", () => {
    expect(generateDisplayName("gsd-code-review-fix", "gsd", true)).toBe(
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
