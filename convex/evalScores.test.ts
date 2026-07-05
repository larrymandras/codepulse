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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  processTaskQualityEvent,
  buildJudgeDigest,
  JudgeOutputSchema,
  callJudgeLLM,
  storeEvalScoreHandler,
  RUBRIC_VERSION,
  type StoreEvalScoreArgs,
} from "./evalScores";
import { personaConfigChangeKey } from "./profiles";

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

describe("evalScores — buildJudgeDigest (digest builder)", () => {
  it("digest aggregates events into tool/eventType counts and includes llmMetrics summary stats", () => {
    const digest = buildJudgeDigest({
      session: {
        sessionId: "s1",
        status: "completed",
        provider: "claude",
        model: "claude-opus-4-8",
      },
      events: [
        { toolName: "Read", eventType: "PostToolUse" },
        { toolName: "Read", eventType: "PostToolUse" },
        { toolName: "Edit", eventType: "PostToolUse" },
      ],
      llmMetrics: [
        { cost: 0.01, totalTokens: 500 },
        { cost: 0.02, totalTokens: 700 },
      ],
    });

    expect(digest).toContain("Read: 2");
    expect(digest).toContain("Edit: 1");
    expect(digest).toContain("$0.0300");
    expect(digest).toContain("total tokens: 1200");
    expect(digest).toContain("LLM calls: 2");
  });

  it("names the failing tool/operation for an error-heavy session (E6 digest fidelity)", () => {
    const digest = buildJudgeDigest({
      session: { sessionId: "s2", status: "errored" },
      events: [
        { toolName: "Bash", eventType: "PostToolUseFailure", payload: { error: "npm install failed: ENOTFOUND registry.npmjs.org" } },
        { toolName: "Bash", eventType: "PostToolUseFailure", payload: { error: "npm install failed: ENOTFOUND registry.npmjs.org" } },
      ],
      llmMetrics: [],
    });

    expect(digest).toContain("[Bash]");
    expect(digest).toContain("ENOTFOUND");
    expect(digest).toContain("Errors (2)");
  });

  it("digest truncates free-text payload content to well under 300 chars per snippet", () => {
    const longError = "x".repeat(1000);
    const digest = buildJudgeDigest({
      session: { sessionId: "s3" },
      events: [
        { toolName: "Bash", eventType: "error", payload: { message: longError } },
      ],
      llmMetrics: [],
    });

    const errorLine = digest.split("\n").find((l) => l.startsWith("Errors"));
    expect(errorLine).toBeDefined();
    // The whole digest must stay bounded — the raw 1000-char payload must not
    // survive verbatim in the output.
    expect(digest.length).toBeLessThan(600);
    expect(digest).not.toContain(longError);
  });

  it("digest handles an empty session/events/llmMetrics gracefully", () => {
    const digest = buildJudgeDigest({ session: null, events: [], llmMetrics: [] });
    expect(digest).toContain("Session: unknown");
    expect(digest).toContain("Event count: 0");
    expect(digest).toContain("Tool/event activity: none");
  });
});

describe("evalScores — JudgeOutputSchema (judge structured-output validation)", () => {
  const validOutput = {
    task_completion: 0.9,
    task_completion_rationale: "Session completed cleanly with no errors.",
    error_handling: 0.8,
    error_handling_rationale: "No errors to recover from.",
    tool_efficiency: 0.85,
    tool_efficiency_rationale: "Tool usage proportionate to the task.",
    cost_discipline: 0.95,
    cost_discipline_rationale: "Low cost for the work performed.",
    overall: 0.88,
  };

  it("accepts a clean 4-dimension + overall judge object", () => {
    const result = JudgeOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range score (task_completion 1.5)", () => {
    const result = JudgeOutputSchema.safeParse({
      ...validOutput,
      task_completion: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing dimension", () => {
    const { error_handling, ...missingDimension } = validOutput;
    const result = JudgeOutputSchema.safeParse(missingDimension);
    expect(result.success).toBe(false);
  });

  it("rejects an empty rationale", () => {
    const result = JudgeOutputSchema.safeParse({
      ...validOutput,
      cost_discipline_rationale: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("evalScores — callJudgeLLM (judge caller retry loop)", () => {
  const runQueryOk = async () => ({
    provider: "anthropic",
    model: "claude-haiku-4-5",
    apiKey: "test-key",
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function anthropicResponse(input: Record<string, unknown>) {
    return {
      ok: true,
      json: async () => ({ content: [{ type: "tool_use", input }] }),
      text: async () => "",
    };
  }

  const validJudgeInput = {
    task_completion: 0.9,
    task_completion_rationale: "clean",
    error_handling: 0.9,
    error_handling_rationale: "clean",
    tool_efficiency: 0.9,
    tool_efficiency_rationale: "clean",
    cost_discipline: 0.9,
    cost_discipline_rationale: "clean",
    overall: 0.9,
  };

  it("judge caller returns validated output on a clean first attempt", async () => {
    (fetch as any).mockResolvedValueOnce(anthropicResponse(validJudgeInput));

    const result = await callJudgeLLM(runQueryOk, "system", "user");
    expect(result.output.overall).toBe(0.9);
    expect(result.model).toBe("claude-haiku-4-5");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("judge caller repairs a zod-invalid response and succeeds on retry", async () => {
    (fetch as any)
      .mockResolvedValueOnce(anthropicResponse({ ...validJudgeInput, task_completion: 1.5 }))
      .mockResolvedValueOnce(anthropicResponse(validJudgeInput));

    const result = await callJudgeLLM(runQueryOk, "system", "user");
    expect(result.output.overall).toBe(0.9);
    expect(fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((fetch as any).mock.calls[1][1].body);
    expect(secondCallBody.messages[0].content).toContain("failed validation");
  });

  it("judge caller retries an HTTP failure without a repair message", async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "server error" })
      .mockResolvedValueOnce(anthropicResponse(validJudgeInput));

    const result = await callJudgeLLM(runQueryOk, "system", "user");
    expect(result.output.overall).toBe(0.9);
    expect(fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((fetch as any).mock.calls[1][1].body);
    expect(secondCallBody.messages[0].content).not.toContain("failed validation");
  });

  it("judge caller throws after exhausting all 3 attempts and writes no row (no side effect on failure)", async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "err" })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "err" })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "err" });

    await expect(callJudgeLLM(runQueryOk, "system", "user")).rejects.toThrow(
      /Judge failed after 3 attempts/
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("judge caller never logs the apiKey", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "err" })
      .mockResolvedValueOnce(anthropicResponse(validJudgeInput));

    await callJudgeLLM(runQueryOk, "system", "user");
    for (const call of errorSpy.mock.calls) {
      expect(String(call[0])).not.toContain("test-key");
    }
    errorSpy.mockRestore();
  });
});

describe("evalScores — storeEvalScoreHandler (idempotent judge score store)", () => {
  function makeFakeDb() {
    const rows: any[] = [];
    return {
      rows,
      query(_table: string) {
        const conditions: Array<[string, any]> = [];
        return {
          withIndex(_indexName: string, cb: (q: any) => any) {
            const qProxy = {
              eq(field: string, value: any) {
                conditions.push([field, value]);
                return qProxy;
              },
            };
            cb(qProxy);
            return {
              first: async () =>
                rows.find((r) => conditions.every(([f, v]) => r[f] === v)) ??
                null,
            };
          },
        };
      },
      insert: async (_table: string, doc: any) => {
        rows.push(doc);
        return "fake-id";
      },
    };
  }

  const baseArgs: StoreEvalScoreArgs = {
    sessionId: "s1",
    profileId: "business",
    judgeModel: "claude-haiku-4-5",
    timestamp: 1000,
    task_completion: 0.9,
    task_completion_rationale: "clean",
    error_handling: 0.8,
    error_handling_rationale: "clean",
    tool_efficiency: 0.85,
    tool_efficiency_rationale: "clean",
    cost_discipline: 0.95,
    cost_discipline_rationale: "clean",
    overall: 0.88,
  };

  it("writes exactly one row on first call", async () => {
    const db = makeFakeDb();
    await storeEvalScoreHandler({ db }, baseArgs);
    expect(db.rows.length).toBe(1);
    expect(db.rows[0].scoreName).toBe("llm_judge");
    expect(db.rows[0].idempotencyKey).toBe("judge:s1");
  });

  it("is idempotent — a second call for the same session writes no second row", async () => {
    const db = makeFakeDb();
    await storeEvalScoreHandler({ db }, baseArgs);
    await storeEvalScoreHandler({ db }, baseArgs);
    expect(db.rows.length).toBe(1);
  });

  it("stamps rubricVersion and judgeModel", async () => {
    const db = makeFakeDb();
    await storeEvalScoreHandler({ db }, baseArgs);
    expect(db.rows[0].rubricVersion).toBe(RUBRIC_VERSION);
    expect(db.rows[0].judgeModel).toBe("claude-haiku-4-5");
  });

  it("stores per-dimension score+rationale in the dimensions map", async () => {
    const db = makeFakeDb();
    await storeEvalScoreHandler({ db }, baseArgs);
    expect(db.rows[0].dimensions.task_completion).toEqual({
      score: 0.9,
      rationale: "clean",
    });
    expect(db.rows[0].dimensions.cost_discipline).toEqual({
      score: 0.95,
      rationale: "clean",
    });
  });
});

describe("profiles — personaConfigChangeKey (configChange audit key)", () => {
  it('produces "profile.business.modelPreferences" for profileId "business"', () => {
    expect(personaConfigChangeKey("business")).toBe(
      "profile.business.modelPreferences"
    );
  });

  it("matches the profile.<id>.<field> naming of the existing updateEmail precedent", () => {
    expect(personaConfigChangeKey("personal")).toBe(
      "profile.personal.modelPreferences"
    );
    expect(personaConfigChangeKey("consulting")).toBe(
      "profile.consulting.modelPreferences"
    );
  });
});
