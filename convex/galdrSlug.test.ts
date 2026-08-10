import { describe, it, expect } from "vitest";
import { slugify, MAX_SLUG_LENGTH } from "./galdrSlug";

const ASCII_KEBAB_PATTERN = /^[a-z0-9-]*$/;

describe("slugify", () => {
  it("lowercases and hyphenates a plain title", () => {
    expect(slugify("Competitor Analysis")).toBe("competitor-analysis");
  });

  it("transliterates eth and strips apostrophes", () => {
    expect(slugify("Ástríðr's Daily Brief")).toBe("astridrs-daily-brief");
  });

  it("collapses runs of separators (double-dash and multiple spaces)", () => {
    expect(slugify("Bifröst  --  Link   Hub")).toBe("bifrost-link-hub");
  });

  it("returns empty string for a title of only punctuation", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("truncates a long title to MAX_SLUG_LENGTH without a trailing hyphen", () => {
    const longTitle = "A very long prompt title that goes on and on and on ".repeat(5);
    const result = slugify(longTitle);
    expect(result.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(result.endsWith("-")).toBe(false);
  });

  it("proves the ASCII guarantee across every fixture, not by spot check", () => {
    const fixtures = [
      slugify("Competitor Analysis"),
      slugify("Ástríðr's Daily Brief"),
      slugify("Bifröst  --  Link   Hub"),
      slugify("!!!"),
      slugify("A very long prompt title that goes on and on and on ".repeat(5)),
      slugify("Þórr & Óðinn: Sæming's Line"),
      slugify(""),
    ];
    for (const fixture of fixtures) {
      expect(fixture).toMatch(ASCII_KEBAB_PATTERN);
      expect(fixture.endsWith("-")).toBe(false);
    }
  });
});
