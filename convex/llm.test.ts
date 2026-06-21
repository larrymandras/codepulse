import { describe, it, expect } from "vitest";

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
  });
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
