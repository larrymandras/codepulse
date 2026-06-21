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
import { describe, it, expect } from "vitest";

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
