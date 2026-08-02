import { describe, test, expect } from "vitest";
import {
  deriveBucketDollars,
  costOverTime,
  costBreakdown,
  unpricedModels,
  computePeriodSpend,
} from "./costDerived";
import { buildRateIndex, type PricingRow } from "./modelPricing";

// ---------------------------------------------------------------------------
// Fake ctx — same convention as convex/aggregates.test.ts / modelPricing.test.ts
// (this repo has no convex-test): exercises the real query handlers via the
// exported function's `._handler` escape hatch against a hand-rolled fake
// ctx.db (query/withIndex(eq/gte/gt/lte/lt)/filter/collect/first/insert).
// Every withIndex predicate call is additionally logged to `queryLog` so
// tests (Task 2) can assert on which index-range reads a query DID or DID
// NOT issue (e.g. "no daily-period read for a daily budget").
// ---------------------------------------------------------------------------

type FakeDoc = Record<string, any>;
type PredicateLog = { op: string; field: string; value: unknown };
type QueryLogEntry = { table: string; predicates: PredicateLog[] };

function makeCostDerivedCtx(
  opts: { aggregates?: FakeDoc[]; modelPricing?: FakeDoc[] } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    aggregates: [...(opts.aggregates ?? [])],
    modelPricing: [...(opts.modelPricing ?? [])],
  };
  let nextId = 1;
  const insertCalls: unknown[] = [];
  const patchCalls: unknown[] = [];
  const deleteCalls: unknown[] = [];
  const queryLog: QueryLogEntry[] = [];

  function query(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const predicates: Array<(r: FakeDoc) => boolean> = [];
    const logEntry: QueryLogEntry = { table, predicates: [] };
    queryLog.push(logEntry);

    const chain = {
      withIndex(_index: string, cb?: (q: any) => any) {
        if (cb) {
          const q: any = {};
          for (const op of ["eq", "gte", "gt", "lte", "lt"] as const) {
            q[op] = (field: string, value: unknown) => {
              logEntry.predicates.push({ op, field, value });
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
      filter(cb: (q: any) => any) {
        const q = {
          field: (name: string) => ({ __field: name }),
          neq: (ref: { __field: string }, value: unknown) => {
            predicates.push((r) => r[ref.__field] !== value);
            return true;
          },
        };
        cb(q);
        return chain;
      },
      async collect() {
        return rows.filter((r) => predicates.every((p) => p(r)));
      },
      async first() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        return filtered[0] ?? null;
      },
    };
    return chain;
  }

  const db = {
    query,
    async insert(table: string, doc: FakeDoc) {
      insertCalls.push({ table, doc });
      const row = { ...doc, _id: `${table}_${nextId}`, _creationTime: nextId };
      nextId++;
      (tables[table] ?? (tables[table] = [])).push(row);
      return row._id;
    },
    async patch(...args: unknown[]) {
      patchCalls.push(args);
    },
    async delete(...args: unknown[]) {
      deleteCalls.push(args);
    },
  };

  return { ctx: { db }, tables, insertCalls, patchCalls, deleteCalls, queryLog };
}

function makeRate(overrides: Partial<PricingRow> & { model: string }): PricingRow {
  return {
    _id: `modelPricing_${overrides.model}` as any,
    inputPerToken: 0.000003,
    outputPerToken: 0.000015,
    source: "manual",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as PricingRow;
}

/** A bucket_start comfortably inside any reasonable lookbackHours window, deterministic per test run. */
function recentBucketStart(offsetSeconds = 300): number {
  return Math.floor(Date.now() / 1000) - offsetSeconds;
}

describe("deriveBucketDollars", () => {
  test("api bucket with a matching rate yields billedUsd = tokens x rate, coveredUsd null", () => {
    const index = buildRateIndex([makeRate({ model: "gpt-4o", inputPerToken: 0.0000025, outputPerToken: 0.00001 })]);
    const row = deriveBucketDollars(
      { provider: "openrouter", model: "gpt-4o", billingType: "api" },
      1000,
      500,
      index
    );
    expect(row.billedUsd).toBeCloseTo(1000 * 0.0000025 + 500 * 0.00001, 10);
    expect(row.coveredUsd).toBeNull();
    expect(row.priced).toBe(true);
    expect(row.pricedVia).toBe("model");
  });

  test("subscription bucket with a shadow row yields billedUsd === 0 and a positive coveredUsd", () => {
    const index = buildRateIndex([
      makeRate({
        model: "codex",
        shadowForProvider: "codex",
        inputPerToken: 0.000005,
        outputPerToken: 0.000025,
      }),
    ]);
    // dims.model deliberately does NOT match the shadow row's own model id, so
    // resolution can only succeed via the shadow-provider fallback branch.
    const row = deriveBucketDollars(
      { provider: "codex", model: "codex-cli-turn", billingType: "subscription" },
      2000,
      1000,
      index
    );
    expect(row.billedUsd).toBe(0);
    expect(row.coveredUsd).toBeCloseTo(2000 * 0.000005 + 1000 * 0.000025, 10);
    expect(row.coveredUsd).toBeGreaterThan(0);
    expect(row.priced).toBe(true);
    expect(row.pricedVia).toBe("shadow");
  });

  test("a model with no rate and no shadow row yields priced:false with BOTH dollar fields strictly null", () => {
    const index = buildRateIndex([]);
    const row = deriveBucketDollars(
      { provider: "unknown-provider", model: "unknown-model", billingType: "api" },
      500,
      500,
      index
    );
    expect(row.priced).toBe(false);
    expect(row.pricedVia).toBeNull();
    expect(row.billedUsd).toBeNull();
    expect(row.coveredUsd).toBeNull();
  });

  test("a subscription bucket with zero prompt+completion tokens is unpriced even when a shadow rate exists (D-18/D-03)", () => {
    const index = buildRateIndex([
      makeRate({ model: "claude-cli", shadowForProvider: "claude-cli", inputPerToken: 0.000005, outputPerToken: 0.000025 }),
    ]);
    const row = deriveBucketDollars(
      { provider: "claude-cli", model: "claude-cli-turn", billingType: "subscription" },
      0,
      0,
      index
    );
    expect(row.priced).toBe(false);
    expect(row.billedUsd).toBeNull();
    expect(row.coveredUsd).toBeNull();
  });
});

describe("costBreakdown", () => {
  test("billedTotal excludes every unpriced row's tokens entirely", async () => {
    const bucketStart = recentBucketStart();
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 1000, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 500, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 300, dimensions: { provider: "openrouter", model: "unrated-model", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 100, dimensions: { provider: "openrouter", model: "unrated-model", billingType: "api", goalId: "" } },
      ],
      modelPricing: [makeRate({ model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015 })],
    });

    const result = await (costBreakdown as any)._handler(ctx, { period: "hourly", lookbackHours: 24 });

    expect(result.billedTotal).toBeCloseTo(1000 * 0.000003 + 500 * 0.000015, 10);
    expect(result.unpricedModelCount).toBe(1);
    expect(result.unpricedTokenTotal).toBe(400);
    // No field on this shape sums billedUsd and coveredUsd together.
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["rows", "billedTotal", "coveredTotal", "unpricedModelCount", "unpricedTokenTotal"])
    );
  });

  test("re-price: adding a modelPricing row changes billedTotal on the next read with ZERO writes to any table", async () => {
    const bucketStart = recentBucketStart();
    const { ctx, tables, insertCalls, patchCalls, deleteCalls } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 1000, dimensions: { provider: "anthropic_direct", model: "new-model", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 500, dimensions: { provider: "anthropic_direct", model: "new-model", billingType: "api", goalId: "" } },
      ],
      modelPricing: [], // no rate yet
    });

    const result1 = await (costBreakdown as any)._handler(ctx, { period: "hourly", lookbackHours: 24 });
    expect(result1.billedTotal).toBe(0);
    expect(result1.unpricedModelCount).toBeGreaterThan(0);

    // Add a rate row directly to the fixture table — the SAME aggregate
    // buckets are untouched. Bypasses ctx.db.insert on purpose so this test
    // isolates "did the QUERY write anything", not "did the test fixture
    // change" (an operator adding a rate via the real modelPricing.create
    // mutation is a separate, already-tested write path).
    tables.modelPricing.push(
      makeRate({ model: "new-model", inputPerToken: 0.000003, outputPerToken: 0.000015 }) as unknown as FakeDoc
    );

    const result2 = await (costBreakdown as any)._handler(ctx, { period: "hourly", lookbackHours: 24 });
    expect(result2.billedTotal).toBeCloseTo(1000 * 0.000003 + 500 * 0.000015, 10);
    expect(result2.unpricedModelCount).toBe(0);

    // No aggregate row was mutated between the two runs.
    expect(insertCalls.length).toBe(0);
    expect(patchCalls.length).toBe(0);
    expect(deleteCalls.length).toBe(0);
  });
});

describe("unpricedModels", () => {
  test("counts distinct (provider, model) pairs, not rows, and sums token counts per pair across billingTypes", async () => {
    const bucketStart = recentBucketStart();
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 300, dimensions: { provider: "x", model: "y", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 100, dimensions: { provider: "x", model: "y", billingType: "api", goalId: "" } },
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 50, dimensions: { provider: "x", model: "y", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 20, dimensions: { provider: "x", model: "y", billingType: "subscription", goalId: "" } },
      ],
      modelPricing: [],
    });

    const result = await (unpricedModels as any)._handler(ctx, { lookbackHours: 24 });

    expect(result.count).toBe(1);
    expect(result.models).toHaveLength(1);
    expect(result.models[0].provider).toBe("x");
    expect(result.models[0].model).toBe("y");
    expect(result.models[0].promptTokens).toBe(350);
    expect(result.models[0].completionTokens).toBe(120);
  });

  // ---------------------------------------------------------------------
  // D-03 accuracy regression, found on the RENDERED nudge at the Phase 104
  // validation gate (2026-08-02). The nudge claimed 4 models "need pricing
  // rates" including `claude-cli`, while costBreakdown simultaneously
  // reported that same model as priced:true / coveredUsd 0.180785 against
  // its seeded D-06 shadow row. Cause: `priced: false` means BOTH "no rate"
  // and "no tokens reported", and the query filtered on the boolean.
  // ---------------------------------------------------------------------
  test("does NOT demand a rate for a priced model that merely has a zero-token bucket", async () => {
    const bucketStart = recentBucketStart();
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        // A real, priced subscription turn for claude-cli...
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 1000, dimensions: { provider: "claude-cli", model: "claude-cli", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 10, dimensions: { provider: "claude-cli", model: "claude-cli", billingType: "subscription", goalId: "" } },
        // ...plus a ZERO-token bucket for the very same model in another hour.
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart - 3600, value: 0, dimensions: { provider: "claude-cli", model: "claude-cli", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart - 3600, value: 0, dimensions: { provider: "claude-cli", model: "claude-cli", billingType: "subscription", goalId: "" } },
      ],
      // The D-06 shadow row: claude-cli IS priced.
      modelPricing: [
        { model: "claude-cli", inputPerToken: 0.000005, outputPerToken: 0.000025, shadowForProvider: "claude-cli" } as unknown as PricingRow,
      ],
    });

    const result = await (unpricedModels as any)._handler(ctx, { lookbackHours: 24 });

    expect(result.count).toBe(0);
    expect(result.models).toEqual([]);
  });

  test("a model with NO rate is still reported, so the guard did not just disable the nudge", async () => {
    const bucketStart = recentBucketStart();
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 500, dimensions: { provider: "openai", model: "gpt-4.1", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 40, dimensions: { provider: "openai", model: "gpt-4.1", billingType: "api", goalId: "" } },
      ],
      modelPricing: [],
    });

    const result = await (unpricedModels as any)._handler(ctx, { lookbackHours: 24 });

    expect(result.count).toBe(1);
    expect(result.models[0].model).toBe("gpt-4.1");
  });

  test("a zero-token bucket for an UNPRICED model is not reported either — no tokens means no missing cost", async () => {
    const bucketStart = recentBucketStart();
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 0, dimensions: { provider: "codex", model: "codex", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 0, dimensions: { provider: "codex", model: "codex", billingType: "subscription", goalId: "" } },
      ],
      modelPricing: [],
    });

    const result = await (unpricedModels as any)._handler(ctx, { lookbackHours: 24 });

    expect(result.count).toBe(0);
  });

  test("deriveBucketDollars distinguishes the two unpriced reasons", () => {
    const index = buildRateIndex([
      { model: "m", inputPerToken: 0.001, outputPerToken: 0.002 } as unknown as PricingRow,
    ]);
    const noTokens = deriveBucketDollars({ provider: "p", model: "m", billingType: "api" }, 0, 0, index);
    const noRate = deriveBucketDollars({ provider: "p", model: "absent", billingType: "api" }, 10, 5, index);

    expect(noTokens.priced).toBe(false);
    expect(noTokens.unpricedReason).toBe("no-tokens");
    expect(noRate.priced).toBe(false);
    expect(noRate.unpricedReason).toBe("no-rate");
    // The dollar-field honesty guard is UNCHANGED by this fix.
    expect(noTokens.billedUsd).toBeNull();
    expect(noTokens.coveredUsd).toBeNull();
    expect(noRate.billedUsd).toBeNull();
    expect(noRate.coveredUsd).toBeNull();
  });

  test("costBreakdown's unpricedModelCount also excludes zero-token pairs", async () => {
    const bucketStart = recentBucketStart();
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 0, dimensions: { provider: "codex", model: "codex", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 0, dimensions: { provider: "codex", model: "codex", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 700, dimensions: { provider: "openai", model: "gpt-4.1", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 30, dimensions: { provider: "openai", model: "gpt-4.1", billingType: "api", goalId: "" } },
      ],
      modelPricing: [],
    });

    const result = await (costBreakdown as any)._handler(ctx, { period: "hourly", lookbackHours: 24 });

    // Only gpt-4.1 genuinely needs a rate; codex reported no tokens at all.
    expect(result.unpricedModelCount).toBe(1);
    expect(result.unpricedTokenTotal).toBe(730);
  });
});

describe("computePeriodSpend", () => {
  const DAY = 86400;
  const nowSec = 1_700_000_000;
  const todayStart = Math.floor(nowSec / DAY) * DAY;

  test("a periodStart earlier than today reads BOTH the daily and hourly windows without double-counting", async () => {
    const periodStart = todayStart - 3 * DAY;
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        // A whole day inside [periodStart, todayStart) — read via the daily window.
        { metric_type: "tokens_prompt", period: "daily", bucket_start: todayStart - 2 * DAY, value: 1000, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "daily", bucket_start: todayStart - 2 * DAY, value: 500, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        // Today's own hour — read via the hourly window.
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 200, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 100, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
      ],
      modelPricing: [makeRate({ model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015 })],
    });

    const result = await computePeriodSpend(ctx as any, { scope: "global", scopeKey: "", periodStart, nowSec });

    const expectedBilled = (1000 + 200) * 0.000003 + (500 + 100) * 0.000015;
    expect(result.billedUsd).toBeCloseTo(expectedBilled, 10);
    expect(result.unpricedTokens).toBe(0);
  });

  test("a daily budget (periodStart === todayStart) issues no daily-period read at all", async () => {
    const { ctx, queryLog } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 100, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 50, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
      ],
      modelPricing: [makeRate({ model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015 })],
    });

    await computePeriodSpend(ctx as any, { scope: "global", scopeKey: "", periodStart: todayStart, nowSec });

    const issuedDailyRead = queryLog.some(
      (entry) =>
        entry.table === "aggregates" &&
        entry.predicates.some((p) => p.op === "eq" && p.field === "period" && p.value === "daily")
    );
    expect(issuedDailyRead).toBe(false);
  });

  test("scope: 'model' excludes other models' buckets", async () => {
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 1000, dimensions: { provider: "anthropic_direct", model: "model-a", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 500, dimensions: { provider: "anthropic_direct", model: "model-a", billingType: "api", goalId: "" } },
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 9999, dimensions: { provider: "anthropic_direct", model: "model-b", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 9999, dimensions: { provider: "anthropic_direct", model: "model-b", billingType: "api", goalId: "" } },
      ],
      modelPricing: [
        makeRate({ model: "model-a", inputPerToken: 0.000003, outputPerToken: 0.000015 }),
        makeRate({ model: "model-b", inputPerToken: 0.000003, outputPerToken: 0.000015 }),
      ],
    });

    const result = await computePeriodSpend(ctx as any, {
      scope: "model",
      scopeKey: "model-a",
      periodStart: todayStart,
      nowSec,
    });

    expect(result.billedUsd).toBeCloseTo(1000 * 0.000003 + 500 * 0.000015, 10);
  });

  test("excludes billingType: 'subscription' buckets from billedUsd under every scope", async () => {
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 1000, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 500, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 5000, dimensions: { provider: "claude-cli", model: "claude-cli-turn", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 2000, dimensions: { provider: "claude-cli", model: "claude-cli-turn", billingType: "subscription", goalId: "" } },
      ],
      modelPricing: [
        makeRate({ model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015 }),
        makeRate({ model: "claude-cli", shadowForProvider: "claude-cli", inputPerToken: 0.000005, outputPerToken: 0.000025 }),
      ],
    });

    for (const scope of ["global", "model", "provider"] as const) {
      const scopeKey = scope === "model" ? "claude-sonnet-4-5" : scope === "provider" ? "anthropic_direct" : "";
      const result = await computePeriodSpend(ctx as any, { scope, scopeKey, periodStart: todayStart, nowSec });
      expect(result.billedUsd).toBeCloseTo(1000 * 0.000003 + 500 * 0.000015, 10);
    }
  });

  test("unpriced buckets contribute to unpricedTokens and nothing to billedUsd", async () => {
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 1000, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 500, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: todayStart + 3600, value: 300, dimensions: { provider: "openrouter", model: "unrated-model", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: todayStart + 3600, value: 100, dimensions: { provider: "openrouter", model: "unrated-model", billingType: "api", goalId: "" } },
      ],
      modelPricing: [makeRate({ model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015 })],
    });

    const result = await computePeriodSpend(ctx as any, { scope: "global", scopeKey: "", periodStart: todayStart, nowSec });

    expect(result.billedUsd).toBeCloseTo(1000 * 0.000003 + 500 * 0.000015, 10);
    expect(result.unpricedTokens).toBe(400);
  });
});

// costOverTime — sanity check that billed/covered/unpriced stay three
// separate, never-merged provider-keyed maps per bucket.
describe("costOverTime", () => {
  test("keeps billedByProvider, coveredByProvider and unpricedTokensByProvider separate per bucket", async () => {
    const bucketStart = recentBucketStart();
    const { ctx } = makeCostDerivedCtx({
      aggregates: [
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 1000, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 500, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-4-5", billingType: "api", goalId: "" } },
        { metric_type: "tokens_prompt", period: "hourly", bucket_start: bucketStart, value: 5000, dimensions: { provider: "codex", model: "codex-cli-turn", billingType: "subscription", goalId: "" } },
        { metric_type: "tokens_completion", period: "hourly", bucket_start: bucketStart, value: 2000, dimensions: { provider: "codex", model: "codex-cli-turn", billingType: "subscription", goalId: "" } },
      ],
      modelPricing: [
        makeRate({ model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015 }),
        makeRate({ model: "codex", shadowForProvider: "codex", inputPerToken: 0.000005, outputPerToken: 0.000025 }),
      ],
    });

    const result = await (costOverTime as any)._handler(ctx, { period: "hourly", lookbackHours: 24 });

    expect(result).toHaveLength(1);
    const bucket = result[0];
    expect(bucket.billedByProvider.anthropic_direct).toBeCloseTo(1000 * 0.000003 + 500 * 0.000015, 10);
    expect(bucket.coveredByProvider.codex).toBeCloseTo(5000 * 0.000005 + 2000 * 0.000025, 10);
    // billed and covered are keyed separately — no provider appears with a
    // combined figure in either map.
    expect(bucket.coveredByProvider.anthropic_direct).toBeUndefined();
    expect(bucket.billedByProvider.codex).toBe(0); // subscription billedUsd is always a true $0
    expect(bucket.unpricedTokensByProvider).toEqual({});
  });
});
