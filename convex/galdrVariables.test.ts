import { describe, it, expect } from "vitest";
import {
  VARIABLE_PATTERN_SOURCE,
  detectVariables,
  unresolvedVariables,
  substituteVariables,
  isFullyResolved,
} from "./galdrVariables";

describe("detectVariables", () => {
  it("returns [] for a body with no placeholders", () => {
    expect(detectVariables("no variables here")).toEqual([]);
  });

  it("de-dupes a repeated placeholder, keeping first-occurrence order alongside siblings", () => {
    expect(detectVariables("Hi {{ name }}, meet {{name}} and {{other}}")).toEqual([
      "name",
      "other",
    ]);
  });

  it("trims inner whitespace: {{ company }} detects as company", () => {
    expect(detectVariables("{{ company }}")).toEqual(["company"]);
  });

  it("does not detect a single-brace placeholder (control: double-brace form does)", () => {
    expect(detectVariables("{company}")).toEqual([]);
    expect(detectVariables("{{company}}")).toEqual(["company"]);
  });

  it("is case-sensitive: company and Company are distinct variables", () => {
    expect(detectVariables("{{company}} {{Company}}")).toEqual(["company", "Company"]);
  });
});

describe("unresolvedVariables", () => {
  it("reports a whitespace-only value and a missing key, not a falsy-looking legit value", () => {
    expect(unresolvedVariables("{{a}} {{b}}", { a: "  ", b: "0" })).toEqual(["a"]);
  });

  it("reports a variable whose key is absent from values entirely", () => {
    expect(unresolvedVariables("{{a}}", {})).toEqual(["a"]);
  });

  it("reports nothing when every variable has a non-blank value", () => {
    expect(unresolvedVariables("{{a}} {{b}}", { a: "x", b: "y" })).toEqual([]);
  });
});

describe("isFullyResolved", () => {
  it("is true for a body with zero variables (vacuous truth, intentional)", () => {
    expect(isFullyResolved("no variables here", {})).toBe(true);
  });

  it("is false when a variable is unresolved", () => {
    expect(isFullyResolved("{{a}}", {})).toBe(false);
  });

  it("is true when every variable is resolved", () => {
    expect(isFullyResolved("{{a}}", { a: "x" })).toBe(true);
  });
});

describe("substituteVariables", () => {
  it("produces a string containing no {{ when all values are present", () => {
    const result = substituteVariables("{{a}} and {{b}}", { a: "x", b: "y" });
    expect(result).toBe("x and y");
    expect(result).not.toContain("{{");
  });

  it("leaves an unresolved placeholder's literal text in place", () => {
    expect(substituteVariables("{{a}}", {})).toBe("{{a}}");
    expect(substituteVariables("{{a}}", { a: "   " })).toBe("{{a}}");
  });

  it("SINGLE-PASS control: a value containing {{b}} is emitted literally, values.b never leaks in", () => {
    const result = substituteVariables("{{a}}", { a: "{{b}}", b: "LEAKED" });
    expect(result).toBe("{{b}}");
    expect(result).toContain("{{b}}");
    expect(result).not.toContain("LEAKED");
  });
});

describe("VARIABLE_PATTERN_SOURCE", () => {
  it("is a non-empty string", () => {
    expect(typeof VARIABLE_PATTERN_SOURCE).toBe("string");
    expect(VARIABLE_PATTERN_SOURCE.length).toBeGreaterThan(0);
  });

  it("produces identical matches from two freshly-built regexes over the same body (no shared lastIndex state)", () => {
    const body = "{{a}} middle {{b}} end {{a}}";
    const regexOne = new RegExp(VARIABLE_PATTERN_SOURCE, "g");
    const regexTwo = new RegExp(VARIABLE_PATTERN_SOURCE, "g");
    const matchesOne = [...body.matchAll(regexOne)].map((m) => m[1]);
    const matchesTwo = [...body.matchAll(regexTwo)].map((m) => m[1]);
    expect(matchesOne).toEqual(["a", "b", "a"]);
    expect(matchesTwo).toEqual(matchesOne);
  });
});
