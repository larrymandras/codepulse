/**
 * Phase 105 Plan 03 — toolPolicyEvents module unit tests.
 *
 * Uses plain vitest mocks + in-memory-store mirror functions (convex-test is
 * not installed), matching the convention in convex/toolExecutions.test.ts
 * and convex/llm.test.ts. `POLICY_FEED_READ_CAP` is imported directly from
 * ./toolPolicyEvents so the cap under test is the real one.
 */
import { describe, it, expect } from "vitest";
import { POLICY_FEED_READ_CAP } from "./toolPolicyEvents";

// ---------------------------------------------------------------------------
// Fixture row type + generators
// ---------------------------------------------------------------------------

interface PolicyEventRow {
  _id?: string;
  event: string;
  tool?: string;
  sessionId?: string;
  agentId?: string;
  taskCategory?: string;
  toolWasOffered?: boolean;
  toolsOfferedCount?: number;
  round?: number;
  field?: string;
  error?: string;
  timestamp: number;
}

function makeRows(count: number, overrides: Partial<PolicyEventRow> = {}): PolicyEventRow[] {
  return Array.from({ length: count }, (_, i) => ({
    event: "execution_denied",
    timestamp: i,
    ...overrides,
  }));
}

// ---------------------------------------------------------------------------
// In-memory store + mirrors of the toolPolicyEvents.ts handlers
// ---------------------------------------------------------------------------

function makeStore() {
  const toolPolicyEvents: PolicyEventRow[] = [];
  const db = {
    insert: async (tableName: string, data: Record<string, any>) => {
      if (tableName === "toolPolicyEvents") toolPolicyEvents.push({ ...data } as PolicyEventRow);
    },
  };
  return { toolPolicyEvents, db };
}

/** Mirrors `record`: a single unconditional insert. */
async function recordLogic(ctx: { db: { insert: Function } }, args: Record<string, any>) {
  await ctx.db.insert("toolPolicyEvents", args);
}

/** Mirrors `recent`: optional event filter, order desc, take(limit), report truncated/cap. */
function recentLogic(
  rows: PolicyEventRow[],
  args: { limit?: number; event?: string },
  cap: number = POLICY_FEED_READ_CAP
) {
  const limit = Math.min(args.limit ?? 100, cap);
  const filtered = args.event ? rows.filter((r) => r.event === args.event) : rows;
  const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  return { rows: sorted, truncated: sorted.length >= limit, cap };
}

/** Mirrors `lastReceivedAt`: newest row's timestamp, or null when the table is empty. */
function lastReceivedAtLogic(rows: PolicyEventRow[]) {
  const sorted = [...rows].sort((a, b) => b.timestamp - a.timestamp);
  return { timestamp: sorted[0]?.timestamp ?? null };
}

const TOOL_POLICY_EVENT_KINDS = [
  "malformed_policy_boot",
  "malformed_policy_reload_rejected",
  "execution_denied",
  "tool_call_leaked_as_text",
] as const;

/** Mirrors `countsByKind`: windowed tally, every kind zero-filled. */
function countsByKindLogic(
  rows: PolicyEventRow[],
  sinceSeconds: number = 7 * 86400,
  nowSeconds: number = Date.now() / 1000,
  cap: number = POLICY_FEED_READ_CAP * 5
) {
  const cutoff = nowSeconds - sinceSeconds;
  const rawRows = rows.filter((r) => r.timestamp >= cutoff).slice(0, cap);
  const truncated = rawRows.length >= cap;
  const counts: Record<string, number> = {};
  for (const kind of TOOL_POLICY_EVENT_KINDS) counts[kind] = 0;
  for (const row of rawRows) counts[row.event] = (counts[row.event] ?? 0) + 1;
  return { counts, truncated, windowSeconds: sinceSeconds };
}

// ---------------------------------------------------------------------------
// record — internalMutation, single unconditional insert
// ---------------------------------------------------------------------------

describe("record", () => {
  it("inserts a row with all provided fields", async () => {
    const store = makeStore();
    await recordLogic(store, {
      event: "tool_call_leaked_as_text",
      tool: "web_search",
      sessionId: "sess-1",
      agentId: "agent-1",
      taskCategory: "research",
      toolWasOffered: true,
      toolsOfferedCount: 5,
      round: 2,
      timestamp: 1000,
    });
    expect(store.toolPolicyEvents).toHaveLength(1);
    expect(store.toolPolicyEvents[0]).toMatchObject({
      event: "tool_call_leaked_as_text",
      tool: "web_search",
      toolWasOffered: true,
      toolsOfferedCount: 5,
      round: 2,
    });
  });

  it("inserts a boot/reload row with no session (field/error only)", async () => {
    const store = makeStore();
    await recordLogic(store, {
      event: "malformed_policy_boot",
      field: "clusters.0.tags",
      error: "expected list, got str",
      timestamp: 1000,
    });
    expect(store.toolPolicyEvents[0].tool).toBeUndefined();
    expect(store.toolPolicyEvents[0].sessionId).toBeUndefined();
    expect(store.toolPolicyEvents[0].field).toBe("clusters.0.tags");
  });
});

// ---------------------------------------------------------------------------
// recent — bounded, event-filtered, newest-first
// ---------------------------------------------------------------------------

describe("recent", () => {
  it("returns [] for an empty table, never a synthesized placeholder row", () => {
    const result = recentLogic([], {});
    expect(result.rows).toEqual([]);
  });

  it("returns rows newest-first", () => {
    const rows = [
      { event: "execution_denied", timestamp: 1 },
      { event: "execution_denied", timestamp: 3 },
      { event: "execution_denied", timestamp: 2 },
    ];
    const result = recentLogic(rows, {});
    expect(result.rows.map((r) => r.timestamp)).toEqual([3, 2, 1]);
  });

  it("filters to a single event kind when event is supplied", () => {
    const rows = [
      { event: "execution_denied", timestamp: 1 },
      { event: "tool_call_leaked_as_text", timestamp: 2 },
      { event: "execution_denied", timestamp: 3 },
    ];
    const result = recentLogic(rows, { event: "execution_denied" });
    expect(result.rows.every((r) => r.event === "execution_denied")).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it("bounds the read at the exported cap even when a larger limit is requested", () => {
    const rows = makeRows(POLICY_FEED_READ_CAP + 10);
    const result = recentLogic(rows, { limit: POLICY_FEED_READ_CAP + 10 });
    expect(result.rows.length).toBeLessThanOrEqual(POLICY_FEED_READ_CAP);
    expect(result.truncated).toBe(true);
  });

  it("truncated is false when the row count is below the requested limit", () => {
    const rows = makeRows(5);
    const result = recentLogic(rows, { limit: 100 });
    expect(result.truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lastReceivedAt — D-07 honesty: null means "never", not 0 or Date.now()
// ---------------------------------------------------------------------------

describe("lastReceivedAt", () => {
  it("returns timestamp: null for an empty table (never 0, never Date.now())", () => {
    const result = lastReceivedAtLogic([]);
    expect(result.timestamp).toBeNull();
  });

  it("returns the newest row's timestamp when the table is non-empty", () => {
    const rows = [
      { event: "execution_denied", timestamp: 100 },
      { event: "execution_denied", timestamp: 300 },
      { event: "execution_denied", timestamp: 200 },
    ];
    const result = lastReceivedAtLogic(rows);
    expect(result.timestamp).toBe(300);
  });

  it("a timestamp of exactly 0 is still returned as 0, not coalesced to null", () => {
    const rows = [{ event: "execution_denied", timestamp: 0 }];
    const result = lastReceivedAtLogic(rows);
    expect(result.timestamp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countsByKind — every kind zero-filled, windowed
// ---------------------------------------------------------------------------

describe("countsByKind", () => {
  it("zero-fills all 4 kinds when the table is empty", () => {
    const result = countsByKindLogic([]);
    expect(result.counts).toEqual({
      malformed_policy_boot: 0,
      malformed_policy_reload_rejected: 0,
      execution_denied: 0,
      tool_call_leaked_as_text: 0,
    });
  });

  it("tallies rows within the window per kind", () => {
    const now = 1_000_000;
    const rows = [
      { event: "execution_denied", timestamp: now - 10 },
      { event: "execution_denied", timestamp: now - 20 },
      { event: "tool_call_leaked_as_text", timestamp: now - 5 },
    ];
    const result = countsByKindLogic(rows, 86400, now);
    expect(result.counts.execution_denied).toBe(2);
    expect(result.counts.tool_call_leaked_as_text).toBe(1);
    expect(result.counts.malformed_policy_boot).toBe(0);
  });

  it("excludes rows outside the window", () => {
    const now = 1_000_000;
    const rows = [{ event: "execution_denied", timestamp: now - 100000 }];
    const result = countsByKindLogic(rows, 86400, now);
    expect(result.counts.execution_denied).toBe(0);
  });
});
