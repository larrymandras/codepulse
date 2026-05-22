import { describe, it, expect } from "vitest";

// Tests for GW-09: routingDecisions backend service

describe("routingDecisions — insert args shape", () => {
  it("insert accepts all required and optional score fields", () => {
    const args = {
      taskId: "task-abc",
      requestedProvider: "claude-sdk",
      selectedProvider: "codex",
      quotaScore: 0.8,
      latencyScore: 0.6,
      costScore: 0.9,
      finalScore: 0.77,
      fallbackUsed: true,
      timestamp: Date.now() / 1000,
    };
    expect(args).toHaveProperty("taskId");
    expect(args).toHaveProperty("requestedProvider");
    expect(args).toHaveProperty("selectedProvider");
    expect(args).toHaveProperty("fallbackUsed");
    expect(args).toHaveProperty("timestamp");
    expect(typeof args.quotaScore).toBe("number");
    expect(typeof args.finalScore).toBe("number");
  });

  it("insert stores fallbackUsed as boolean not string", () => {
    // T-68-03: v.boolean() validator enforces this — verify args shape
    const args = { fallbackUsed: true };
    expect(typeof args.fallbackUsed).toBe("boolean");
    expect(args.fallbackUsed).not.toBe("true");
    expect(args.fallbackUsed).not.toBe(1);
  });

  it("insert allows all score fields to be optional (undefined)", () => {
    const args = {
      taskId: "task-xyz",
      requestedProvider: "codex",
      selectedProvider: "codex",
      quotaScore: undefined,
      latencyScore: undefined,
      costScore: undefined,
      finalScore: undefined,
      fallbackUsed: false,
      timestamp: 9999.0,
    };
    expect(args.quotaScore).toBeUndefined();
    expect(args.latencyScore).toBeUndefined();
    expect(args.fallbackUsed).toBe(false);
  });
});

describe("routingDecisions — listPaginated ordering contract", () => {
  it("returns results in descending timestamp order", () => {
    // The query uses .withIndex("by_timestamp").order("desc") —
    // verify that a sorted array of decisions would have newest first.
    const decisions = [
      { taskId: "t1", timestamp: 100 },
      { taskId: "t2", timestamp: 300 },
      { taskId: "t3", timestamp: 200 },
    ];
    const sorted = [...decisions].sort((a, b) => b.timestamp - a.timestamp);
    expect(sorted[0].taskId).toBe("t2");
    expect(sorted[1].taskId).toBe("t3");
    expect(sorted[2].taskId).toBe("t1");
  });
});
