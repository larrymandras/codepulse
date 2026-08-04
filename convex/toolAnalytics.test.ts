import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyToolSource,
  AGG_READ_CAP,
  MAX_WINDOW_HOURS,
  RAW_SCAN_CAP,
  usageOverTime,
  usageByTool,
  recentExecutionsBySource,
} from "./toolAnalytics";
import { ASTRIDR_TOOL_PROVIDER } from "./runtimeIngest";

// ---------------------------------------------------------------------------
// Fake ctx — same minimal db.query(table).withIndex(eq/gte).order().take(n)
// shape convex/aggregates.test.ts's makeAggregatesCtx establishes (no
// convex-test in this repo). Handlers are exercised via `._handler`, the raw
// function Convex's query() wrapper exposes (same convention as
// modelPricing.test.ts / aggregates.test.ts).
// ---------------------------------------------------------------------------

type FakeDoc = Record<string, any>;

function makeCtx(
  opts: { aggregates?: FakeDoc[]; toolExecutions?: FakeDoc[] } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    aggregates: [...(opts.aggregates ?? [])],
    toolExecutions: [...(opts.toolExecutions ?? [])],
  };
  const queryCounts: Record<string, number> = {};

  function query(table: string) {
    queryCounts[table] = (queryCounts[table] ?? 0) + 1;
    const rows = tables[table] ?? (tables[table] = []);
    const predicates: Array<(r: FakeDoc) => boolean> = [];
    let dir: "asc" | "desc" = "asc";

    const chain = {
      withIndex(_index: string, cb?: (q: any) => any) {
        if (cb) {
          const q: any = {};
          for (const op of ["eq", "gte", "gt", "lte", "lt"] as const) {
            q[op] = (field: string, value: unknown) => {
              predicates.push((r) => {
                const v = r[field];
                if (op === "eq") return v === value;
                if (op === "gte") return v >= (value as number);
                if (op === "gt") return v > (value as number);
                if (op === "lte") return v <= (value as number);
                return v < (value as number);
              });
              return q;
            };
          }
          cb(q);
        }
        return chain;
      },
      order(direction: "asc" | "desc") {
        dir = direction;
        return chain;
      },
      async take(n: number) {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered.slice(0, n);
      },
    };
    return chain;
  }

  return {
    db: { query },
    aggregatesQueryCount: () => queryCounts["aggregates"] ?? 0,
  };
}

const HOUR = 3600;
const NOW_SEC = 1_700_000_000;
const CURRENT_HOUR_START = Math.floor(NOW_SEC / HOUR) * HOUR;

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW_SEC * 1000);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function aggRow(
  metric_type: string,
  bucket_start: number,
  value: number,
  dimensions: { tool: string; provider?: string }
): FakeDoc {
  return { metric_type, period: "hourly", bucket_start, value, dimensions };
}

// ---------------------------------------------------------------------------
// classifyToolSource (D-02 / finding F1)
// ---------------------------------------------------------------------------

describe("classifyToolSource", () => {
  test("astridr-provider dimensions classify as astridr", () => {
    expect(classifyToolSource({ toolName: "web_search", provider: "astridr" })).toBe("astridr");
  });

  test("gateway:claude-cli classifies as gateway — the tool-name test wins over the colliding provider value", () => {
    expect(
      classifyToolSource({ toolName: "gateway:claude-cli", provider: "claude-cli" })
    ).toBe("gateway");
  });

  test("a plain Claude Code hook tool with provider claude-cli classifies as claude-code", () => {
    expect(classifyToolSource({ toolName: "Bash", provider: "claude-cli" })).toBe("claude-code");
  });

  test("a provider-less row is never dropped and never mis-sorted into astridr — classifies as claude-code", () => {
    expect(classifyToolSource({ toolName: "Edit", provider: undefined })).toBe("claude-code");
  });

  test("accepts the aggregate dimension key name `tool` as well as the raw-row key name `toolName`", () => {
    expect(classifyToolSource({ tool: "gateway:codex", provider: "codex" })).toBe("gateway");
  });
});

// ---------------------------------------------------------------------------
// usageOverTime
// ---------------------------------------------------------------------------

describe("usageOverTime", () => {
  test("pre-seeds every hour boundary in the window at zero, including hours with no data", async () => {
    const windowStart = CURRENT_HOUR_START - 3 * HOUR;
    const midBucket = windowStart + HOUR;
    const ctx = makeCtx({
      aggregates: [
        aggRow("tool_calls", midBucket, 5, { tool: "web_search", provider: "astridr" }),
        aggRow("tool_failures", midBucket, 1, { tool: "web_search", provider: "astridr" }),
      ],
    });

    const result = await (usageOverTime as any)._handler(ctx, { windowHours: 3 });

    expect(result.buckets).toHaveLength(4); // windowStart..CURRENT_HOUR_START inclusive, step 1h
    const mid = result.buckets.find((b: any) => b.bucketStart === midBucket);
    expect(mid).toEqual({ bucketStart: midBucket, calls: 5, failures: 1 });
    const zeroBuckets = result.buckets.filter((b: any) => b.bucketStart !== midBucket);
    expect(zeroBuckets).toHaveLength(3);
    for (const b of zeroBuckets) {
      expect(b.calls).toBe(0);
      expect(b.failures).toBe(0);
    }
  });

  test("buckets are returned in ascending bucketStart order", async () => {
    const ctx = makeCtx({});
    const result = await (usageOverTime as any)._handler(ctx, { windowHours: 2 });
    const starts = result.buckets.map((b: any) => b.bucketStart);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  test("filters by source unless source is 'all'", async () => {
    const windowStart = CURRENT_HOUR_START - 1 * HOUR;
    const ctx = makeCtx({
      aggregates: [
        aggRow("tool_calls", CURRENT_HOUR_START, 4, { tool: "web_search", provider: "astridr" }),
        aggRow("tool_calls", CURRENT_HOUR_START, 6, { tool: "Bash", provider: "claude-cli" }),
      ],
    });

    const astridrOnly = await (usageOverTime as any)._handler(ctx, {
      windowHours: 1,
      source: "astridr",
    });
    const bucket = astridrOnly.buckets.find((b: any) => b.bucketStart === CURRENT_HOUR_START);
    expect(bucket.calls).toBe(4);

    const all = await (usageOverTime as any)._handler(ctx, { windowHours: 1, source: "all" });
    const allBucket = all.buckets.find((b: any) => b.bucketStart === CURRENT_HOUR_START);
    expect(allBucket.calls).toBe(10);
    void windowStart;
  });

  test("reports truncated when the tool_calls read hits AGG_READ_CAP", async () => {
    const windowStart = CURRENT_HOUR_START - 1 * HOUR;
    const rows: FakeDoc[] = [];
    for (let i = 0; i < AGG_READ_CAP; i++) {
      rows.push(aggRow("tool_calls", windowStart + i, 1, { tool: "web_search", provider: "astridr" }));
    }
    const ctx = makeCtx({ aggregates: rows });

    const result = await (usageOverTime as any)._handler(ctx, { windowHours: 1 });
    expect(result.truncated).toBe(true);
  });

  test("issues exactly one bounded read per metric type (tool_calls, tool_failures)", async () => {
    const ctx = makeCtx({});
    await (usageOverTime as any)._handler(ctx, { windowHours: 1 });
    expect(ctx.aggregatesQueryCount()).toBe(2);
  });

  test("clamps an out-of-range windowHours to MAX_WINDOW_HOURS", async () => {
    const ctx = makeCtx({});
    const result = await (usageOverTime as any)._handler(ctx, { windowHours: 999999 });
    expect(result.windowHours).toBe(MAX_WINDOW_HOURS);
  });
});

// ---------------------------------------------------------------------------
// usageByTool
// ---------------------------------------------------------------------------

describe("usageByTool", () => {
  const B1 = CURRENT_HOUR_START - HOUR;

  function multiSourceCtx() {
    return makeCtx({
      aggregates: [
        aggRow("tool_calls", B1, 10, { tool: "web_search", provider: "astridr" }),
        aggRow("tool_calls", B1, 5, { tool: "Bash", provider: "claude-cli" }),
        aggRow("tool_calls", B1, 3, { tool: "gateway:codex", provider: "codex" }),
        aggRow("tool_failures", B1, 2, { tool: "web_search", provider: "astridr" }),
        aggRow("tool_failures", B1, 0, { tool: "Bash", provider: "claude-cli" }),
        aggRow("tool_duration_ms", B1, 1000, { tool: "web_search", provider: "astridr" }),
        aggRow("tool_duration_samples", B1, 5, { tool: "web_search", provider: "astridr" }),
      ],
    });
  }

  test("source: 'astridr' returns only tools whose dimension classifies as astridr", async () => {
    const ctx = multiSourceCtx();
    const result = await (usageByTool as any)._handler(ctx, { source: ASTRIDR_TOOL_PROVIDER });
    expect(result.rows.map((r: any) => r.toolName)).toEqual(["web_search"]);
  });

  test("source: 'all' returns every tool", async () => {
    const ctx = multiSourceCtx();
    const result = await (usageByTool as any)._handler(ctx, { source: "all" });
    expect(result.rows.map((r: any) => r.toolName).sort()).toEqual(["Bash", "gateway:codex", "web_search"]);
  });

  test("avgDurationMs === null for a tool with no tool_duration_samples bucket (finding F3) — own test", async () => {
    const ctx = makeCtx({
      aggregates: [aggRow("tool_calls", B1, 4, { tool: "Bash", provider: "claude-cli" })],
    });
    const result = await (usageByTool as any)._handler(ctx, { source: "all" });
    const row = result.rows.find((r: any) => r.toolName === "Bash");
    expect(row.avgDurationMs).toBeNull();
    expect(row.avgDurationMs).not.toBe(0);
    expect(Number.isNaN(row.avgDurationMs)).toBe(false);
  });

  test("computes a real average when duration buckets are present", async () => {
    const ctx = multiSourceCtx();
    const result = await (usageByTool as any)._handler(ctx, { source: "all" });
    const row = result.rows.find((r: any) => r.toolName === "web_search");
    expect(row.avgDurationMs).toBe(200); // 1000ms / 5 samples
  });

  test("failures: 0 with an explicit zero-value tool_failures bucket reports successRate: 1", async () => {
    const ctx = multiSourceCtx();
    const result = await (usageByTool as any)._handler(ctx, { source: "all" });
    const row = result.rows.find((r: any) => r.toolName === "Bash");
    expect(row.failures).toBe(0);
    expect(row.successRate).toBe(1);
  });

  test("a tool with 0 calls is never surfaced with a fabricated successRate of 1 — totals.successRate is null when there are zero calls", async () => {
    const ctx = makeCtx({});
    const result = await (usageByTool as any)._handler(ctx, { source: "all" });
    expect(result.rows).toHaveLength(0);
    expect(result.totals.successRate).toBeNull();
  });

  test("sources lists every source class with data in the window, ignoring the active filter", async () => {
    const ctx = multiSourceCtx();
    const result = await (usageByTool as any)._handler(ctx, { source: ASTRIDR_TOOL_PROVIDER });
    expect(result.sources.sort()).toEqual(["astridr", "claude-code", "gateway"]);
  });

  test("sorts by calls descending and slices to limit", async () => {
    const ctx = multiSourceCtx();
    const result = await (usageByTool as any)._handler(ctx, { source: "all", limit: 2 });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].toolName).toBe("web_search"); // 10 calls
    expect(result.rows[1].toolName).toBe("Bash"); // 5 calls
  });

  test("reports truncated when the tool_calls read hits AGG_READ_CAP", async () => {
    const rows: FakeDoc[] = [];
    for (let i = 0; i < AGG_READ_CAP; i++) {
      rows.push(aggRow("tool_calls", B1 + i, 1, { tool: `tool-${i}`, provider: "astridr" }));
    }
    const ctx = makeCtx({ aggregates: rows });
    const result = await (usageByTool as any)._handler(ctx, { source: "all" });
    expect(result.truncated).toBe(true);
  });

  test("issues exactly one bounded read per metric type (all four tool_* types)", async () => {
    const ctx = multiSourceCtx();
    await (usageByTool as any)._handler(ctx, { source: "all" });
    expect(ctx.aggregatesQueryCount()).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// recentExecutionsBySource
// ---------------------------------------------------------------------------

describe("recentExecutionsBySource", () => {
  function execRow(overrides: Partial<FakeDoc> = {}): FakeDoc {
    return {
      _id: `e${Math.random()}`,
      sessionId: "s1",
      toolName: "web_search",
      success: true,
      timestamp: NOW_SEC,
      ...overrides,
    };
  }

  test("astridr source reads via the provider index and returns only astridr-provider rows", async () => {
    const ctx = makeCtx({
      toolExecutions: [
        execRow({ toolName: "web_search", provider: "astridr", timestamp: NOW_SEC - 10 }),
        execRow({ toolName: "Bash", provider: "claude-cli", timestamp: NOW_SEC - 5 }),
      ],
    });
    const result = await (recentExecutionsBySource as any)._handler(ctx, { source: "astridr" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].toolName).toBe("web_search");
  });

  test("default source (no arg) is astridr, matching D-02's default", async () => {
    const ctx = makeCtx({
      toolExecutions: [execRow({ toolName: "web_search", provider: "astridr" })],
    });
    const result = await (recentExecutionsBySource as any)._handler(ctx, {});
    expect(result.rows).toHaveLength(1);
  });

  test("a non-astridr source classifies in JS from a bounded by_timestamp scan", async () => {
    const ctx = makeCtx({
      toolExecutions: [
        execRow({ toolName: "Bash", provider: "claude-cli", timestamp: NOW_SEC - 1 }),
        execRow({ toolName: "web_search", provider: "astridr", timestamp: NOW_SEC - 2 }),
        execRow({ toolName: "gateway:codex", provider: "codex", timestamp: NOW_SEC - 3 }),
      ],
    });
    const result = await (recentExecutionsBySource as any)._handler(ctx, { source: "claude-code" });
    expect(result.rows.map((r: any) => r.toolName)).toEqual(["Bash"]);
  });

  test("source: 'all' returns every classified row regardless of source", async () => {
    const ctx = makeCtx({
      toolExecutions: [
        execRow({ toolName: "Bash", provider: "claude-cli", timestamp: NOW_SEC - 1 }),
        execRow({ toolName: "web_search", provider: "astridr", timestamp: NOW_SEC - 2 }),
      ],
    });
    const result = await (recentExecutionsBySource as any)._handler(ctx, { source: "all" });
    expect(result.rows).toHaveLength(2);
  });

  test("a sparse non-astridr class may legitimately return fewer rows than limit — bounded by construction, not a defect", async () => {
    const ctx = makeCtx({
      toolExecutions: [execRow({ toolName: "web_search", provider: "astridr" })],
    });
    const result = await (recentExecutionsBySource as any)._handler(ctx, {
      source: "gateway",
      limit: 50,
    });
    expect(result.rows).toHaveLength(0);
    expect(result.truncated).toBe(false);
  });

  test("clamps limit to RAW_SCAN_CAP", async () => {
    const rows: FakeDoc[] = [];
    for (let i = 0; i < RAW_SCAN_CAP + 10; i++) {
      rows.push(execRow({ toolName: "web_search", provider: "astridr", timestamp: NOW_SEC - i }));
    }
    const ctx = makeCtx({ toolExecutions: rows });
    const result = await (recentExecutionsBySource as any)._handler(ctx, {
      source: "astridr",
      limit: 999999,
    });
    expect(result.rows.length).toBeLessThanOrEqual(RAW_SCAN_CAP);
  });
});
