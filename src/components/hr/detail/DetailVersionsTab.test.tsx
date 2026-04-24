import { describe, it, expect } from "vitest";
import { computeDiff } from "./DetailVersionsTab";

describe("computeDiff", () => {
  it("detects changed fields", () => {
    const result = computeDiff(
      { name: "Alpha", tier: "domain" },
      { name: "Beta", tier: "domain" },
    );
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("name");
    expect(result[0].type).toBe("changed");
    expect(result[0].oldVal).toBe("Alpha");
    expect(result[0].newVal).toBe("Beta");
  });

  it("detects added fields", () => {
    const result = computeDiff(
      { name: "Alpha" },
      { name: "Alpha", tier: "domain" },
    );
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("tier");
    expect(result[0].type).toBe("added");
    expect(result[0].oldVal).toBeUndefined();
    expect(result[0].newVal).toBe("domain");
  });

  it("detects removed fields", () => {
    const result = computeDiff(
      { name: "Alpha", tier: "domain" },
      { name: "Alpha" },
    );
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("tier");
    expect(result[0].type).toBe("removed");
    expect(result[0].oldVal).toBe("domain");
    expect(result[0].newVal).toBeUndefined();
  });

  it("skips the id field", () => {
    const result = computeDiff(
      { id: "old", name: "Alpha" },
      { id: "new", name: "Alpha" },
    );
    expect(result).toHaveLength(0);
  });

  it("returns empty array for identical objects", () => {
    const result = computeDiff(
      { name: "Alpha", tier: "domain" },
      { name: "Alpha", tier: "domain" },
    );
    expect(result).toHaveLength(0);
  });

  it("sorts fields alphabetically", () => {
    const result = computeDiff({ z: 1, a: 1 }, { z: 2, a: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].field).toBe("a");
    expect(result[1].field).toBe("z");
  });
});
