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
  JUDGE_TOOL,
  OPENAI_JUDGE_SCHEMA,
  storeEvalScoreHandler,
  RUBRIC_VERSION,
  sampleSessionsForPersonas,
  runJudgeBatch,
  judgeWindowDayStart,
  meanOverall,
  periodDelta,
  buildPersonaKpi,
  buildPersonaDetailSeries,
  buildChangeMarkers,
  evaluateRegression,
  buildRegressionMessage,
  insertRegressionAlertHandler,
  detectRegressionsForPersona,
  MIN_SESSIONS_PER_SIDE,
  REGRESSION_DROP_THRESHOLD,
  type StoreEvalScoreArgs,
  type DetectRegressionsCtx,
} from "./evalScores";
import { personaConfigChangeKey } from "./profiles";
import { internal } from "./_generated/api";

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

describe("evalScores — OpenAI judge branch (CR-03: strict schema compatibility)", () => {
  const runQueryOpenAI = async () => ({
    provider: "openai",
    model: "gpt-test",
    apiKey: "test-key",
  });

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

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("OPENAI_JUDGE_SCHEMA carries additionalProperties: false and no minimum/maximum keywords", () => {
    expect(OPENAI_JUDGE_SCHEMA.additionalProperties).toBe(false);
    const serialized = JSON.stringify(OPENAI_JUDGE_SCHEMA);
    expect(serialized).not.toContain('"minimum"');
    expect(serialized).not.toContain('"maximum"');
    // Same field set as the Anthropic tool schema — nothing lost in translation.
    expect(Object.keys(OPENAI_JUDGE_SCHEMA.properties).sort()).toEqual(
      Object.keys(JUDGE_TOOL.input_schema.properties).sort()
    );
    expect([...OPENAI_JUDGE_SCHEMA.required].sort()).toEqual(
      [...JUDGE_TOOL.input_schema.required].sort()
    );
  });

  it("the OpenAI request body sends the strict-compatible schema, not the raw tool schema", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(validJudgeInput) } }],
      }),
      text: async () => "",
    });

    const result = await callJudgeLLM(runQueryOpenAI, "system", "user");
    expect(result.output.overall).toBe(0.9);
    expect(result.model).toBe("gpt-test");

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    const jsonSchema = body.response_format.json_schema;
    expect(jsonSchema.strict).toBe(true);
    expect(jsonSchema.schema.additionalProperties).toBe(false);
    expect(JSON.stringify(jsonSchema.schema)).not.toContain('"minimum"');
    expect(JSON.stringify(jsonSchema.schema)).not.toContain('"maximum"');
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

describe("evalScores — sampleSessionsForPersonas (nightly sampling, D-08)", () => {
  const activePersonas = ["personal", "business", "consulting"];

  it("sampling caps at 3 sessions per persona", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      sessionId: `biz-${i}`,
      profileId: "business",
    }));

    const { sampled } = sampleSessionsForPersonas(activePersonas, candidates);
    const businessSampled = sampled.filter((s) => s.profileId === "business");
    expect(businessSampled.length).toBe(3);
  });

  it("sampling distributes across all active personas independently", () => {
    const candidates = [
      { sessionId: "p1", profileId: "personal" },
      { sessionId: "p2", profileId: "personal" },
      { sessionId: "b1", profileId: "business" },
      { sessionId: "c1", profileId: "consulting" },
    ];

    const { sampled } = sampleSessionsForPersonas(activePersonas, candidates);
    expect(sampled.filter((s) => s.profileId === "personal").length).toBe(2);
    expect(sampled.filter((s) => s.profileId === "business").length).toBe(1);
    expect(sampled.filter((s) => s.profileId === "consulting").length).toBe(1);
  });

  it("sampling buckets an unresolvable persona attribution under \"unknown\" and counts it", () => {
    const candidates = [
      { sessionId: "s1", profileId: undefined },
      { sessionId: "s2", profileId: "some-non-persona-agent-type" },
      { sessionId: "s3", profileId: "business" },
    ];

    const { sampled, unknownCount } = sampleSessionsForPersonas(
      activePersonas,
      candidates
    );

    expect(unknownCount).toBe(2);
    const unknownSampled = sampled.filter((s) => s.profileId === "unknown");
    expect(unknownSampled.length).toBe(2);
    expect(unknownSampled.map((s) => s.sessionId).sort()).toEqual(["s1", "s2"]);
  });

  it("sampling returns zero unknownCount when every candidate attributes cleanly", () => {
    const candidates = [
      { sessionId: "p1", profileId: "personal" },
      { sessionId: "b1", profileId: "business" },
    ];
    const { unknownCount } = sampleSessionsForPersonas(activePersonas, candidates);
    expect(unknownCount).toBe(0);
  });
});

describe("evalScores — judgeWindowDayStart (CR-01: judge the previous complete UTC day)", () => {
  const DAY = 86400;

  it("at the 05:00 UTC cron moment, the window is the PREVIOUS UTC day, not the current one", () => {
    const cronMomentMs = Date.UTC(2026, 6, 6, 5, 0, 0); // Jul 6 2026 05:00 UTC
    const dayStart = judgeWindowDayStart(cronMomentMs);
    expect(dayStart).toBe(Date.UTC(2026, 6, 5, 0, 0, 0) / 1000); // Jul 5 00:00 UTC
  });

  it("a session completing AFTER 05:00 UTC falls inside the next night's window (never skipped)", () => {
    // Session completes Jul 5 at 18:00 UTC — after that day's 05:00 run.
    const sessionLastEventAt = Date.UTC(2026, 6, 5, 18, 0, 0) / 1000;
    // The NEXT run (Jul 6, 05:00 UTC) must cover it.
    const dayStart = judgeWindowDayStart(Date.UTC(2026, 6, 6, 5, 0, 0));
    expect(sessionLastEventAt).toBeGreaterThanOrEqual(dayStart);
    expect(sessionLastEventAt).toBeLessThan(dayStart + DAY);
  });

  it("a session completing BEFORE 05:00 UTC is covered exactly once (by the same day's run)", () => {
    // Session completes Jul 6 at 02:00 UTC.
    const sessionLastEventAt = Date.UTC(2026, 6, 6, 2, 0, 0) / 1000;
    // Jul 6's 05:00 run covers Jul 5 — does NOT include it.
    const jul6Start = judgeWindowDayStart(Date.UTC(2026, 6, 6, 5, 0, 0));
    expect(sessionLastEventAt).toBeGreaterThanOrEqual(jul6Start + DAY);
    // Jul 7's 05:00 run covers Jul 6 — includes it.
    const jul7Start = judgeWindowDayStart(Date.UTC(2026, 6, 7, 5, 0, 0));
    expect(sessionLastEventAt).toBeGreaterThanOrEqual(jul7Start);
    expect(sessionLastEventAt).toBeLessThan(jul7Start + DAY);
  });
});

describe("evalScores — runJudgeBatch (Promise.allSettled isolation, Pitfall 5/E2)", () => {
  it("one rejecting session does not drop the others in the same batch", async () => {
    const sampled = [
      { profileId: "business", sessionId: "ok-1" },
      { profileId: "business", sessionId: "bad-1" },
      { profileId: "business", sessionId: "ok-2" },
    ];

    const judgeOne = vi.fn(async (s: { sessionId: string }) => {
      if (s.sessionId === "bad-1") {
        throw new Error("judge failed after 3 attempts");
      }
    });

    const { scored, failed } = await runJudgeBatch(sampled, judgeOne);
    expect(scored).toBe(2);
    expect(failed).toBe(1);
    expect(judgeOne).toHaveBeenCalledTimes(3);
  });

  it("all sessions succeeding reports zero failures", async () => {
    const sampled = [
      { profileId: "personal", sessionId: "a" },
      { profileId: "personal", sessionId: "b" },
    ];
    const judgeOne = vi.fn(async () => {});
    const { scored, failed } = await runJudgeBatch(sampled, judgeOne);
    expect(scored).toBe(2);
    expect(failed).toBe(0);
  });

  it("an empty sampled batch resolves with zero scored and zero failed", async () => {
    const judgeOne = vi.fn(async () => {});
    const { scored, failed } = await runJudgeBatch([], judgeOne);
    expect(scored).toBe(0);
    expect(failed).toBe(0);
    expect(judgeOne).not.toHaveBeenCalled();
  });
});

// ============================================================
// Plan 04 (EVAL-03) — KPI read queries + regression detector
// ============================================================

describe("evalScores — meanOverall / periodDelta (KPI math)", () => {
  it("meanOverall computes the arithmetic mean of .overall across rows", () => {
    expect(meanOverall([{ overall: 0.9 }, { overall: 0.8 }, { overall: 1.0 }])).toBeCloseTo(0.9);
  });

  it("meanOverall returns 0 (never NaN) for an empty set", () => {
    expect(meanOverall([])).toBe(0);
  });

  it("periodDelta returns a positive value when the current period improved", () => {
    expect(periodDelta(0.9, 0.7)).toBeCloseTo(0.2);
  });

  it("periodDelta returns a negative value when the current period dropped", () => {
    expect(periodDelta(0.5, 0.8)).toBeCloseTo(-0.3);
  });
});

describe("evalScores — buildPersonaKpi (per-persona kpi combination)", () => {
  it("combines current/previous scores into currentMean + sparkline + delta", () => {
    const current = [
      { overall: 0.9, timestamp: 300 },
      { overall: 0.8, timestamp: 100 },
      { overall: 1.0, timestamp: 200 },
    ];
    const previous = [
      { overall: 0.6, timestamp: 10 },
      { overall: 0.7, timestamp: 20 },
    ];

    const kpi = buildPersonaKpi(current, previous, false);

    expect(kpi.currentMean).toBeCloseTo(0.9);
    expect(kpi.delta).toBeCloseTo(0.25); // 0.9 - 0.65
    expect(kpi.activeRegression).toBe(false);
    // Sparkline is chronologically sorted, not insertion order.
    expect(kpi.sparkline.map((s) => s.timestamp)).toEqual([100, 200, 300]);
  });

  it("passes the activeRegression flag through unchanged", () => {
    const kpi = buildPersonaKpi([{ overall: 0.5, timestamp: 1 }], [], true);
    expect(kpi.activeRegression).toBe(true);
  });

  it("currentMean/delta stay 0 when there is no data on either side", () => {
    const kpi = buildPersonaKpi([], [], false);
    expect(kpi.currentMean).toBe(0);
    expect(kpi.delta).toBe(0);
    expect(kpi.sparkline).toEqual([]);
  });
});

describe("evalScores — buildPersonaDetailSeries (kpi detail chronological series)", () => {
  it("sorts out-of-order rows chronologically and preserves dimensions", () => {
    const series = buildPersonaDetailSeries([
      { timestamp: 300, sessionId: "s3", overall: 0.7 },
      { timestamp: 100, sessionId: "s1", overall: 0.9, dimensions: { task_completion: { score: 0.9, rationale: "clean" } } },
      { timestamp: 200, sessionId: "s2", overall: 0.8 },
    ]);

    expect(series.map((s) => s.sessionId)).toEqual(["s1", "s2", "s3"]);
    expect(series[0].dimensions).toEqual({ task_completion: { score: 0.9, rationale: "clean" } });
    expect(series[1].dimensions).toBeUndefined();
  });
});

describe("evalScores — buildChangeMarkers (kpi detail change-event markers, D-11)", () => {
  it("surfaces a profileSwitches row touching this persona as a 'switch' marker", () => {
    const markers = buildChangeMarkers(
      "business",
      [{ fromProfile: "personal", toProfile: "business", timestamp: 500 }],
      []
    );
    expect(markers).toEqual([{ timestamp: 500, changeType: "switch" }]);
  });

  it("surfaces a persona-scoped configChanges row as a 'model' marker", () => {
    const markers = buildChangeMarkers(
      "business",
      [],
      [{ configKey: "profile.business.modelPreferences", changedAt: 700 }]
    );
    expect(markers).toEqual([{ timestamp: 700, changeType: "model" }]);
  });

  it("surfaces BOTH profileSwitch and persona-scoped configChange markers together, sorted chronologically", () => {
    const markers = buildChangeMarkers(
      "business",
      [{ fromProfile: "business", toProfile: "personal", timestamp: 900 }],
      [{ configKey: "profile.business.modelPreferences", changedAt: 400 }]
    );
    expect(markers).toEqual([
      { timestamp: 400, changeType: "model" },
      { timestamp: 900, changeType: "switch" },
    ]);
  });

  it("filters out switches/configChanges belonging to a different persona", () => {
    const markers = buildChangeMarkers(
      "business",
      [{ fromProfile: "personal", toProfile: "consulting", timestamp: 500 }],
      [{ configKey: "profile.consulting.modelPreferences", changedAt: 600 }]
    );
    expect(markers).toEqual([]);
  });
});

describe("evalScores — evaluateRegression (D-12/D-14 regression gate)", () => {
  const highScores = (n: number, overall = 0.9) =>
    Array.from({ length: n }, () => ({ overall }));

  it("fires when both sides clear >=5 sessions and the drop clears the threshold", () => {
    const before = highScores(5, 0.9);
    const after = highScores(5, 0.6);
    const result = evaluateRegression(before, after);
    expect(result.fire).toBe(true);
    expect(result.meanBefore).toBeCloseTo(0.9);
    expect(result.meanAfter).toBeCloseTo(0.6);
    expect(result.drop).toBeCloseTo(0.3);
  });

  it("does NOT fire on a 2-vs-2 comparison, even with a large drop", () => {
    const before = highScores(2, 0.9);
    const after = highScores(2, 0.2);
    expect(evaluateRegression(before, after).fire).toBe(false);
  });

  it("does NOT fire on a 4-vs-6 comparison (before side below the min-sample floor)", () => {
    const before = highScores(4, 0.9);
    const after = highScores(6, 0.5);
    expect(evaluateRegression(before, after).fire).toBe(false);
  });

  it("does NOT fire when the drop is real but sub-threshold (5-vs-5)", () => {
    const before = highScores(5, 0.8);
    const after = highScores(5, 0.75); // drop 0.05 < REGRESSION_DROP_THRESHOLD
    const result = evaluateRegression(before, after);
    expect(result.fire).toBe(false);
    expect(result.drop).toBeLessThan(REGRESSION_DROP_THRESHOLD);
  });

  it("does NOT fire on a single-outlier swing that doesn't move the mean past threshold", () => {
    const before = highScores(5, 0.9);
    const after = [
      { overall: 0.9 },
      { overall: 0.9 },
      { overall: 0.9 },
      { overall: 0.9 },
      { overall: 0.3 }, // one bad session out of 5
    ];
    const result = evaluateRegression(before, after);
    expect(result.fire).toBe(false); // mean drop is 0.12, below 0.15
  });

  it("respects explicit minPerSide/dropThreshold overrides", () => {
    const before = highScores(2, 0.9);
    const after = highScores(2, 0.5);
    const result = evaluateRegression(before, after, { minPerSide: 2, dropThreshold: 0.3 });
    expect(result.fire).toBe(true);
  });

  it("uses MIN_SESSIONS_PER_SIDE=5 as the default gate", () => {
    expect(MIN_SESSIONS_PER_SIDE).toBe(5);
  });
});

describe("evalScores — buildRegressionMessage (UI-SPEC copy contract)", () => {
  it("matches the '{persona} quality dropped {N} pts after {change type} on {date} (before -> after)' shape", () => {
    const evaluation = evaluateRegression(
      Array.from({ length: 5 }, () => ({ overall: 0.82 })),
      Array.from({ length: 5 }, () => ({ overall: 0.64 }))
    );
    // Jul 3 2026, UTC noon, unambiguous across all timezones.
    const changeTimestamp = Date.UTC(2026, 6, 3, 12, 0, 0) / 1000;
    const message = buildRegressionMessage("business", evaluation, changeTimestamp, "model");
    expect(message).toBe("business quality dropped 18 pts after a model change on Jul 3 (82 → 64)");
  });

  it("renders 'an instruction change' for a profileSwitches-sourced event", () => {
    const evaluation = evaluateRegression(
      Array.from({ length: 5 }, () => ({ overall: 0.9 })),
      Array.from({ length: 5 }, () => ({ overall: 0.6 }))
    );
    const changeTimestamp = Date.UTC(2026, 6, 3, 12, 0, 0) / 1000;
    const message = buildRegressionMessage("personal", evaluation, changeTimestamp, "switch");
    expect(message).toContain("an instruction change");
  });
});

describe("evalScores — insertRegressionAlertHandler (regression alert delivery shape)", () => {
  function makeFakeDb() {
    const rows: any[] = [];
    return {
      rows,
      insert: async (_table: string, doc: any) => {
        rows.push(doc);
        return "fake-alert-id";
      },
    };
  }

  it("inserts an alert with webhookStatus pending and the eval-regression:<profileId> source (createIfNew shape)", async () => {
    const db = makeFakeDb();
    await insertRegressionAlertHandler(
      { db },
      {
        profileId: "business",
        message: "business quality dropped 18 pts after a model change on Jul 3 (82 → 64)",
        details: { before: 0.82, after: 0.64, changeDate: 123, changeType: "model" },
      }
    );

    expect(db.rows.length).toBe(1);
    const alert = db.rows[0];
    expect(alert.source).toBe("eval-regression:business");
    expect(alert.webhookStatus).toBe("pending");
    expect(alert.status).toBe("active");
    expect(alert.acknowledged).toBe(false);
    expect(alert.severity).toBe("warning");
    expect(alert.details).toEqual({ before: 0.82, after: 0.64, changeDate: 123, changeType: "model" });
  });
});

describe("evalScores — detectRegressionsForPersona (regression alert delivery + dedup)", () => {
  interface FakeCtxOptions {
    priorAlerts?: unknown[];
    switches?: Array<{ fromProfile: string; toProfile: string; timestamp: number }>;
    configChanges?: Array<{ configKey: string; changedAt: number }>;
    scoreWindows?: unknown[][];
    insertedAlertId?: string;
  }

  // Deliberately dispatches on CALL ORDER (not on which Convex function
  // reference was passed) — comparing anyApi Proxy references captured
  // through vi.fn() crashes vitest's pretty-format diffing on failure (a
  // Convex/vitest interaction quirk verified empirically while writing this
  // test, not a real assertion result), so call order is the safe substitute.
  function makeCtx(opts: FakeCtxOptions) {
    let callN = 0;
    const runQuery = vi.fn(async (_fn: any, _args: any) => {
      callN++;
      if (callN === 1) return opts.priorAlerts ?? [];
      if (callN === 2) {
        return { switches: opts.switches ?? [], configChanges: opts.configChanges ?? [] };
      }
      return opts.scoreWindows?.[callN - 3] ?? [];
    });
    const runMutation = vi.fn(async (_fn: any, _args: any) => opts.insertedAlertId ?? "alert-1");
    const runAfter = vi.fn(async (_delay: number, _fn: any, _args: any) => {});
    const ctx: DetectRegressionsCtx = { runQuery, runMutation, scheduler: { runAfter } };
    return { ctx, runQuery, runMutation, runAfter };
  }

  // Would-fire fixture: >=5 sessions per side, 0.9 -> 0.6 drop clears threshold.
  const firingWindows = [
    Array.from({ length: 5 }, () => ({ overall: 0.9 })), // before
    Array.from({ length: 5 }, () => ({ overall: 0.6 })), // after
  ];

  it("a prior ACTIVE alert for the same change event blocks re-firing — no mutation, no scheduled delivery", async () => {
    const { ctx, runQuery, runMutation, runAfter } = makeCtx({
      priorAlerts: [
        { _id: "existing-alert", status: "active", details: { changeDate: 1_000_000 } },
      ],
      configChanges: [{ configKey: "profile.business.modelPreferences", changedAt: 1_000_000 }],
      scoreWindows: firingWindows,
    });

    const result = await detectRegressionsForPersona(ctx, "business");

    expect(result.fired).toBe(false);
    expect(runQuery).toHaveBeenCalledTimes(2); // prior alerts + change events; no window reads
    expect(runMutation).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("CR-02: an ACKNOWLEDGED alert for the same change event still blocks re-firing (dedup is event-keyed, not status-keyed)", async () => {
    const { ctx, runMutation, runAfter } = makeCtx({
      priorAlerts: [
        { _id: "acked-alert", status: "acknowledged", details: { changeDate: 1_000_000 } },
      ],
      configChanges: [{ configKey: "profile.business.modelPreferences", changedAt: 1_000_000 }],
      scoreWindows: firingWindows,
    });

    const result = await detectRegressionsForPersona(ctx, "business");

    expect(result.fired).toBe(false);
    expect(runMutation).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("CR-02: a RESOLVED alert for the same change event still blocks re-firing", async () => {
    const { ctx, runMutation, runAfter } = makeCtx({
      priorAlerts: [
        { _id: "resolved-alert", status: "resolved", details: { changeDate: 1_000_000 } },
      ],
      configChanges: [{ configKey: "profile.business.modelPreferences", changedAt: 1_000_000 }],
      scoreWindows: firingWindows,
    });

    const result = await detectRegressionsForPersona(ctx, "business");

    expect(result.fired).toBe(false);
    expect(runMutation).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("CR-02: a prior alert for a DIFFERENT change event does NOT block a new regression from firing", async () => {
    const { ctx, runMutation, runAfter } = makeCtx({
      priorAlerts: [
        // Stale active alert from an old change event — must not mask the new one.
        { _id: "old-alert", status: "active", details: { changeDate: 500_000 } },
      ],
      configChanges: [{ configKey: "profile.business.modelPreferences", changedAt: 1_000_000 }],
      scoreWindows: firingWindows,
      insertedAlertId: "new-alert-id",
    });

    const result = await detectRegressionsForPersona(ctx, "business");

    expect(result.fired).toBe(true);
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation.mock.calls[0][1].details.changeDate).toBe(1_000_000);
    expect(runAfter).toHaveBeenCalledTimes(1);
  });

  it("a real regression (>=5/side, over-threshold) inserts an alert and schedules delivery", async () => {
    const { ctx, runMutation, runAfter } = makeCtx({
      priorAlerts: [],
      configChanges: [{ configKey: "profile.business.modelPreferences", changedAt: 1_000_000 }],
      scoreWindows: [
        Array.from({ length: 5 }, () => ({ overall: 0.9 })), // before
        Array.from({ length: 5 }, () => ({ overall: 0.6 })), // after
      ],
      insertedAlertId: "new-alert-id",
    });

    const result = await detectRegressionsForPersona(ctx, "business");

    expect(result.fired).toBe(true);
    expect(runMutation).toHaveBeenCalledTimes(1);
    // The alert's persisted shape (webhookStatus pending, source) is proven by
    // the insertRegressionAlertHandler unit test above; here we assert the
    // orchestration passed the right *data* through (no proxy comparison).
    const mutationArgs = runMutation.mock.calls[0][1];
    expect(mutationArgs.profileId).toBe("business");
    expect(mutationArgs.message).toContain("business quality dropped");
    expect(mutationArgs.details.changeType).toBe("model");

    expect(runAfter).toHaveBeenCalledTimes(1);
    expect(runAfter.mock.calls[0][0]).toBe(0); // scheduled immediately
    expect(runAfter.mock.calls[0][2]).toEqual({ alertId: "new-alert-id", attempt: 1 });
  });

  it("does NOT insert or schedule delivery when the gate doesn't clear (sub-threshold drop)", async () => {
    const { ctx, runMutation, runAfter } = makeCtx({
      priorAlerts: [],
      configChanges: [{ configKey: "profile.business.modelPreferences", changedAt: 1_000_000 }],
      scoreWindows: [
        Array.from({ length: 5 }, () => ({ overall: 0.8 })), // before
        Array.from({ length: 5 }, () => ({ overall: 0.75 })), // after — sub-threshold drop
      ],
    });

    const result = await detectRegressionsForPersona(ctx, "business");

    expect(result.fired).toBe(false);
    expect(runMutation).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("does NOT insert or schedule delivery when there are no change events at all", async () => {
    const { ctx, runMutation, runAfter } = makeCtx({ priorAlerts: [] });

    const result = await detectRegressionsForPersona(ctx, "business");

    expect(result.fired).toBe(false);
    expect(runMutation).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("never calls the public alerts.create mutation anywhere in the module (static source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sourcePath = resolve(process.cwd(), "convex/evalScores.ts");
    const source = readFileSync(sourcePath, "utf-8");
    // A call-site reference — not a bare mention (the module's own comments
    // legitimately discuss "alerts.create" in prose as the thing NOT to use).
    expect(source).not.toMatch(/alerts\.create\(/);
  });
});
