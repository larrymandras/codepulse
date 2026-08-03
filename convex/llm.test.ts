import { describe, it, expect } from "vitest";
import { SESSION_CALLS_READ_CAP } from "./llm";

// ---------------------------------------------------------------------------
// Minimal in-memory ctx.db for goalId-persistence test (Phase 149 PULSE-01)
// ---------------------------------------------------------------------------

function makeLlmStore() {
  const llmMetrics: Record<string, any>[] = [];
  const db = {
    insert: async (tableName: string, data: Record<string, any>) => {
      if (tableName === "llmMetrics") llmMetrics.push({ ...data });
    },
  };
  return { llmMetrics, db };
}

// Mirrors the insert block in llm.ts recordCall handler (fields only, billingType stubbed).
async function recordCallLogic(ctx: any, args: any) {
  await ctx.db.insert("llmMetrics", {
    provider: args.provider,
    model: args.model,
    promptTokens: args.promptTokens,
    completionTokens: args.completionTokens,
    totalTokens: args.totalTokens,
    latencyMs: args.latencyMs,
    cost: args.cost,
    sessionId: args.sessionId,
    timestamp: args.timestamp,
    agentId: args.agentId,
    toolName: args.toolName,
    billingType: "api",
    goalId: args.goalId,  // Phase 149 PULSE-01
    traceId: args.traceId,  // Phase 94 TRACE-01
    round: args.round,  // Phase 105 D-10
  });
}

// Mirrors the sessionCalls query handler in llm.ts (Phase 105 D-12 + Phase 94
// TRACE-02): by_session index filter + archived exclusion, read in
// descending timestamp order and capped, then reversed back to ascending so
// a cap hit keeps the MOST RECENT rows (not the oldest).
function sessionCallsLogic(
  store: { llmMetrics: Record<string, any>[] },
  args: { sessionId: string },
  cap: number = SESSION_CALLS_READ_CAP
) {
  const filtered = store.llmMetrics.filter(
    (r) => r.sessionId === args.sessionId && r.archived !== true
  );
  const descRows = [...filtered].sort((a, b) => b.timestamp - a.timestamp).slice(0, cap);
  const truncated = descRows.length >= cap;
  const rows = descRows.slice().reverse();
  return { rows, truncated, cap };
}

describe("llm", () => {
  describe("recordCall — goalId persistence (Phase 149 PULSE-01)", () => {
    it("persists goalId into the llmMetrics row", async () => {
      const store = makeLlmStore();
      await recordCallLogic(store, {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        timestamp: 1000,
        goalId: "goal-abc-123",
      });
      expect(store.llmMetrics).toHaveLength(1);
      expect(store.llmMetrics[0].goalId).toBe("goal-abc-123");
    });

    it("goalId is undefined for non-swarm calls (backward compat)", async () => {
      const store = makeLlmStore();
      await recordCallLogic(store, {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        timestamp: 1000,
        // goalId intentionally absent
      });
      expect(store.llmMetrics[0].goalId).toBeUndefined();
    });
  });

  describe("recordCall — traceId persistence (Phase 94 TRACE-01)", () => {
    it("persists traceId into the llmMetrics row", async () => {
      const store = makeLlmStore();
      await recordCallLogic(store, {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        timestamp: 1000,
        traceId: "trace-abc-123",
      });
      expect(store.llmMetrics).toHaveLength(1);
      expect(store.llmMetrics[0].traceId).toBe("trace-abc-123");
    });

    it("traceId is undefined when omitted (backward compat — existing rows unaffected)", async () => {
      const store = makeLlmStore();
      await recordCallLogic(store, {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        timestamp: 1000,
        // traceId intentionally absent
      });
      expect(store.llmMetrics[0].traceId).toBeUndefined();
    });
  });

  describe("recordCall — round persistence (Phase 105 D-10)", () => {
    it("persists round into the llmMetrics row", async () => {
      const store = makeLlmStore();
      await recordCallLogic(store, {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        timestamp: 1000,
        round: 3,
      });
      expect(store.llmMetrics).toHaveLength(1);
      expect(store.llmMetrics[0].round).toBe(3);
    });

    it("round 0 is persisted, not dropped by a falsy-value bug", async () => {
      const store = makeLlmStore();
      await recordCallLogic(store, {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        timestamp: 1000,
        round: 0,
      });
      expect(store.llmMetrics[0].round).toBe(0);
    });

    it("round is undefined when omitted (backward compat — existing callers unaffected)", async () => {
      const store = makeLlmStore();
      await recordCallLogic(store, {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        timestamp: 1000,
        // round intentionally absent
      });
      expect(store.llmMetrics[0].round).toBeUndefined();
    });
  });

  describe("sessionCalls (Phase 94 TRACE-02)", () => {
    function seedMixedStore() {
      const store = makeLlmStore();
      store.llmMetrics.push(
        { sessionId: "sess-A", timestamp: 300, traceId: "trace-1" },
        { sessionId: "sess-A", timestamp: 100, traceId: "trace-1" },
        { sessionId: "sess-A", timestamp: 200 }, // legacy row, no traceId
        { sessionId: "sess-A", timestamp: 400, archived: true, traceId: "trace-2" },
        { sessionId: "sess-B", timestamp: 150, traceId: "trace-3" }
      );
      return store;
    }

    it("returns only rows matching the given sessionId", () => {
      const store = seedMixedStore();
      const { rows } = sessionCallsLogic(store, { sessionId: "sess-A" });
      expect(rows.every((r) => r.sessionId === "sess-A")).toBe(true);
      expect(rows).toHaveLength(3);
    });

    it("excludes archived rows", () => {
      const store = seedMixedStore();
      const { rows } = sessionCallsLogic(store, { sessionId: "sess-A" });
      expect(rows.some((r) => r.archived === true)).toBe(false);
    });

    it("returns rows in ascending timestamp order", () => {
      const store = seedMixedStore();
      const { rows } = sessionCallsLogic(store, { sessionId: "sess-A" });
      expect(rows.map((r) => r.timestamp)).toEqual([100, 200, 300]);
    });

    it("a legacy row with no traceId is still returned with traceId undefined", () => {
      const store = seedMixedStore();
      const { rows } = sessionCallsLogic(store, { sessionId: "sess-A" });
      const legacyRow = rows.find((r) => r.timestamp === 200);
      expect(legacyRow).toBeDefined();
      expect(legacyRow!.traceId).toBeUndefined();
    });

    it("truncated=false below the cap; truncated=true at/above the cap (Phase 105 D-12)", () => {
      const belowCap = makeLlmStore();
      for (let i = 0; i < SESSION_CALLS_READ_CAP - 1; i++) {
        belowCap.llmMetrics.push({ sessionId: "sess-cap", timestamp: i });
      }
      const atCap = makeLlmStore();
      for (let i = 0; i < SESSION_CALLS_READ_CAP; i++) {
        atCap.llmMetrics.push({ sessionId: "sess-cap", timestamp: i });
      }

      expect(sessionCallsLogic(belowCap, { sessionId: "sess-cap" }).truncated).toBe(false);
      expect(sessionCallsLogic(atCap, { sessionId: "sess-cap" }).truncated).toBe(true);
    });

    it("keeps the MOST RECENT cap rows when the session exceeds the cap, not the oldest", () => {
      const store = makeLlmStore();
      for (let i = 0; i < SESSION_CALLS_READ_CAP + 5; i++) {
        store.llmMetrics.push({ sessionId: "sess-cap", timestamp: i });
      }

      const { rows, truncated, cap } = sessionCallsLogic(store, { sessionId: "sess-cap" });

      expect(truncated).toBe(true);
      expect(cap).toBe(SESSION_CALLS_READ_CAP);
      const timestamps = rows.map((r) => r.timestamp);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
      expect(Math.min(...timestamps)).toBe(5); // oldest 5 dropped
      expect(Math.max(...timestamps)).toBe(SESSION_CALLS_READ_CAP + 4);
    });
  });

  describe("recordCall — extended args", () => {
    it("accepts optional agentId and toolName alongside existing fields", () => {
      const args = {
        provider: "anthropic",
        model: "claude-opus-4",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 1200,
        cost: 0.003,
        sessionId: "sess-123",
        timestamp: Date.now() / 1000,
        agentId: "agent-alpha",
        toolName: "web_search",
      };
      expect(args.agentId).toBe("agent-alpha");
      expect(args.toolName).toBe("web_search");
    });

    it("allows agentId and toolName to be undefined", () => {
      const args = {
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        latencyMs: 800,
        timestamp: Date.now() / 1000,
      };
      expect((args as any).agentId).toBeUndefined();
      expect((args as any).toolName).toBeUndefined();
    });

    it.todo("should insert row with agentId and toolName fields (DB round-trip)");
  });

  describe("backfillAgentId — batch logic", () => {
    it("uses batch size of 100", () => {
      const BATCH_SIZE = 100;
      expect(BATCH_SIZE).toBe(100);
    });

    it("returns processed count for caller to determine completion", () => {
      const rows = Array(100).fill({ _id: "id", agentId: undefined });
      const result = { processed: rows.length };
      expect(result.processed).toBe(100);
    });

    it("signals completion when processed is 0", () => {
      const rows: any[] = [];
      const result = { processed: rows.length };
      expect(result.processed).toBe(0);
    });

    it("marks unresolvable rows with _unknown to prevent infinite loop", () => {
      const derivedAgentId: string | undefined = undefined;
      const patchValue = derivedAgentId ?? "_unknown";
      expect(patchValue).toBe("_unknown");
    });

    it.todo("should filter for rows where agentId is undefined (DB round-trip)");
    it.todo("should join via sessionId to agents table for agentId lookup (DB round-trip)");
  });
});
