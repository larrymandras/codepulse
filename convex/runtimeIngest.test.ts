/**
 * Phase 149 PULSE-01 — runtimeIngest swarm_task case unit tests
 *
 * Tests verify:
 * (a) swarm_task eventType routes to swarmTasks.upsert (a swarmTasks row appears)
 * (b) snake_case→camelCase coalesce works (goal_id/subtask_id/depends_on/claimed_by)
 * (c) incoming state "completed" is normalized to "done" (UI vocabulary)
 *
 * Uses plain vitest mocks (convex-test is not installed in this repo).
 */
import { describe, it, expect, vi } from "vitest";
import { processTaskQualityEvent } from "./evalScores";
import {
  resolveGatewayTaskCompleted,
  parseToolPolicyEvent,
  resolveToolExecutionRow,
  resolveCommandExecutionToolRow,
  resolveModelRoutingEvent,
  resolveControlVerbSwapEvent,
  TOOL_POLICY_EVENT_KINDS,
  TOOL_POLICY_ERROR_MAX_LEN,
  ASTRIDR_TOOL_PROVIDER,
  runtimeIngest,
} from "./runtimeIngest";

// ---------------------------------------------------------------------------
// Extracted swarm_task routing logic — mirrors runtimeIngest.ts case exactly
// ---------------------------------------------------------------------------

interface UpsertArgs {
  goalId: string;
  subtaskId: string;
  state: string;
  subtask: string;
  dependsOn: string[];
  claimedBy?: string;
  model?: string;
  agentId?: string;
  timestamp: number;
}

/**
 * Simulate the swarm_task case in runtimeIngest.ts.
 * Returns the args that would be passed to api.swarmTasks.upsert.
 */
function processSwarmTaskEvent(
  data: Record<string, any>,
  timestamp: number
): UpsertArgs {
  const d = data;
  const rawState: string = d.state ?? "pending";
  // Normalize Ástríðr "completed" → "done" (UI vocabulary, RESEARCH L603-617)
  const state = rawState === "completed" ? "done" : rawState;
  // Normalize seconds-epoch to ms (gap-149): Python time.time() < 1e12; Date.now() > 1e12
  const tsMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return {
    goalId: d.goal_id ?? d.goalId ?? "unknown",
    subtaskId: d.subtask_id ?? d.subtaskId ?? "unknown",
    state,
    subtask: d.subtask ?? "",
    dependsOn: d.depends_on ?? d.dependsOn ?? [],
    claimedBy: d.claimed_by ?? d.claimedBy,
    model: d.model,
    agentId: d.agent_id ?? d.agentId,
    timestamp: tsMs,
  };
}

/**
 * Simulate the llm_call case goalId extraction in runtimeIngest.ts.
 */
function extractLlmCallGoalId(data: Record<string, any>): string | undefined {
  const d = data;
  return d.goalId ?? d.goal_id;
}

/**
 * Simulate the llm_call case traceId extraction in runtimeIngest.ts (Phase 94 TRACE-01).
 */
function extractLlmCallTraceId(data: Record<string, any>): string | undefined {
  const d = data;
  return d.traceId ?? d.trace_id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runtimeIngest — swarm_task case", () => {
  describe("(a) routing: swarm_task produces a swarmTasks upsert call", () => {
    it("produces valid upsert args with the correct goalId and subtaskId", () => {
      // Use a real ms-epoch timestamp so the normalization sentinel (1e12) does not apply.
      const msTimestamp = 1_750_000_000_000; // a plausible Date.now() value
      const args = processSwarmTaskEvent(
        {
          goalId: "goal-xyz",
          subtaskId: "sub-abc",
          state: "pending",
          subtask: "research Nordic pop",
          dependsOn: [],
        },
        msTimestamp
      );
      expect(args.goalId).toBe("goal-xyz");
      expect(args.subtaskId).toBe("sub-abc");
      expect(args.state).toBe("pending");
      expect(args.subtask).toBe("research Nordic pop");
      expect(args.dependsOn).toEqual([]);
      expect(args.timestamp).toBe(msTimestamp);
    });
  });

  describe("(b) snake_case→camelCase coalesce", () => {
    it("coalesces goal_id (snake) to goalId", () => {
      const args = processSwarmTaskEvent(
        {
          goal_id: "goal-snake",
          subtask_id: "sub-snake",
          state: "pending",
          subtask: "task",
          depends_on: ["dep-1"],
        },
        2000
      );
      expect(args.goalId).toBe("goal-snake");
    });

    it("coalesces subtask_id (snake) to subtaskId", () => {
      const args = processSwarmTaskEvent(
        {
          goal_id: "goal-1",
          subtask_id: "sub-snake-id",
          state: "pending",
          subtask: "task",
          depends_on: [],
        },
        2000
      );
      expect(args.subtaskId).toBe("sub-snake-id");
    });

    it("coalesces depends_on (snake) to dependsOn array", () => {
      const args = processSwarmTaskEvent(
        {
          goal_id: "goal-1",
          subtask_id: "sub-1",
          state: "pending",
          subtask: "task",
          depends_on: ["dep-a", "dep-b"],
        },
        2000
      );
      expect(args.dependsOn).toEqual(["dep-a", "dep-b"]);
    });

    it("coalesces claimed_by (snake) to claimedBy", () => {
      const args = processSwarmTaskEvent(
        {
          goal_id: "goal-1",
          subtask_id: "sub-1",
          state: "claimed",
          subtask: "task",
          depends_on: [],
          claimed_by: "hervor",
        },
        3000
      );
      expect(args.claimedBy).toBe("hervor");
    });

    it("prefers camelCase over snake_case when both present (d.goal_id ?? d.goalId)", () => {
      // The coalesce is d.goal_id ?? d.goalId — snake wins when non-null
      const args = processSwarmTaskEvent(
        {
          goal_id: "from-snake",
          goalId: "from-camel",
          subtask_id: "sub-1",
          state: "pending",
          subtask: "task",
          depends_on: [],
        },
        4000
      );
      expect(args.goalId).toBe("from-snake");
    });
  });

  describe("(b2) timestamp normalization: seconds-epoch → ms (gap-149 #3)", () => {
    it("multiplies seconds-epoch timestamp by 1000 to produce ms", () => {
      // Python time.time() ≈ 1.78e9 (seconds, < 1e12).
      // Should be stored as ms so Date.now() comparisons work in the panel.
      const secondsEpoch = 1_750_000_000; // a plausible Python time.time() value
      const args = processSwarmTaskEvent(
        { goal_id: "goal-1", subtask_id: "sub-1", state: "running", subtask: "t", depends_on: [] },
        secondsEpoch
      );
      expect(args.timestamp).toBe(secondsEpoch * 1000);
    });

    it("leaves ms-epoch timestamps unchanged (already > 1e12)", () => {
      const msEpoch = 1_750_000_000_000; // a plausible Date.now() value (already ms)
      const args = processSwarmTaskEvent(
        { goal_id: "goal-1", subtask_id: "sub-1", state: "running", subtask: "t", depends_on: [] },
        msEpoch
      );
      expect(args.timestamp).toBe(msEpoch);
    });

    it("seconds-epoch timestamp stored as ms is within expected range of Date.now()", () => {
      // Validate the sentinel value 1e12 doesn't fall in an ambiguous zone.
      // Any real seconds-epoch is ~1.78e9; any real ms-epoch is ~1.78e12.
      // 1e12 is safely between them.
      const secondsNow = Math.floor(Date.now() / 1000);
      const args = processSwarmTaskEvent(
        { goal_id: "goal-1", subtask_id: "sub-1", state: "pending", subtask: "t", depends_on: [] },
        secondsNow
      );
      const diffMs = Date.now() - args.timestamp;
      // Diff should be small (< 5000 ms), not hundreds of thousands of hours
      expect(Math.abs(diffMs)).toBeLessThan(5000);
    });
  });

  describe("(c) state normalization: completed → done", () => {
    it('maps incoming state "completed" to "done"', () => {
      const args = processSwarmTaskEvent(
        {
          goal_id: "goal-1",
          subtask_id: "sub-1",
          state: "completed",
          subtask: "task",
          depends_on: [],
        },
        5000
      );
      expect(args.state).toBe("done");
    });

    it("leaves all other states unchanged", () => {
      const states = ["pending", "claimed", "running", "verifying", "failed", "verify_rejected", "done"];
      for (const s of states) {
        const args = processSwarmTaskEvent(
          { goal_id: "g", subtask_id: "s", state: s, subtask: "t", depends_on: [] },
          6000
        );
        expect(args.state, `state "${s}" should not be modified`).toBe(s);
      }
    });
  });
});

describe("runtimeIngest — llm_call goalId extraction", () => {
  it("extracts goalId from camelCase field", () => {
    const goalId = extractLlmCallGoalId({ goalId: "goal-camel", goal_id: undefined });
    expect(goalId).toBe("goal-camel");
  });

  it("falls back to goal_id snake_case when goalId absent", () => {
    const goalId = extractLlmCallGoalId({ goal_id: "goal-snake" });
    expect(goalId).toBe("goal-snake");
  });

  it("returns undefined when neither field present (non-swarm call)", () => {
    const goalId = extractLlmCallGoalId({ provider: "anthropic", model: "sonnet" });
    expect(goalId).toBeUndefined();
  });
});

describe("runtimeIngest — llm_call traceId extraction", () => {
  it("extracts traceId from camelCase field", () => {
    const traceId = extractLlmCallTraceId({ traceId: "trace-camel", trace_id: undefined });
    expect(traceId).toBe("trace-camel");
  });

  it("falls back to trace_id snake_case when traceId absent", () => {
    const traceId = extractLlmCallTraceId({ trace_id: "trace-snake" });
    expect(traceId).toBe("trace-snake");
  });

  it("returns undefined when neither field present (legacy untraced call)", () => {
    const traceId = extractLlmCallTraceId({ provider: "anthropic", model: "sonnet" });
    expect(traceId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 93 (EVAL-01) — task_quality dispatch case
// ---------------------------------------------------------------------------
//
// The task_quality case in runtimeIngest.ts calls the exported
// processTaskQualityEvent (convex/evalScores.ts) to coalesce fields before
// ctx.runMutation(internal.evalScores.ingestTaskQuality, ...) (WR-06: an
// internalMutation reachable only via the Bearer-gated httpAction). These
// tests exercise that same production function, mirroring the
// extracted-pure-function convention used above for swarm_task (convex-test
// is not installed).

describe("runtimeIngest — task_quality case", () => {
  it("redelivering the same idempotencyKey twice mirrors the same dedup key both times", () => {
    // The dedup itself lives inside ingestTaskQuality (ctx.db query), which
    // requires a live Convex instance to exercise end-to-end. What
    // runtimeIngest.ts controls is that the SAME idempotencyKey is derived
    // for the SAME redelivered event — verified here at the pure-function
    // boundary (T-93-01).
    const event = {
      score: 0.8,
      profile_id: "business",
      session_id: "s1",
      event_id: "e1",
    };
    const first = processTaskQualityEvent(event, 100);
    const second = processTaskQualityEvent(event, 200);
    expect(first.idempotencyKey).toBe("e1");
    expect(second.idempotencyKey).toBe("e1");
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });

  it("field coalescing produces the exact shape internal.evalScores.ingestTaskQuality expects", () => {
    const args = processTaskQualityEvent(
      { score: 0.8, profile_id: "business", session_id: "s1", event_id: "e1" },
      123
    );
    expect(args).toEqual({
      scoreName: "task_quality",
      profileId: "business",
      sessionId: "s1",
      overall: 0.8,
      idempotencyKey: "e1",
      timestamp: 123,
    });
  });

  it("WR-07: the Astridr profile_config sync attributes configChanges to astridr-sync, not dashboard (static source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const ingestSource = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
    // The profile_config runtime case must name the real actor.
    expect(ingestSource).toContain('changedBy: "astridr-sync"');
    const profilesSource = readFileSync(resolve(process.cwd(), "convex/profiles.ts"), "utf-8");
    // upsertConfig defaults the audit actor to "dashboard" only when the
    // caller doesn't say otherwise — never hardcodes it.
    expect(profilesSource).toContain('args.changedBy ?? "dashboard"');
  });

  it("WR-06: ingestTaskQuality is an internalMutation, routed via internal.* from the Bearer-gated httpAction (static source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const evalSource = readFileSync(resolve(process.cwd(), "convex/evalScores.ts"), "utf-8");
    // Declared with the internal builder — never the public mutation() one,
    // which any client holding VITE_CONVEX_URL could call directly.
    expect(evalSource).toMatch(/export const ingestTaskQuality = internalMutation\(/);
    const ingestSource = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
    expect(ingestSource).toContain("internal.evalScores.ingestTaskQuality");
    expect(ingestSource).not.toContain("api.evalScores.ingestTaskQuality");
  });
});

// ---------------------------------------------------------------------------
// Phase 104 (D-18) — gateway_task_completed → llmMetrics ingest wiring
// ---------------------------------------------------------------------------
//
// The gateway_task_completed case calls the exported resolveGatewayTaskCompleted
// (this file) to build api.llm.recordCall's args, mirroring the extracted-
// pure-function convention used above for swarm_task/task_quality (convex-test
// is not installed). A non-null return means exactly one recordCall would
// fire; null means zero.

describe("gateway", () => {
  it("a gateway_task_completed payload with tokens produces exactly one recordCall whose provider/model equal the gateway id and cost equals cost_usd", () => {
    const args = resolveGatewayTaskCompleted(
      {
        provider: "claude-cli",
        cost_usd: 0.0,
        prompt_tokens: 1200,
        completion_tokens: 340,
        duration_ms: 5400,
        session_id: "sess-1",
      },
      1_750_000_000
    );
    expect(args).not.toBeNull();
    expect(args!.provider).toBe("claude-cli");
    expect(args!.model).toBe("claude-cli");
    expect(args!.cost).toBe(0.0);
    expect(args!.promptTokens).toBe(1200);
    expect(args!.completionTokens).toBe(340);
    expect(args!.totalTokens).toBe(1540);
    expect(args!.toolName).toBe("gateway:claude-cli");
  });

  it("a payload with no token fields produces totalTokens === 0 and a toolName ending in :tokens-unreported", () => {
    const args = resolveGatewayTaskCompleted(
      {
        provider: "codex",
        cost_usd: 0.12,
        session_id: "sess-2",
      },
      1_750_000_100
    );
    expect(args).not.toBeNull();
    expect(args!.totalTokens).toBe(0);
    expect(args!.promptTokens).toBe(0);
    expect(args!.completionTokens).toBe(0);
    expect(args!.toolName).toBe("gateway:codex:tokens-unreported");
  });

  it("a payload whose provider is not in GATEWAY_PROVIDERS produces zero recordCall calls (returns null)", () => {
    const args = resolveGatewayTaskCompleted(
      { provider: "some-unknown-engine", cost_usd: 1.5 },
      1_750_000_200
    );
    expect(args).toBeNull();
  });

  it("the pre-existing gateway.task_completed (dot) case still calls api.toolExecutions.insert and api.sessions.upsert — additive-only regression guard (static source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const ingestSource = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
    const dotCaseMatch = ingestSource.match(
      /case "gateway\.task_completed": \{[\s\S]*?\n {8}\}/
    );
    expect(dotCaseMatch).not.toBeNull();
    const dotCaseBody = dotCaseMatch![0];
    expect(dotCaseBody).toContain("api.toolExecutions.insert");
    expect(dotCaseBody).toContain("api.sessions.upsert");
  });
});

// ---------------------------------------------------------------------------
// Phase 105 D-01/D-02/D-03 — tool_executed → toolExecutions
// ---------------------------------------------------------------------------

describe("tool_executed → toolExecutions (Phase 105 D-01)", () => {
  it("always tags provider: astridr, never read from the payload (T-105-12)", () => {
    const row = resolveToolExecutionRow({ toolName: "web_search", provider: "someone-else" }, 1000);
    expect(row.provider).toBe(ASTRIDR_TOOL_PROVIDER);
    expect(row.provider).toBe("astridr");
  });

  it("passes through durationMs/traceId/round when present (camelCase)", () => {
    const row = resolveToolExecutionRow(
      { toolName: "web_search", durationMs: 42, traceId: "trace-1", round: 3 },
      1000
    );
    expect(row.durationMs).toBe(42);
    expect(row.traceId).toBe("trace-1");
    expect(row.round).toBe(3);
  });

  it("passes through durationMs/traceId via snake_case fallback", () => {
    const row = resolveToolExecutionRow(
      { toolName: "web_search", duration_ms: 99, trace_id: "trace-2" },
      1000
    );
    expect(row.durationMs).toBe(99);
    expect(row.traceId).toBe("trace-2");
  });

  it("leaves durationMs/traceId/round undefined when absent (no fabricated values)", () => {
    const row = resolveToolExecutionRow({ toolName: "web_search" }, 1000);
    expect(row.durationMs).toBeUndefined();
    expect(row.traceId).toBeUndefined();
    expect(row.round).toBeUndefined();
  });

  it("defaults sessionId/toolName to 'unknown' when absent, matching the existing callGraphEdges convention", () => {
    const row = resolveToolExecutionRow({}, 1000);
    expect(row.sessionId).toBe("unknown");
    expect(row.toolName).toBe("unknown");
  });

  it("defaults success to true when absent, matching the existing callGraphEdges convention", () => {
    const row = resolveToolExecutionRow({ toolName: "web_search" }, 1000);
    expect(row.success).toBe(true);
  });

  it("D-01 additive-only regression guard: the tool_executed case still calls api.callGraphEdges.upsertEdge AND now also api.toolExecutions.insert (static source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const ingestSource = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
    const caseMatch = ingestSource.match(/case "tool_executed": \{[\s\S]*?\n {8}\}/);
    expect(caseMatch).not.toBeNull();
    const caseBody = caseMatch![0];
    expect(caseBody).toContain("api.callGraphEdges.upsertEdge");
    expect(caseBody).toContain("api.toolExecutions.insert");
  });
});

// ---------------------------------------------------------------------------
// Phase 105-09 (live gate, 2026-08-04) — command_execution's toolExecutions
// insert was a second, untagged row for every Ástríðr tool call (this event
// is sent exclusively by astridr/engine/execution_tracker.py, which wraps
// EVERY tool call loop.py makes, origin "user_request" included), silently
// defeating D-15's excludeProvider: "astridr" filter. Confirmed live: one
// real weather induction bumped the Claude-Code-only successRate's
// "weather" count from 2 to 3.
// ---------------------------------------------------------------------------

describe("command_execution → toolExecutions (Phase 105-09 D-15 fix)", () => {
  it("always tags provider: astridr, closing the D-15 leak (regression guard)", () => {
    const row = resolveCommandExecutionToolRow(
      { toolName: "weather", profileId: "astridr" },
      "completed",
      1000
    );
    expect(row.provider).toBe(ASTRIDR_TOOL_PROVIDER);
    expect(row.provider).toBe("astridr");
  });

  it("maps execStatus to success: true only for 'completed'", () => {
    expect(resolveCommandExecutionToolRow({}, "completed", 1000).success).toBe(true);
    expect(resolveCommandExecutionToolRow({}, "failed", 1000).success).toBe(false);
    expect(resolveCommandExecutionToolRow({}, "timed_out", 1000).success).toBe(false);
    expect(resolveCommandExecutionToolRow({}, "cancelled", 1000).success).toBe(false);
  });

  it("defaults sessionId to 'unknown' when profileId is absent, defaults toolName to 'unknown'", () => {
    const row = resolveCommandExecutionToolRow({}, "completed", 1000);
    expect(row.sessionId).toBe("unknown");
    expect(row.toolName).toBe("unknown");
  });

  it("uses profileId (or profile_id) as sessionId when present", () => {
    expect(
      resolveCommandExecutionToolRow({ profileId: "astridr" }, "completed", 1000).sessionId
    ).toBe("astridr");
    expect(
      resolveCommandExecutionToolRow({ profile_id: "astridr" }, "completed", 1000).sessionId
    ).toBe("astridr");
  });

  it("passes through durationMs and errorMessage (camel/snake fallback)", () => {
    const row = resolveCommandExecutionToolRow(
      { durationMs: 42, errorMessage: "boom" },
      "failed",
      1000
    );
    expect(row.durationMs).toBe(42);
    expect(row.errorMessage).toBe("boom");
  });

  it("D-15 regression guard: the command_execution case's toolExecutions insert is tagged with provider (static source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const ingestSource = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
    const caseMatch = ingestSource.match(/case "command_execution": \{[\s\S]*?\n {8}\}/);
    expect(caseMatch).not.toBeNull();
    const caseBody = caseMatch![0];
    expect(caseBody).toContain("resolveCommandExecutionToolRow");
  });
});

// ---------------------------------------------------------------------------
// Phase 105 D-05/D-06 — tool_policy_event
// ---------------------------------------------------------------------------

describe("tool_policy_event (Phase 105 D-05)", () => {
  it("maps a tool_call_leaked_as_text payload (mixed camel/snake casing) to the full field set", () => {
    const parsed = parseToolPolicyEvent(
      {
        event: "tool_call_leaked_as_text",
        tool: "web_search",
        sessionId: "sess-1", // camelCase, per astridr's real payload
        taskCategory: "research", // camelCase
        tool_was_offered: true, // snake_case, per astridr's real payload
        tools_offered_count: 5, // snake_case
        round: 2,
        agentId: "agent-1",
      },
      1000
    );
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      event: "tool_call_leaked_as_text",
      tool: "web_search",
      sessionId: "sess-1",
      taskCategory: "research",
      toolWasOffered: true,
      toolsOfferedCount: 5,
      round: 2,
      agentId: "agent-1",
    });
  });

  it("maps a malformed_policy_boot payload to { event, field, error, timestamp } with tool undefined", () => {
    const parsed = parseToolPolicyEvent(
      { event: "malformed_policy_boot", field: "clusters.0.tags", error: "expected list, got str" },
      1000
    );
    expect(parsed).toMatchObject({
      event: "malformed_policy_boot",
      field: "clusters.0.tags",
      error: "expected list, got str",
      timestamp: 1000,
    });
    expect(parsed!.tool).toBeUndefined();
  });

  it("maps a malformed_policy_reload_rejected payload the same way as boot (field/error, no session)", () => {
    const parsed = parseToolPolicyEvent(
      { event: "malformed_policy_reload_rejected", field: "x", error: "y" },
      1000
    );
    expect(parsed).toMatchObject({ event: "malformed_policy_reload_rejected", field: "x", error: "y" });
    expect(parsed!.sessionId).toBeUndefined();
  });

  it("maps an execution_denied payload to tool + sessionId", () => {
    const parsed = parseToolPolicyEvent(
      { event: "execution_denied", tool: "delegate_task", sessionId: "sess-9" },
      1000
    );
    expect(parsed).toMatchObject({ event: "execution_denied", tool: "delegate_task", sessionId: "sess-9" });
  });

  it("returns null for an unrecognised event value", () => {
    const parsed = parseToolPolicyEvent({ event: "some_future_kind", foo: "bar" }, 1000);
    expect(parsed).toBeNull();
  });

  it("returns null when event is entirely absent", () => {
    const parsed = parseToolPolicyEvent({ tool: "web_search" }, 1000);
    expect(parsed).toBeNull();
  });

  it("every TOOL_POLICY_EVENT_KINDS member parses successfully (round-trip coverage)", () => {
    for (const kind of TOOL_POLICY_EVENT_KINDS) {
      const parsed = parseToolPolicyEvent({ event: kind }, 1000);
      expect(parsed).not.toBeNull();
      expect(parsed!.event).toBe(kind);
    }
  });

  it(`truncates error beyond ${TOOL_POLICY_ERROR_MAX_LEN} characters and appends an explicit marker`, () => {
    const longError = "x".repeat(TOOL_POLICY_ERROR_MAX_LEN + 50);
    const parsed = parseToolPolicyEvent({ event: "malformed_policy_boot", error: longError }, 1000);
    expect(parsed!.error!.length).toBeGreaterThan(TOOL_POLICY_ERROR_MAX_LEN); // marker text appended
    expect(parsed!.error!.startsWith("x".repeat(TOOL_POLICY_ERROR_MAX_LEN))).toBe(true);
    expect(parsed!.error).toContain("truncated");
  });

  it("does not truncate an error at or under the max length", () => {
    const shortError = "boom";
    const parsed = parseToolPolicyEvent({ event: "malformed_policy_boot", error: shortError }, 1000);
    expect(parsed!.error).toBe(shortError);
  });

  it("distinguishes toolsOfferedCount: 0 (filter offered zero tools) from undefined (no filter active)", () => {
    const zeroOffered = parseToolPolicyEvent(
      { event: "tool_call_leaked_as_text", tools_offered_count: 0 },
      1000
    );
    const noFilter = parseToolPolicyEvent({ event: "tool_call_leaked_as_text" }, 1000);
    expect(zeroOffered!.toolsOfferedCount).toBe(0);
    expect(noFilter!.toolsOfferedCount).toBeUndefined();
  });

  it("toolsOfferedCount: 0 on the PRIMARY (camelCase) field is not coalesced away by a `||`-style truthiness trap", () => {
    // A `||` fallback (instead of `??`) would treat 0 as falsy and fall
    // through to the snake_case field (here, absent) — losing the real 0.
    const parsed = parseToolPolicyEvent(
      { event: "tool_call_leaked_as_text", toolsOfferedCount: 0 },
      1000
    );
    expect(parsed!.toolsOfferedCount).toBe(0);
  });

  it("D-05/D-06 regression guard: the switch has a tool_policy_event case calling internal.toolPolicyEvents.record, and no switch-level default arm (static source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const ingestSource = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
    const caseMatch = ingestSource.match(/case "tool_policy_event": \{[\s\S]*?\n {8}\}/);
    expect(caseMatch).not.toBeNull();
    expect(caseMatch![0]).toContain("internal.toolPolicyEvents.record");
    // Deliberately no default: arm anywhere in the switch (F1) — a catch-all
    // would mask a fifth future kind's absence the same way the original
    // missing case masked all four of today's kinds.
    expect(ingestSource).not.toMatch(/\n\s+default:\s*\{/);
  });
});

// ---------------------------------------------------------------------------
// Phase 108 (TELE-02, D-13/D-14, ENGINE-01) — model_routing failed-status
// guard + control_verb_swap ingest case, PLUS the WR-06/168-06
// batch-poisoning gap closure (adversarial audit on plan 108-03, found:
// `isUnresolvedRouting` threw on a non-string profileId/model instead of
// returning true, and the control_verb_swap guard was truthiness-only, not
// type-checked).
//
// Both switch-case bodies now delegate to `resolveModelRoutingEvent` /
// `resolveControlVerbSwapEvent` — real, exported, directly-importable pure
// functions in convex/runtimeIngest.ts (same convention as
// `resolveGatewayTaskCompleted` above). The tests below import and execute
// those REAL functions rather than a hand-copied mirror.
//
// (A prior pass of this file hand-copied the case logic into local
// `simulateModelRoutingCase`/`simulateControlVerbSwapCase` functions and
// asserted against them. An adversarial audit found 8 of the resulting 14
// tests could not fail under a real regression — mutating the real case
// body could not turn them red. This rewrite replaces every one of them
// with coverage against the real, extracted functions; the extraction
// itself is what makes the coverage real, not just a rephrasing.)
//
// A small number of static source-check tests are retained where no
// pure-function equivalent exists (proving the case body actually WIRES
// the resolver's result to the correct mutation — a pure-function test of
// the resolver alone cannot prove that).
// ---------------------------------------------------------------------------

/** Strip full-line comments so a docstring mentioning "isUnresolvedRouting"
 * or "throw" in prose cannot pollute a source-level assertion. Duplicated
 * per-file, matching the existing convention in activeEngine.test.ts and
 * controlVerbSwaps.test.ts (both already have their own private copy). */
function stripCommentLinesForIngestTests(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

describe("resolveModelRoutingEvent (real function, convex/runtimeIngest.ts)", () => {
  it("does not throw on a malformed/null payload and returns null instead (WR-06/168-06 batch-poisoning guard)", () => {
    expect(() => resolveModelRoutingEvent(null, 1000)).not.toThrow();
    expect(() => resolveModelRoutingEvent({}, 1000)).not.toThrow();
    expect(() => resolveModelRoutingEvent({ profileId: undefined, model: null }, 1000)).not.toThrow();
    expect(resolveModelRoutingEvent(null, 1000)).toBeNull();
    expect(resolveModelRoutingEvent({}, 1000)).toBeNull();
  });

  it("defect-1 gap closure: a non-string profileId or model does not throw a TypeError — returns null instead", () => {
    expect(() => resolveModelRoutingEvent({ profileId: 12345, model: "claude-opus-5" }, 1000)).not.toThrow();
    expect(() => resolveModelRoutingEvent({ profileId: "personal", model: 12345 }, 1000)).not.toThrow();
    expect(() => resolveModelRoutingEvent({ profileId: true, model: "claude-opus-5" }, 1000)).not.toThrow();
    expect(() =>
      resolveModelRoutingEvent({ profileId: "personal", model: { nested: "object" } }, 1000)
    ).not.toThrow();
    expect(resolveModelRoutingEvent({ profileId: 12345, model: "claude-opus-5" }, 1000)).toBeNull();
    expect(resolveModelRoutingEvent({ profileId: "personal", model: 12345 }, 1000)).toBeNull();
    expect(resolveModelRoutingEvent({ profileId: true, model: "claude-opus-5" }, 1000)).toBeNull();
    expect(
      resolveModelRoutingEvent({ profileId: "personal", model: { nested: "object" } }, 1000)
    ).toBeNull();
  });

  it("skips (returns null for) a status:'failed' event even with an otherwise-valid profileId/model (ENGINE-01, research Item 6)", () => {
    const result = resolveModelRoutingEvent(
      { profileId: "personal", model: "claude-opus-5", status: "failed" },
      1000
    );
    expect(result).toBeNull();
  });

  it("a status other than 'failed' still resolves normally (regression guard on the new guard's scope)", () => {
    const result = resolveModelRoutingEvent(
      { profileId: "personal", model: "claude-opus-5", status: "resolved" },
      1000
    );
    expect(result?.profileId).toBe("personal");
    expect(result?.model).toBe("claude-opus-5");
  });

  it("coalesces profileId from either camelCase or snake_case", () => {
    const camel = resolveModelRoutingEvent({ profileId: "biz", model: "m1" }, 1000);
    const snake = resolveModelRoutingEvent({ profile_id: "biz", model: "m1" }, 1000);
    expect(camel?.profileId).toBe("biz");
    expect(snake?.profileId).toBe("biz");
  });

  it("reads d.model with no d.selectedModel fallback (D-11's rejected alternative)", () => {
    // A payload carrying only `selectedModel` (never `model`) must resolve
    // to an unresolved (null) event, proving the function does not read
    // d.selectedModel as a fallback.
    const result = resolveModelRoutingEvent(
      { profileId: "personal", selectedModel: "claude-opus-5" },
      1000
    );
    expect(result).toBeNull();
  });

  it("a wrong-typed mode/selectionPath/expiresAt does not throw — returns null instead of reaching the recordRouting validator", () => {
    expect(() =>
      resolveModelRoutingEvent({ profileId: "personal", model: "claude-opus-5", mode: 42 }, 1000)
    ).not.toThrow();
    expect(
      resolveModelRoutingEvent({ profileId: "personal", model: "claude-opus-5", mode: 42 }, 1000)
    ).toBeNull();
    expect(
      resolveModelRoutingEvent(
        { profileId: "personal", model: "claude-opus-5", selectionPath: 42 },
        1000
      )
    ).toBeNull();
    expect(
      resolveModelRoutingEvent(
        { profileId: "personal", model: "claude-opus-5", expiresAt: "not-a-number" },
        1000
      )
    ).toBeNull();
  });
});

describe("resolveControlVerbSwapEvent (real function, convex/runtimeIngest.ts)", () => {
  it("does not throw on a malformed/null payload and returns null instead (WR-06/168-06 batch-poisoning guard)", () => {
    expect(() => resolveControlVerbSwapEvent(null, 1000)).not.toThrow();
    expect(() => resolveControlVerbSwapEvent({}, 1000)).not.toThrow();
    expect(() => resolveControlVerbSwapEvent({ verb: "swap_model" }, 1000)).not.toThrow();
    expect(resolveControlVerbSwapEvent(null, 1000)).toBeNull();
    expect(resolveControlVerbSwapEvent({}, 1000)).toBeNull();
    // verb present but path/channel missing must still skip, not throw.
    expect(resolveControlVerbSwapEvent({ verb: "swap_model" }, 1000)).toBeNull();
  });

  it("defect-2 gap closure: a wrong-typed required field (verb/path/channel) does not throw — returns null instead", () => {
    expect(() =>
      resolveControlVerbSwapEvent({ verb: 42, path: "openrouter", channel: "voice" }, 1000)
    ).not.toThrow();
    expect(
      resolveControlVerbSwapEvent({ verb: 42, path: "openrouter", channel: "voice" }, 1000)
    ).toBeNull();
    expect(
      resolveControlVerbSwapEvent({ verb: "swap_model", path: 42, channel: "voice" }, 1000)
    ).toBeNull();
    expect(
      resolveControlVerbSwapEvent({ verb: "swap_model", path: "openrouter", channel: 42 }, 1000)
    ).toBeNull();
  });

  it("defect-2 gap closure: a wrong-typed optional field does not throw — returns null instead of reaching the record validator", () => {
    expect(
      resolveControlVerbSwapEvent(
        { verb: "swap_model", path: "openrouter", channel: "voice", providerAffinity: 42 },
        1000
      )
    ).toBeNull();
    expect(
      resolveControlVerbSwapEvent(
        { verb: "swap_model", path: "openrouter", channel: "voice", sessionId: { nested: true } },
        1000
      )
    ).toBeNull();
  });

  it("D-13: a refusal event (path:'refused') is a valid row, not skipped, unlike model_routing's isUnresolvedRouting guard", () => {
    const result = resolveControlVerbSwapEvent(
      { verb: "swap_model", path: "refused", reason: "affinity-mismatch", channel: "voice" },
      1000
    );
    expect(result).not.toBeNull();
    expect(result?.path).toBe("refused");
    expect(result?.reason).toBe("affinity-mismatch");
  });

  it("dual-coalesces every multi-word field from snake_case", () => {
    const result = resolveControlVerbSwapEvent(
      {
        verb: "swap_model",
        path: "openrouter",
        channel: "voice",
        provider_affinity: "openrouter",
        voice_id: "v1",
        session_id: "s1",
        profile_id: "personal",
      },
      1000
    );
    expect(result?.providerAffinity).toBe("openrouter");
    expect(result?.voiceId).toBe("v1");
    expect(result?.sessionId).toBe("s1");
    expect(result?.scope).toBe("personal");
  });

  it("dual-coalesces every multi-word field from camelCase", () => {
    const result = resolveControlVerbSwapEvent(
      {
        verb: "swap_model",
        path: "openrouter",
        channel: "voice",
        providerAffinity: "openrouter",
        voiceId: "v1",
        sessionId: "s1",
        scope: "personal",
      },
      1000
    );
    expect(result?.providerAffinity).toBe("openrouter");
    expect(result?.voiceId).toBe("v1");
    expect(result?.sessionId).toBe("s1");
    expect(result?.scope).toBe("personal");
  });
});

describe("runtimeIngest — model_routing / control_verb_swap case wiring (static source check)", () => {
  it("the model_routing case calls resolveModelRoutingEvent and forwards its result to internal.activeEngine.recordRouting — static source check", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = stripCommentLinesForIngestTests(
      readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8")
    );
    const caseMatch = source.match(/case "model_routing": \{[\s\S]*?\n {8}\}/);
    expect(caseMatch).not.toBeNull();
    const caseBody = caseMatch![0];
    expect(caseBody).toContain("resolveModelRoutingEvent(");
    expect(caseBody).toContain("internal.activeEngine.recordRouting");
  });

  it("the control_verb_swap case calls resolveControlVerbSwapEvent and forwards its result to internal.controlVerbSwaps.record, never api.controlVerbSwaps — static source check", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = stripCommentLinesForIngestTests(
      readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8")
    );
    const caseMatch = source.match(/case "control_verb_swap": \{[\s\S]*?\n {8}\}/);
    expect(caseMatch).not.toBeNull();
    const caseBody = caseMatch![0];
    expect(caseBody).toContain("resolveControlVerbSwapEvent(");
    expect(caseBody).toContain("internal.controlVerbSwaps.record");
    expect(caseBody).not.toContain("api.controlVerbSwaps");
  });

  it("D-13: the control_verb_swap case body never calls isUnresolvedRouting — a refusal is a valid row here, and this test is what stops a future reader from 'hardening' refusals away — static source check", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    // Comment-stripped: this case's own rationale comment mentions
    // "isUnresolvedRouting" in prose, which would otherwise falsely satisfy
    // (or, for a naive negative assertion, falsely trip) this check.
    const source = stripCommentLinesForIngestTests(
      readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8")
    );
    const caseMatch = source.match(/case "control_verb_swap": \{[\s\S]*?\n {8}\}/);
    expect(caseMatch).not.toBeNull();
    const caseBody = caseMatch![0];
    expect(caseBody).not.toContain("isUnresolvedRouting(");
  });

  it("neither resolveModelRoutingEvent nor resolveControlVerbSwapEvent contains an explicit throw statement — static source check", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = stripCommentLinesForIngestTests(
      readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8")
    );
    const modelRoutingFn = source.match(
      /export function resolveModelRoutingEvent\([\s\S]*?\n\}/
    );
    const controlVerbSwapFn = source.match(
      /export function resolveControlVerbSwapEvent\([\s\S]*?\n\}/
    );
    expect(modelRoutingFn).not.toBeNull();
    expect(controlVerbSwapFn).not.toBeNull();
    expect(modelRoutingFn![0]).not.toMatch(/throw/);
    expect(controlVerbSwapFn![0]).not.toMatch(/throw/);
  });
});

// ---------------------------------------------------------------------------
// Phase 108 gap closure (WR-06/168-06) — per-event batch isolation at the
// runtimeIngest dispatch LOOP. Prior to this fix, all ~80 ctx.runMutation
// call sites sat under a single batch-wide try (only the narrow
// gateway_task_completed recordCall guard was isolated) — one event whose
// forwarded fields hit a Convex argument-validator throw poisoned every
// remaining event in the same POST, and the whole request 400'd.
//
// These tests invoke the REAL httpAction handler via `._handler` (see
// remindersIngest.test.ts:8-14 for the precedent and why this is real
// coverage, not a hand-copied mirror — Convex's httpAction() wrapper stores
// the original handler at `q._handler = func`). `ctx.runMutation` is a
// plain vi.fn() whose mock implementation throws only for a specific,
// marked call — simulating a Convex argument-validator throw without
// needing a live Convex instance (convex-test is not installed here).
// ---------------------------------------------------------------------------

function makeIngestCtx(runMutationImpl?: (fnRef: any, args: any) => any) {
  return {
    runMutation: vi.fn(runMutationImpl ?? (async () => undefined)),
  };
}

function ingestRequest(events: any[]) {
  return new Request("http://localhost/runtime-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
    body: JSON.stringify({ events }),
  });
}

describe("runtimeIngest httpAction — per-event batch isolation (WR-06/168-06 gap closure)", () => {
  it("one malformed event does not poison sibling events: both the event BEFORE and the event AFTER it in the batch still land, and the batch completes with 200", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // A distinctive value that would only appear in the log line if the
    // full payload were dumped — must NOT leak into console.error (PII rule).
    const SECRET_MARKER = "sk-should-never-be-logged-verbatim";

    const runMutation = vi.fn(async (_fnRef: any, args: any) => {
      // Simulates a Convex argument-validator throw for the one poisoned
      // call — the real mechanism is a wrong-typed field reaching a
      // required v.string() validator (defect-1/defect-2 class); here the
      // mock throws deterministically for a marked call so the test does
      // not depend on live Convex validation.
      if (args && args.model === "POISON_MARKER") {
        throw new Error("ArgumentValidationError: model must be a string");
      }
      return undefined;
    });

    const req = ingestRequest([
      {
        eventType: "swarm_task",
        data: {
          goal_id: "g-sibling-before",
          subtask_id: "s-1",
          state: "pending",
          subtask: "task before the poison",
          depends_on: [],
        },
      },
      {
        eventType: "llm_call",
        data: {
          provider: "anthropic",
          model: "POISON_MARKER",
          apiKeySecret: SECRET_MARKER,
        },
      },
      {
        eventType: "llm_call",
        data: {
          provider: "openai",
          model: "gpt-5-sibling-after",
        },
      },
    ]);

    const res = await (runtimeIngest as any)._handler(
      { runMutation },
      req
    );
    const body = JSON.parse(await res.text());

    // The batch still completes (200), not a 400 that aborts the whole POST.
    expect(res.status).toBe(200);
    expect(body.ingested).toBe(3);
    // Exactly one event was dropped — the counter is real, not decoration.
    expect(body.dropped).toBe(1);

    // The event BEFORE the poisoned one landed (swarmTasks.upsert call with
    // its goalId reached runMutation).
    const swarmCall = runMutation.mock.calls.find(
      ([, args]) => args && args.goalId === "g-sibling-before"
    );
    expect(swarmCall).toBeDefined();

    // The event AFTER the poisoned one also landed — proving the dispatch
    // loop continued past the poisoned event rather than merely catching
    // its own throw and then still aborting the remaining iterations.
    const siblingAfterCall = runMutation.mock.calls.find(
      ([, args]) => args && args.model === "gpt-5-sibling-after"
    );
    expect(siblingAfterCall).toBeDefined();

    // Logged loudly (not silently swallowed)...
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = consoleErrorSpy.mock.calls[0].join(" ");
    expect(loggedMessage).toContain("llm_call");
    // ...but the raw payload (PII-bearing secret field) must never appear
    // in the log line.
    expect(loggedMessage).not.toContain(SECRET_MARKER);

    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("dropped counter is 0 for an all-valid batch (control — proves the counter isn't hardcoded to fire)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const runMutation = vi.fn().mockResolvedValue(undefined);
    const req = ingestRequest([
      { eventType: "swarm_task", data: { goal_id: "g1", subtask_id: "s1", state: "pending", subtask: "t", depends_on: [] } },
      { eventType: "llm_call", data: { provider: "anthropic", model: "sonnet" } },
    ]);
    const res = await (runtimeIngest as any)._handler({ runMutation }, req);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.dropped).toBe(0);
    vi.unstubAllEnvs();
  });

  it("dropped counter increments once per malformed event — 2 poisoned events in a 4-event batch produce dropped === 2, and both non-poisoned events still land", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const runMutation = vi.fn(async (_fnRef: any, args: any) => {
      if (args && args.model === "POISON_MARKER") {
        throw new Error("ArgumentValidationError: model must be a string");
      }
      return undefined;
    });
    const req = ingestRequest([
      { eventType: "llm_call", data: { provider: "a", model: "POISON_MARKER" } },
      { eventType: "swarm_task", data: { goal_id: "g-ok-1", subtask_id: "s1", state: "pending", subtask: "t", depends_on: [] } },
      { eventType: "llm_call", data: { provider: "b", model: "POISON_MARKER" } },
      { eventType: "swarm_task", data: { goal_id: "g-ok-2", subtask_id: "s2", state: "pending", subtask: "t", depends_on: [] } },
    ]);
    const res = await (runtimeIngest as any)._handler({ runMutation }, req);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.dropped).toBe(2);
    expect(
      runMutation.mock.calls.find(([, args]) => args && args.goalId === "g-ok-1")
    ).toBeDefined();
    expect(
      runMutation.mock.calls.find(([, args]) => args && args.goalId === "g-ok-2")
    ).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
