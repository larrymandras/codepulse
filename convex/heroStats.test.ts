/**
 * heroStats:summary runs on EVERY page (useHeroStats, throttled to 1s), and its
 * error is unhandled — so a failure here doesn't degrade one widget, it unmounts
 * the React tree and blanks the whole page.
 *
 * That happened live on 2026-07-20 after CodePulse was repointed from the frozen
 * cloud deployment to the self-hosted backend: the events read was an UNBOUNDED
 * `.order("desc").take(500)`, which blows Convex's system-operation limit on a
 * large table ("Your request timed out performing too many system operations").
 * Measured on the real backend: unbounded take(500) failed, take(50) passed, and
 * the range-bounded form returned the same rows cheaply.
 *
 * These tests lock the bound in.
 */
import { describe, it, expect } from "vitest";
import { summary } from "./heroStats";

interface IndexUse {
  table: string;
  index: string;
  /** Range bounds the handler asked for, e.g. [["gte","timestamp",1234]]. */
  bounds: Array<[string, string, unknown]>;
  limit: number | null;
}

/** Fake ctx.db that records HOW each table was queried, not just what came back. */
function makeRecordingDb(rowsByTable: Record<string, unknown[]> = {}) {
  const uses: IndexUse[] = [];
  return {
    uses,
    query(table: string) {
      const rows = rowsByTable[table] ?? [];
      const use: IndexUse = { table, index: "", bounds: [], limit: null };
      const chain = {
        withIndex(index: string, cb?: (q: unknown) => unknown) {
          use.index = index;
          if (cb) {
            const q: Record<string, (f: string, v: unknown) => unknown> = {};
            for (const op of ["eq", "gte", "gt", "lte", "lt"]) {
              q[op] = (field: string, value: unknown) => {
                use.bounds.push([op, field, value]);
                return q;
              };
            }
            cb(q);
          }
          return chain;
        },
        order() {
          return chain;
        },
        async take(n: number) {
          use.limit = n;
          uses.push(use);
          return rows.slice(0, n);
        },
        async collect() {
          uses.push(use);
          return rows;
        },
      };
      return chain;
    },
  };
}

async function runSummary(rowsByTable: Record<string, unknown[]> = {}) {
  const db = makeRecordingDb(rowsByTable);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (summary as any)._handler({ db }, {});
  return { db, result };
}

describe("heroStats:summary — query cost guards", () => {
  it("bounds the events index scan to the last hour instead of scanning from the end", async () => {
    const { db } = await runSummary();

    const eventsUse = db.uses.find((u) => u.table === "events");
    expect(eventsUse).toBeDefined();
    expect(eventsUse!.index).toBe("by_timestamp2");

    // The regression: no bounds at all == unbounded end-scan == page-blanking timeout.
    expect(eventsUse!.bounds.length).toBeGreaterThan(0);

    const lower = eventsUse!.bounds.find(([op]) => op === "gte" || op === "gt");
    expect(lower).toBeDefined();
    expect(lower![1]).toBe("timestamp");

    // And the bound must actually be ~1h ago, not some far-past value that
    // would make the range meaningless.
    const nowSec = Date.now() / 1000;
    const bound = lower![2] as number;
    expect(nowSec - bound).toBeGreaterThan(3500);
    expect(nowSec - bound).toBeLessThan(3700);
  });

  it("keeps every read bounded — no unlimited take on a high-volume table", async () => {
    const { db } = await runSummary();
    for (const t of ["events", "llmMetrics", "securityEvents"]) {
      const use = db.uses.find((u) => u.table === t);
      expect(use, `${t} should be read`).toBeDefined();
      expect(use!.limit, `${t} must use a bounded take()`).toBeGreaterThan(0);
    }
  });

  it("caps the discoveredTools count instead of collecting the whole table", async () => {
    // Unfiltered, so no index can help — a cap is the only thing standing
    // between a growing table and the same timeout that blanked every page.
    const { db } = await runSummary();
    const toolsUse = db.uses.find((u) => u.table === "discoveredTools");
    expect(toolsUse).toBeDefined();
    expect(toolsUse!.limit, "discoveredTools must use a bounded take()").toBeGreaterThan(0);
  });

  it("reports the tools count exactly while under the cap", async () => {
    const { result } = await runSummary({
      discoveredTools: Array.from({ length: 361 }, (_, i) => ({ name: `tool-${i}` })),
    });
    expect(result.knownTools).toBe(361);
  });

  it("still computes the hourly rollup correctly from the rows it reads", async () => {
    const now = Date.now() / 1000;
    const { result } = await runSummary({
      events: [
        { timestamp: now - 60, eventType: "tool_call" },
        { timestamp: now - 120, eventType: "error" },
        { timestamp: now - 180, eventType: "tool_error" },
        { timestamp: now - 240, eventType: "tool_call" },
      ],
      llmMetrics: [{ timestamp: now - 60, cost: 0.25, totalTokens: 1000 }],
    });

    expect(result.eventsThisHour).toBe(4);
    expect(result.errorsThisHour).toBe(2);
    expect(result.errorRate).toBe(50);
    expect(result.hourlyCost).toBeCloseTo(0.25, 6);
    expect(result.hourlyTokens).toBe(1000);
    expect(result.eventSparkline).toHaveLength(12);
  });
});
