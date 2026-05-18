import { describe, it, expect } from "vitest";
import { groupByCategory, titleCase, stripPrefix } from "../skillCategories";

describe("titleCase", () => {
  it("capitalizes first letter", () => {
    expect(titleCase("legal")).toBe("Legal");
  });

  it("handles single character", () => {
    expect(titleCase("a")).toBe("A");
  });

  it("handles empty string", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("stripPrefix", () => {
  it("removes category prefix from skill name", () => {
    expect(stripPrefix("legal-nda", "legal")).toBe("Nda");
  });

  it("handles multi-word suffix", () => {
    expect(stripPrefix("legal-contract-review", "legal")).toBe("Contract Review");
  });

  it("returns full name title-cased when no prefix match", () => {
    expect(stripPrefix("standalone", "standalone")).toBe("Standalone");
  });
});

describe("groupByCategory", () => {
  const skills = [
    { name: "legal-nda", description: "Generate NDAs" },
    { name: "legal-review", description: "Review contracts" },
    { name: "asi-briefing", description: "Daily briefing" },
    { name: "standalone", description: "No prefix" },
  ];

  it("groups by first dash-separated prefix", () => {
    const groups = groupByCategory(skills as any);
    const categoryNames = groups.map((g) => g.category);
    expect(categoryNames).toContain("Legal");
    expect(categoryNames).toContain("Asi");
    expect(categoryNames).toContain("Standalone");
  });

  it("sorts categories alphabetically", () => {
    const groups = groupByCategory(skills as any);
    const names = groups.map((g) => g.category);
    expect(names).toEqual([...names].sort());
  });

  it("places skills in correct groups", () => {
    const groups = groupByCategory(skills as any);
    const legal = groups.find((g) => g.category === "Legal");
    expect(legal?.skills).toHaveLength(2);
    expect(legal?.skills[0].name).toBe("legal-nda");
  });

  it("returns empty array for empty input", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
