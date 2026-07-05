/**
 * Phase 93 (EVAL-01) — evalScores ingest unit tests
 *
 * Tests verify:
 * (a) field coalescing: processTaskQualityEvent maps snake_case/camelCase
 *     Ástríðr payload fields to the evalScores row shape
 * (b) missing optional fields default sanely (profileId/sessionId → "unknown")
 * (c) missing/non-numeric score produces a non-persistable (NaN) overall,
 *     which the ingestTaskQuality mutation must reject before insert
 *
 * Uses plain vitest — convex-test is NOT installed in this repo
 * (see convex/runtimeIngest.test.ts:9).
 */
import { describe, it, expect } from "vitest";
import { processTaskQualityEvent } from "./evalScores";

describe("evalScores — processTaskQualityEvent", () => {
  it("coalesces a full snake_case Ástríðr payload to the evalScores row shape", () => {
    const args = processTaskQualityEvent(
      { score: 0.8, profile_id: "business", session_id: "s1", event_id: "e1" },
      123
    );
    expect(args.overall).toBe(0.8);
    expect(args.profileId).toBe("business");
    expect(args.sessionId).toBe("s1");
    expect(args.idempotencyKey).toBe("e1");
    expect(args.scoreName).toBe("task_quality");
    expect(args.timestamp).toBe(123);
  });

  it("prefers camelCase fields when both camelCase and snake_case are present", () => {
    const args = processTaskQualityEvent(
      {
        overall: 0.5,
        score: 0.1,
        profileId: "personal",
        profile_id: "consulting",
        sessionId: "sess-camel",
        session_id: "sess-snake",
        idempotencyKey: "key-camel",
        event_id: "key-snake",
      },
      456
    );
    expect(args.overall).toBe(0.5);
    expect(args.profileId).toBe("personal");
    expect(args.sessionId).toBe("sess-camel");
    expect(args.idempotencyKey).toBe("key-camel");
  });

  it("defaults profileId to \"unknown\" when absent", () => {
    const args = processTaskQualityEvent(
      { score: 0.9, session_id: "s2", event_id: "e2" },
      789
    );
    expect(args.profileId).toBe("unknown");
  });

  it("defaults sessionId to \"unknown\" when absent", () => {
    const args = processTaskQualityEvent(
      { score: 0.9, profile_id: "business", event_id: "e3" },
      1000
    );
    expect(args.sessionId).toBe("unknown");
  });

  it("leaves idempotencyKey undefined when neither idempotencyKey nor event_id present", () => {
    const args = processTaskQualityEvent(
      { score: 0.6, profile_id: "business", session_id: "s3" },
      1100
    );
    expect(args.idempotencyKey).toBeUndefined();
  });

  it("produces NaN overall when score/overall is absent (mutation must reject, not persist)", () => {
    const args = processTaskQualityEvent(
      { profile_id: "business", session_id: "s4", event_id: "e4" },
      1200
    );
    expect(Number.isNaN(args.overall)).toBe(true);
  });

  it("produces NaN overall when score is a non-numeric string", () => {
    const args = processTaskQualityEvent(
      { score: "not-a-number", profile_id: "business", session_id: "s5" },
      1300
    );
    expect(Number.isNaN(args.overall)).toBe(true);
  });
});

describe("evalScores — ingestTaskQuality score-range guard (pure predicate mirror)", () => {
  // Mirrors the `if (!Number.isFinite(...) || overall < 0 || overall > 1) return;`
  // guard inside the ingestTaskQuality mutation handler (convex/evalScores.ts).
  // Mutation internals (ctx.db) require a live Convex instance, which
  // convex-test does not provide here — so the guard predicate itself is
  // exercised directly per the established test convention.
  function isValidScore(overall: number): boolean {
    return Number.isFinite(overall) && overall >= 0 && overall <= 1;
  }

  it("accepts an in-range score", () => {
    expect(isValidScore(0.8)).toBe(true);
    expect(isValidScore(0)).toBe(true);
    expect(isValidScore(1)).toBe(true);
  });

  it("rejects NaN", () => {
    expect(isValidScore(NaN)).toBe(false);
  });

  it("rejects out-of-range scores", () => {
    expect(isValidScore(-0.1)).toBe(false);
    expect(isValidScore(1.1)).toBe(false);
  });
});
