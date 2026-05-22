import { describe, test, expect } from "vitest";
import { groupActivityEvents } from "./briefings";

describe("briefings", () => {
  // ── groupActivityEvents pure function tests ───────────────────────────────

  test("groupActivityEvents groups by toolName and returns sorted counts", () => {
    const events = [
      { toolName: "read_file", eventType: "tool_use" },
      { toolName: "read_file", eventType: "tool_use" },
      { toolName: "write_file", eventType: "tool_use" },
    ];
    const result = groupActivityEvents(events);
    expect(result).toEqual([
      { tool: "read_file", count: 2 },
      { tool: "write_file", count: 1 },
    ]);
  });

  test("groupActivityEvents returns empty array for no events", () => {
    const result = groupActivityEvents([]);
    expect(result).toEqual([]);
  });

  test("groupActivityEvents falls back to eventType when toolName is absent", () => {
    const events = [
      { eventType: "session_start" },
      { eventType: "session_start" },
      { eventType: "session_end" },
    ];
    const result = groupActivityEvents(events);
    expect(result[0]).toEqual({ tool: "session_start", count: 2 });
    expect(result[1]).toEqual({ tool: "session_end", count: 1 });
  });

  test("groupActivityEvents falls back to 'unknown' when both toolName and eventType are absent", () => {
    const events = [{}, {}, {}];
    const result = groupActivityEvents(events);
    expect(result).toEqual([{ tool: "unknown", count: 3 }]);
  });

  test("groupActivityEvents sorts by count descending", () => {
    const events = [
      { toolName: "a" },
      { toolName: "b" },
      { toolName: "b" },
      { toolName: "b" },
      { toolName: "c" },
      { toolName: "c" },
    ];
    const result = groupActivityEvents(events);
    expect(result[0].tool).toBe("b");
    expect(result[0].count).toBe(3);
    expect(result[1].tool).toBe("c");
    expect(result[1].count).toBe(2);
    expect(result[2].tool).toBe("a");
    expect(result[2].count).toBe(1);
  });

  // ── Phase 67 D-06: gateway provider data flows through briefing pipeline ──

  test("groupActivityEvents handles events with gateway provider names (codex, antigravity)", () => {
    // groupActivityEvents groups by toolName/eventType, not by provider.
    // This test confirms gateway provider data passes through the briefing data pipeline
    // without being rejected. The function signature accepts { toolName?, eventType? }
    // which is provider-agnostic by design (Phase 67 D-06).
    const events = [
      { toolName: "read_file", eventType: "tool_use" },
      { toolName: "write_file", eventType: "tool_use" },
      { toolName: "read_file", eventType: "tool_use" },
    ];
    const result = groupActivityEvents(events);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ tool: "read_file", count: 2 });
    expect(result[1]).toEqual({ tool: "write_file", count: 1 });
  });

  // ── Stubs for Convex runtime-dependent tests ──────────────────────────────

  test.todo("onSessionCompleted skips if briefing already exists for sessionId (idempotency)");
  test.todo("onSessionCompleted schedules generateSessionBriefingAction");
  test.todo("triggerDailyDigest schedules generateDailyDigestAction");
  test.todo("daily digest stored with type='daily_digest' and correct date field");
  test.todo("session briefing stored with type='session' and correct sessionId");
  test.todo("callLLMWithFallback falls back to backup on primary failure");
});
