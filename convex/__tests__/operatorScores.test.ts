import { describe, it, expect } from "vitest";

/**
 * Convex operatorScores module tests.
 *
 * These tests verify the exported functions from operatorScores.ts
 * are correctly defined. Full integration tests require a Convex
 * test environment; these are structural/smoke tests.
 */
describe("operatorScores module", () => {
  it("exports insert mutation", async () => {
    const mod = await import("../operatorScores");
    expect(mod.insert).toBeDefined();
  });

  it("exports latest query", async () => {
    const mod = await import("../operatorScores");
    expect(mod.latest).toBeDefined();
  });

  it("exports last30 query", async () => {
    const mod = await import("../operatorScores");
    expect(mod.last30).toBeDefined();
  });

  it("exports backfillFromSupabase action", async () => {
    const mod = await import("../operatorScores");
    expect(mod.backfillFromSupabase).toBeDefined();
  });
});
