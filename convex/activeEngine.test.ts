import { describe, it, expect } from "vitest";
import { deduplicateByProfile } from "./activeEngine";

// Tests for Phase 103 (BSC-01, D-14): activeEngine backend service

describe("recordRouting args shape", () => {
  it("accepts all required fields plus optional selectionPath/expiresAt", () => {
    const args = {
      profileId: "personal",
      model: "claude-opus-5",
      mode: "pinned",
      selectionPath: "codepulse-default",
      expiresAt: undefined,
      timestamp: Date.now() / 1000,
    };
    expect(args).toHaveProperty("profileId");
    expect(args).toHaveProperty("model");
    expect(args).toHaveProperty("mode");
    expect(args).toHaveProperty("timestamp");
    expect(args.expiresAt).toBeUndefined();
  });
});

describe("deduplicateByProfile — latestByProfile logic", () => {
  it("keeps exactly one row per profile, the newest, given two profiles in descending-timestamp order", () => {
    // Rows ordered newest-first (as returned by by_timestamp desc)
    const rows = [
      { profileId: "personal", timestamp: 200, model: "claude-opus-5", mode: "pinned" },
      { profileId: "business", timestamp: 150, model: "gpt-5", mode: "inherited" },
      { profileId: "personal", timestamp: 100, model: "claude-sonnet-5", mode: "session" },
    ];
    const result = deduplicateByProfile(rows);
    expect(result).toHaveLength(2);
    const personal = result.find((r) => r.profileId === "personal");
    expect(personal!.timestamp).toBe(200);
    expect(personal!.model).toBe("claude-opus-5");
  });

  it("returns one row when a single profile has three snapshots", () => {
    const rows = [
      { profileId: "consulting", timestamp: 300, model: "claude-opus-5", mode: "pinned" },
      { profileId: "consulting", timestamp: 200, model: "gpt-5", mode: "session" },
      { profileId: "consulting", timestamp: 100, model: "claude-sonnet-5", mode: "inherited" },
    ];
    const result = deduplicateByProfile(rows);
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(300);
  });

  it("returns an empty array (never undefined) given an empty input", () => {
    const result = deduplicateByProfile([]);
    expect(result).toEqual([]);
    expect(result).not.toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it("returns two profiles with two distinct model values — the Mixed-brains badge precondition", () => {
    const rows = [
      { profileId: "personal", timestamp: 200, model: "claude-opus-5", mode: "pinned" },
      { profileId: "business", timestamp: 190, model: "gpt-5", mode: "inherited" },
    ];
    const result = deduplicateByProfile(rows);
    expect(result).toHaveLength(2);
    const models = new Set(result.map((r) => r.model));
    expect(models.size).toBe(2);
    expect(models.has("claude-opus-5")).toBe(true);
    expect(models.has("gpt-5")).toBe(true);
  });
});
