import { describe, it, expect } from "vitest";
import { categorizeRhythm, CATEGORY_COLORS, type RhythmCategory } from "./rhythmCategories";

describe("categorizeRhythm", () => {
  it("classifies morning/briefing actions", () => {
    expect(categorizeRhythm("morning briefing")).toBe("morning");
    expect(categorizeRhythm("Evening Digest")).toBe("morning");
    expect(categorizeRhythm("Weekly Digest summary")).toBe("morning");
  });

  it("classifies health actions", () => {
    expect(categorizeRhythm("health check")).toBe("health");
    expect(categorizeRhythm("Monitor services")).toBe("health");
    expect(categorizeRhythm("status update")).toBe("health");
  });

  it("classifies research actions", () => {
    expect(categorizeRhythm("PR digest")).toBe("research");
    expect(categorizeRhythm("code review")).toBe("research");
    expect(categorizeRhythm("Research new frameworks")).toBe("research");
  });

  it("classifies content actions", () => {
    expect(categorizeRhythm("create video")).toBe("content");
    expect(categorizeRhythm("Generate blog post")).toBe("content");
    expect(categorizeRhythm("Write newsletter")).toBe("content");
  });

  it("classifies review actions", () => {
    expect(categorizeRhythm("audit report")).toBe("review");
    expect(categorizeRhythm("Weekly review")).toBe("review");
  });

  it("defaults to system for unmatched actions", () => {
    expect(categorizeRhythm("run cron job")).toBe("system");
    expect(categorizeRhythm("sync data")).toBe("system");
  });
});

describe("CATEGORY_COLORS", () => {
  it("has all 6 category keys", () => {
    const expected: RhythmCategory[] = ["health", "morning", "research", "content", "review", "system"];
    for (const key of expected) {
      expect(CATEGORY_COLORS[key]).toBeDefined();
    }
  });
});
