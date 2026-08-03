/**
 * Phase 105 Plan 01 — bounded reads + D-15 exclude-filter unit tests.
 *
 * Uses plain vitest mocks (convex-test is not installed in this repo) — each
 * query handler's post-Task-1 logic is mirrored as a local pure function over
 * an in-memory row array, matching the `sessionCallsLogic` convention in
 * convex/llm.test.ts and convex/runtimeIngest.test.ts. The genuinely-pure
 * exports (`excludeByProvider`, the four cap constants) are imported directly
 * from ./toolExecutions so the constants under test are the real ones.
 */
import { describe, it, expect } from "vitest";
import {
  excludeByProvider,
  SESSION_TOOLS_READ_CAP,
  TOOL_WINDOW_READ_CAP,
  RECENT_SCAN_CAP,
} from "./toolExecutions";

// ---------------------------------------------------------------------------
// Fixture row type + generators
// ---------------------------------------------------------------------------

interface ToolExecRow {
  _id?: string;
  sessionId?: string;
  toolName: string;
  durationMs?: number;
  success: boolean;
  provider?: string;
  timestamp: number;
}

function makeRows(count: number, overrides: Partial<ToolExecRow> = {}): ToolExecRow[] {
  return Array.from({ length: count }, (_, i) => ({
    toolName: "Bash",
    success: true,
    timestamp: i,
    ...overrides,
  }));
}

// ---------------------------------------------------------------------------
// Mirrors of the post-Task-1 query handlers in convex/toolExecutions.ts
// ---------------------------------------------------------------------------

/** Mirrors `listBySession`: read cap rows in descending order, reverse to ascending. */
function listBySessionLogic(sessionRows: ToolExecRow[], cap: number = SESSION_TOOLS_READ_CAP) {
  const descRows = [...sessionRows].sort((a, b) => b.timestamp - a.timestamp).slice(0, cap);
  const truncated = descRows.length >= cap;
  const rows = descRows.slice().reverse();
  return { rows, truncated, cap };
}

/** Mirrors `successRate`: truncated is computed on the RAW read, before excludeByProvider. */
function successRateLogic(
  windowRows: ToolExecRow[],
  excludeProvider: string | undefined,
  cap: number = TOOL_WINDOW_READ_CAP
) {
  const rawRows = windowRows.slice(0, cap);
  const truncated = rawRows.length >= cap;
  const recent = excludeByProvider(rawRows, excludeProvider);

  const byTool: Record<string, { success: number; failure: number }> = {};
  for (const exec of recent) {
    if (!byTool[exec.toolName]) byTool[exec.toolName] = { success: 0, failure: 0 };
    if (exec.success) byTool[exec.toolName].success++;
    else byTool[exec.toolName].failure++;
  }
  const tools = Object.entries(byTool).map(([toolName, counts]) => ({
    toolName,
    ...counts,
    total: counts.success + counts.failure,
    rate: counts.success / (counts.success + counts.failure),
  }));

  return { tools, truncated, cap };
}

/** Mirrors `avgDuration`: same raw-count truncation rule as successRate. */
function avgDurationLogic(
  windowRows: ToolExecRow[],
  excludeProvider: string | undefined,
  cap: number = TOOL_WINDOW_READ_CAP
) {
  const rawRows = windowRows.slice(0, cap);
  const truncated = rawRows.length >= cap;
  const filtered = excludeByProvider(rawRows, excludeProvider);
  const recent = filtered.filter((e) => e.durationMs != null);

  const byTool: Record<string, { total: number; count: number }> = {};
  for (const exec of recent) {
    if (!byTool[exec.toolName]) byTool[exec.toolName] = { total: 0, count: 0 };
    byTool[exec.toolName].total += exec.durationMs!;
    byTool[exec.toolName].count++;
  }
  const tools = Object.entries(byTool).map(([toolName, data]) => ({
    toolName,
    avgDurationMs: data.total / data.count,
    count: data.count,
  }));

  return { tools, truncated, cap };
}

/** Mirrors `recentExecutions`: bounded scan, then excludeByProvider, then slice(0, limit). */
function recentExecutionsLogic(
  allRows: ToolExecRow[],
  excludeProvider: string | undefined,
  limit = 100,
  cap: number = RECENT_SCAN_CAP
) {
  const scanned = [...allRows].sort((a, b) => b.timestamp - a.timestamp).slice(0, cap);
  const filtered = excludeByProvider(scanned, excludeProvider);
  return filtered.slice(0, limit);
}

/** The mechanism F1 explicitly forbids — an INCLUDE-filter on provider === "claude-cli". */
function includeFilterClaudeCliOnly(rows: ToolExecRow[]): ToolExecRow[] {
  return rows.filter((r) => r.provider === "claude-cli");
}

// ---------------------------------------------------------------------------
// insert — traceId/round persistence (Phase 105 D-03/D-10)
// ---------------------------------------------------------------------------

/** Mirrors the `insert` handler: `ctx.db.insert("toolExecutions", args)`. */
function makeToolExecStore() {
  const toolExecutions: Record<string, any>[] = [];
  const db = {
    insert: async (tableName: string, data: Record<string, any>) => {
      if (tableName === "toolExecutions") toolExecutions.push({ ...data });
    },
  };
  return { toolExecutions, db };
}

async function insertLogic(ctx: { db: { insert: Function } }, args: Record<string, any>) {
  await ctx.db.insert("toolExecutions", args);
}

describe("insert — traceId/round persistence (Phase 105 D-03/D-10)", () => {
  it("persists traceId and round when provided", async () => {
    const store = makeToolExecStore();
    await insertLogic(store, {
      sessionId: "sess-1",
      toolName: "web_search",
      success: true,
      timestamp: 1000,
      traceId: "trace-abc",
      round: 2,
    });
    expect(store.toolExecutions[0].traceId).toBe("trace-abc");
    expect(store.toolExecutions[0].round).toBe(2);
  });

  it("traceId and round are undefined when omitted (all 4 legacy callers pass neither)", async () => {
    const store = makeToolExecStore();
    await insertLogic(store, {
      sessionId: "sess-1",
      toolName: "Bash",
      success: true,
      timestamp: 1000,
    });
    expect(store.toolExecutions[0].traceId).toBeUndefined();
    expect(store.toolExecutions[0].round).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// excludeByProvider — pure helper
// ---------------------------------------------------------------------------

describe("excludeByProvider", () => {
  it("returns rows unchanged when excludeProvider is undefined", () => {
    const rows = makeRows(3, { provider: "astridr" });
    expect(excludeByProvider(rows, undefined)).toEqual(rows);
  });

  it('filters out rows whose provider strictly equals excludeProvider ("astridr")', () => {
    const rows: ToolExecRow[] = [
      { toolName: "Bash", success: true, timestamp: 1, provider: "astridr" },
      { toolName: "Edit", success: true, timestamp: 2, provider: "claude-cli" },
    ];
    const result = excludeByProvider(rows, "astridr");
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("claude-cli");
  });

  it("never excludes a row whose provider is undefined (F1 — the whole point of this helper)", () => {
    const rows: ToolExecRow[] = [
      { toolName: "Bash", success: true, timestamp: 1, provider: undefined },
      { toolName: "Edit", success: false, timestamp: 2, provider: "astridr" },
    ];
    const result = excludeByProvider(rows, "astridr");
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// D-15 zero-regression CONTROL (successRate) — two runs, one variable
// ---------------------------------------------------------------------------

describe("successRate — D-15 exclude-filter control", () => {
  function d15Fixture(): ToolExecRow[] {
    return [
      { toolName: "Bash", success: true, timestamp: 1, provider: "claude-cli" },
      { toolName: "Bash", success: false, timestamp: 2, provider: "claude-cli" },
      // Claude Code PostToolUseFailure rows never set provider (F1/F6) — must
      // never be excluded by an exclude-filter.
      { toolName: "Edit", success: false, timestamp: 3, provider: undefined },
      { toolName: "Read", success: true, timestamp: 4, provider: undefined },
      // Gateway pseudo-tool rows carry a real, non-astridr provider.
      { toolName: "gateway.task_started", success: true, timestamp: 5, provider: "codex" },
      // Astridr rows — the only rows an exclude filter should ever remove.
      { toolName: "web_search", success: true, timestamp: 6, provider: "astridr" },
      { toolName: "web_search", success: false, timestamp: 7, provider: "astridr" },
    ];
  }

  it("control: excludeProvider:'astridr' output is deeply equal to the astridr-free baseline", () => {
    const fixture = d15Fixture();

    const excludedRun = successRateLogic(fixture, "astridr");
    const baselineRun = successRateLogic(
      fixture.filter((r) => r.provider !== "astridr"),
      undefined
    );

    expect(excludedRun.tools).toEqual(baselineRun.tools);
  });

  it("negative control: an include-filter on provider==='claude-cli' would drop the provider-less and gateway rows that the exclude-filter correctly keeps", () => {
    const fixture = d15Fixture();

    const excluded = excludeByProvider(fixture, "astridr");
    const included = includeFilterClaudeCliOnly(fixture);

    // The include-filter set is strictly smaller...
    expect(included.length).toBeLessThan(excluded.length);
    // ...specifically because it drops every provider-less row...
    expect(included.some((r) => r.provider === undefined)).toBe(false);
    expect(excluded.some((r) => r.provider === undefined)).toBe(true);
    // ...and every gateway row.
    expect(included.some((r) => r.provider === "codex")).toBe(false);
    expect(excluded.some((r) => r.provider === "codex")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cap / truncation boundaries — exact cap-1 vs cap, real imported constants
// ---------------------------------------------------------------------------

describe("truncation boundaries", () => {
  it("listBySession: cap-1 rows -> truncated=false; cap rows -> truncated=true", () => {
    const belowCap = makeRows(SESSION_TOOLS_READ_CAP - 1);
    const atCap = makeRows(SESSION_TOOLS_READ_CAP);

    expect(listBySessionLogic(belowCap).truncated).toBe(false);
    expect(listBySessionLogic(atCap).truncated).toBe(true);
  });

  it("listBySession keeps the MOST RECENT cap rows (highest timestamps), not the oldest", () => {
    const rows = makeRows(SESSION_TOOLS_READ_CAP + 5);
    const { rows: kept } = listBySessionLogic(rows);
    const timestamps = kept.map((r) => r.timestamp);
    // Ascending order preserved for the caller...
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    // ...but the OLDEST 5 rows (timestamps 0-4) must have been dropped, not
    // the newest 5 — this is the F2/UI-SPEC "most recent" contract.
    expect(Math.min(...timestamps)).toBe(5);
    expect(Math.max(...timestamps)).toBe(SESSION_TOOLS_READ_CAP + 4);
  });

  it("successRate: cap-1 rows -> truncated=false; cap rows -> truncated=true", () => {
    const belowCap = makeRows(TOOL_WINDOW_READ_CAP - 1);
    const atCap = makeRows(TOOL_WINDOW_READ_CAP);

    expect(successRateLogic(belowCap, undefined).truncated).toBe(false);
    expect(successRateLogic(atCap, undefined).truncated).toBe(true);
  });

  it("avgDuration: cap-1 rows -> truncated=false; cap rows -> truncated=true", () => {
    const belowCap = makeRows(TOOL_WINDOW_READ_CAP - 1, { durationMs: 10 });
    const atCap = makeRows(TOOL_WINDOW_READ_CAP, { durationMs: 10 });

    expect(avgDurationLogic(belowCap, undefined).truncated).toBe(false);
    expect(avgDurationLogic(atCap, undefined).truncated).toBe(true);
  });

  it("successRate truncated is computed from the RAW read count, not the post-filter count", () => {
    // A full cap's worth of rows, every single one astridr.
    const allAstridr = makeRows(TOOL_WINDOW_READ_CAP, { provider: "astridr" });

    const result = successRateLogic(allAstridr, "astridr");

    expect(result.truncated).toBe(true);
    expect(result.tools).toEqual([]);
  });

  it("recentExecutions never returns an astridr row and respects the limit", () => {
    const rows = [
      ...makeRows(3, { toolName: "Bash", provider: "claude-cli" }),
      ...makeRows(3, { toolName: "web_search", provider: "astridr" }),
    ].map((r, i) => ({ ...r, timestamp: i }));

    const result = recentExecutionsLogic(rows, "astridr", 10);

    expect(result.every((r) => r.provider !== "astridr")).toBe(true);
    expect(result).toHaveLength(3);
  });
});
