/**
 * Tests for convex/costBudgetEval.ts.
 *
 * Task 1: pure projection (D-13) + classification (D-11) + message-copy
 * (D-16 honesty / UI-SPEC copywriting contract) tests — no ctx needed.
 * Task 2 (dedup + fire path, below) and Task 3 (cron tail-append) extend
 * this file.
 */
import { describe, test, expect, vi } from "vitest";
import {
  projectPeriodEndSpend,
  classifyBudgetLevel,
  buildAlertMessage,
  containsForbiddenEnforcementWord,
  evaluateBudgets,
} from "./costBudgetEval";
import { projectDayEndSpend, DAILY_CAP } from "../src/components/SDKSpendGuard";
import { periodStartFor } from "./costBudgets";

// Task 3 (cron tail-append): wrap the REAL evaluateBudgets in a vi.fn spy so
// convex/aggregates.ts's computeHourly (which imports evaluateBudgets from
// this same module) can be asserted against for call count/args/rejection
// behavior, without changing behavior for the Task 1/2 tests above (which
// import evaluateBudgets directly and still exercise the real
// implementation through the spy's pass-through wrapper).
vi.mock("./costBudgetEval", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./costBudgetEval")>();
  return { ...actual, evaluateBudgets: vi.fn(actual.evaluateBudgets) };
});

// Imported AFTER the vi.mock call above (source order doesn't matter — the
// mock is hoisted by vitest's transform — but this ordering keeps the
// dependency honest to read): aggregates.ts's own `import { evaluateBudgets }
// from "./costBudgetEval"` resolves to this same spy-wrapped module.
import { computeHourly } from "./aggregates";

// ---------------------------------------------------------------------------
// projectPeriodEndSpend (D-13)
// ---------------------------------------------------------------------------

describe("projectPeriodEndSpend", () => {
  test("reproduces projectDayEndSpend's exact numbers when periodHours === 24 and periodStartSec is a UTC day start", () => {
    const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const spend = 2.4;
    const elapsedHours = 6;

    const legacy = projectDayEndSpend(spend, elapsedHours);
    const generalized = projectPeriodEndSpend(spend, elapsedHours, 24, DAILY_CAP, dayStart);

    expect(generalized.projectedTotal).toBeCloseTo(legacy.projectedTotal, 10);
    expect(generalized.willExceed).toBe(legacy.willExceedCap);
    if (legacy.projectedHitTime === null) {
      expect(generalized.projectedHitTime).toBeNull();
    } else {
      expect(generalized.projectedHitTime).not.toBeNull();
      expect(generalized.projectedHitTime!.getTime()).toBeCloseTo(legacy.projectedHitTime.getTime(), -2);
    }
  });

  test("a monthly period (periodHours=744) projects proportionally and lands the hit time inside the month", () => {
    const monthStart = Date.UTC(2026, 6, 1) / 1000; // July 2026, 00:00 UTC
    const monthEnd = Date.UTC(2026, 7, 1) / 1000;
    // 5 days elapsed (120h), $40 spent -> hourly rate $0.333/h -> monthly projection ~$248
    const result = projectPeriodEndSpend(40, 120, 744, 100, monthStart);

    expect(result.willExceed).toBe(true);
    expect(result.projectedTotal).toBeCloseTo((40 / 120) * 744, 6);
    expect(result.projectedHitTime).not.toBeNull();
    const hitSec = result.projectedHitTime!.getTime() / 1000;
    expect(hitSec).toBeGreaterThanOrEqual(monthStart);
    expect(hitSec).toBeLessThan(monthEnd);
  });

  test("elapsedHours === 0 returns the zero result rather than dividing by zero", () => {
    const result = projectPeriodEndSpend(10, 0, 24, 5, 0);
    expect(result).toEqual({ projectedTotal: 0, willExceed: false, projectedHitTime: null });
  });
});

// ---------------------------------------------------------------------------
// classifyBudgetLevel (D-11 + D-13 spike)
// ---------------------------------------------------------------------------

describe("classifyBudgetLevel", () => {
  test("returns 'error' at exactly spend === limitValue", () => {
    expect(classifyBudgetLevel(100, 0, 100, 0.8)).toBe("error");
  });

  test("returns 'warning' at exactly spend === warnFraction * limitValue", () => {
    expect(classifyBudgetLevel(80, 0, 100, 0.8)).toBe("warning");
  });

  test("returns 'warning' for the D-13 spike case: spend below warn fraction but projection exceeds the limit", () => {
    expect(classifyBudgetLevel(10, 150, 100, 0.8)).toBe("warning");
  });

  test("returns null when spend and projection are both under", () => {
    expect(classifyBudgetLevel(10, 20, 100, 0.8)).toBeNull();
  });

  test("breach takes precedence over a simultaneous spike signal", () => {
    expect(classifyBudgetLevel(100, 500, 100, 0.8)).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// buildAlertMessage (D-16 honesty / UI-SPEC copywriting contract)
// ---------------------------------------------------------------------------

describe("buildAlertMessage", () => {
  test("omits the projection clause when projectedHitTime is null", () => {
    const message = buildAlertMessage({
      scopeLabel: "Global daily",
      spend: 4,
      limitValue: 5,
      unit: "usd",
      projectedTotal: 4.5,
      projectedHitTime: null,
      unpricedTokens: 0,
    });
    expect(message).not.toMatch(/projected/i);
    expect(message).toContain("Global daily budget at 80% ($4.0000 of $5.0000).");
  });

  test("includes a projection clause when projectedHitTime is present", () => {
    const hitTime = new Date("2026-08-01T15:40:00Z");
    const message = buildAlertMessage({
      scopeLabel: "Global daily",
      spend: 4.5,
      limitValue: 5,
      unit: "usd",
      projectedTotal: 6,
      projectedHitTime: hitTime,
      unpricedTokens: 0,
    });
    expect(message).toContain("— projected to hit $5.0000 by ~");
  });

  test("renders % and no $ when unit === 'quota_pct'", () => {
    const message = buildAlertMessage({
      scopeLabel: "Quota claude-cli daily",
      spend: 85,
      limitValue: 100,
      unit: "quota_pct",
      projectedTotal: 90,
      projectedHitTime: null,
      unpricedTokens: 0,
    });
    expect(message).not.toContain("$");
    expect(message).toContain("85.0%");
    expect(message).toContain("100.0%");
  });

  test("appends the unpriced-tokens honesty clause when unpricedTokens > 0", () => {
    const message = buildAlertMessage({
      scopeLabel: "Global daily",
      spend: 4,
      limitValue: 5,
      unit: "usd",
      projectedTotal: 4.5,
      projectedHitTime: null,
      unpricedTokens: 1234,
    });
    expect(message).toContain("1234 tokens in this window are unpriced and are not included.");
  });

  test("never contains any of the forbidden enforcement words, in any generated message", () => {
    const messages = [
      buildAlertMessage({
        scopeLabel: "Global daily",
        spend: 5,
        limitValue: 5,
        unit: "usd",
        projectedTotal: 5,
        projectedHitTime: new Date(),
        unpricedTokens: 0,
      }),
      buildAlertMessage({
        scopeLabel: "Model claude-opus-5 monthly",
        spend: 90,
        limitValue: 100,
        unit: "usd",
        projectedTotal: 120,
        projectedHitTime: new Date(),
        unpricedTokens: 500,
      }),
      buildAlertMessage({
        scopeLabel: "Quota claude-cli daily",
        spend: 95,
        limitValue: 100,
        unit: "quota_pct",
        projectedTotal: 100,
        projectedHitTime: null,
        unpricedTokens: 0,
      }),
    ];
    for (const message of messages) {
      expect(containsForbiddenEnforcementWord(message)).toBe(false);
    }
  });

  test("containsForbiddenEnforcementWord itself detects each forbidden word", () => {
    for (const word of ["throttle", "swap", "stop", "block", "disable", "cap enforced"]) {
      expect(containsForbiddenEnforcementWord(`this budget will ${word} something`)).toBe(true);
    }
    expect(containsForbiddenEnforcementWord("Global daily budget at 80% ($4.0000 of $5.0000).")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateBudgets — Task 2. Fake ctx generalizes the query/withIndex(eq/gte/
// gt/lte/lt)/filter/collect/first convention from aggregates.test.ts /
// costDerived.test.ts (this repo has no convex-test), adding order()/take()
// for the gatewayQuotaSnapshots.by_provider read and a scheduler.runAfter
// recorder. A quota query for provider "THROW" is a deliberate test-only
// trapdoor simulating a downstream read failure, to exercise the
// per-budget-row try/catch isolation without needing convex-test.
// ---------------------------------------------------------------------------

type FakeDoc = Record<string, any>;

function makeEvalCtx(
  opts: {
    costBudgets?: FakeDoc[];
    aggregates?: FakeDoc[];
    modelPricing?: FakeDoc[];
    gatewayQuotaSnapshots?: FakeDoc[];
    alerts?: FakeDoc[];
  } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    costBudgets: [...(opts.costBudgets ?? [])],
    aggregates: [...(opts.aggregates ?? [])],
    modelPricing: [...(opts.modelPricing ?? [])],
    gatewayQuotaSnapshots: [...(opts.gatewayQuotaSnapshots ?? [])],
    alerts: [...(opts.alerts ?? [])],
  };
  let nextId = 1;
  const schedulerCalls: Array<{ delay: number; fn: unknown; args: unknown }> = [];

  function query(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const predicates: Array<(r: FakeDoc) => boolean> = [];
    let dir: "asc" | "desc" = "asc";

    const chain = {
      withIndex(_index: string, cb?: (q: any) => any) {
        if (cb) {
          const q: any = {};
          for (const op of ["eq", "gte", "gt", "lte", "lt"] as const) {
            q[op] = (field: string, value: unknown) => {
              // Deliberate test-only trapdoor (Task 2's isolation test): a
              // quota read for provider "THROW" simulates a downstream
              // failure so the per-budget try/catch can be exercised
              // without needing convex-test to fabricate a real one.
              if (table === "gatewayQuotaSnapshots" && field === "provider" && value === "THROW") {
                throw new Error("simulated gatewayQuotaSnapshots read failure");
              }
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
      order(direction: "asc" | "desc") {
        dir = direction;
        return chain;
      },
      async collect() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        return dir === "desc" ? [...filtered].reverse() : filtered;
      },
      async first() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered[0] ?? null;
      },
      async take(n: number) {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered.slice(0, n);
      },
    };
    return chain;
  }

  const db = {
    query,
    async insert(table: string, doc: FakeDoc) {
      const row = { ...doc, _id: `${table}_${nextId}`, _creationTime: nextId };
      nextId++;
      (tables[table] ?? (tables[table] = [])).push(row);
      return row._id;
    },
    async patch() {
      throw new Error("db.patch must not be called by evaluateBudgets");
    },
    async delete() {
      throw new Error("db.delete must not be called by evaluateBudgets");
    },
  };

  const scheduler = {
    async runAfter(delay: number, fn: unknown, args: unknown) {
      schedulerCalls.push({ delay, fn, args });
    },
  };

  return { ctx: { db, scheduler } as any, tables, schedulerCalls };
}

/** A resolved-rate hourly aggregate row pair (tokens_prompt + tokens_completion) for one dimension key. */
function seedHourlyTokens(
  aggregates: FakeDoc[],
  bucketStart: number,
  dims: { provider: string; model: string; billingType: string; goalId: string },
  promptTokens: number,
  completionTokens: number
) {
  aggregates.push({
    metric_type: "tokens_prompt",
    period: "hourly",
    bucket_start: bucketStart,
    value: promptTokens,
    dimensions: dims,
  });
  aggregates.push({
    metric_type: "tokens_completion",
    period: "hourly",
    bucket_start: bucketStart,
    value: completionTokens,
    dimensions: dims,
  });
}

const RATE = { inputPerToken: 0.000005, outputPerToken: 0.000025 }; // $5/$25 per Mtok, matches modelPricing's seeded claude-opus-5 rate
const DIMS = { provider: "anthropic_direct", model: "claude-opus-5", billingType: "api", goalId: "" };

describe("evaluateBudgets — dedup and fire (D-15/D-16/D-17)", () => {
  const NOW = Date.UTC(2026, 6, 15, 12, 0, 0) / 1000; // 2026-07-15 12:00 UTC
  const PERIOD_START = periodStartFor("daily", NOW);
  const HOUR_BUCKET = PERIOD_START + 10 * 3600; // 10:00 UTC same day

  function baseCtx(promptTokens: number, completionTokens: number) {
    const aggregates: FakeDoc[] = [];
    seedHourlyTokens(aggregates, HOUR_BUCKET, DIMS, promptTokens, completionTokens);
    const costBudgets: FakeDoc[] = [
      {
        _id: "costBudgets_1",
        scope: "global",
        scopeKey: "",
        period: "daily",
        limit: 5,
        warnFraction: 0.8,
        unit: "usd",
        enabled: true,
      },
    ];
    const modelPricing: FakeDoc[] = [{ model: "claude-opus-5", ...RATE }];
    return makeEvalCtx({ costBudgets, aggregates, modelPricing });
  }

  test("a budget crossing warn fires exactly one alert with severity warning and webhookStatus pending", async () => {
    // promptTokens*0.000005 + completionTokens*0.000025 = 300000*0.000005 + 120000*0.000025 = 1.5 + 3.0 = $4.50 (>= 80% of $5)
    const { ctx, tables } = baseCtx(300000, 120000);
    const result = await evaluateBudgets(ctx, NOW);

    expect(result.fired).toBe(1);
    expect(result.evaluated).toBe(1);
    expect(result.errors).toBe(0);
    expect(tables.alerts).toHaveLength(1);
    expect(tables.alerts[0].severity).toBe("warning");
    expect(tables.alerts[0].webhookStatus).toBe("pending");
    expect(tables.alerts[0].source).toBe("cost-budget:costBudgets_1:warning");
  });

  test("the scheduler recorded exactly one runAfter call, scheduled immediately, with attempt 1", async () => {
    // Note: `internal.webhookDelivery.sendAlertWebhook` (convex's anyApi) is a
    // fresh Proxy on every property access — not `===`-stable even within
    // the same module — so identity comparison isn't meaningful here.
    // convex/evalScores.test.ts's analogous scheduler assertions establish
    // the same convention: assert delay + args shape, never the fn reference.
    const { ctx, schedulerCalls, tables } = baseCtx(300000, 120000);
    await evaluateBudgets(ctx, NOW);

    expect(schedulerCalls).toHaveLength(1);
    expect(schedulerCalls[0].delay).toBe(0);
    expect(schedulerCalls[0].args).toMatchObject({ alertId: tables.alerts[0]._id, attempt: 1 });
  });

  test("D-17 guard: the only mutation evaluateBudgets performs is the alerts insert — no other table is written", async () => {
    const { ctx, tables } = baseCtx(300000, 120000);
    await evaluateBudgets(ctx, NOW);

    expect(tables.costBudgets).toHaveLength(1); // unchanged (seed row only, never inserted-to)
    expect(tables.aggregates).toHaveLength(2); // unchanged (seed rows only)
    expect(tables.alerts).toHaveLength(1); // the one and only write
  });

  test("a second evaluation in the same period fires nothing and increments skippedDeduped", async () => {
    const { ctx } = baseCtx(300000, 120000);
    const first = await evaluateBudgets(ctx, NOW);
    const second = await evaluateBudgets(ctx, NOW);

    expect(first.fired).toBe(1);
    expect(second.fired).toBe(0);
    expect(second.skippedDeduped).toBe(1);
  });

  test("a prior alert with status 'resolved' still suppresses the re-fire (no status filter)", async () => {
    const { ctx, tables } = baseCtx(300000, 120000);
    tables.alerts.push({
      _id: "alerts_seed",
      severity: "warning",
      source: "cost-budget:costBudgets_1:warning",
      message: "pre-existing",
      acknowledged: true,
      status: "resolved",
      createdAt: NOW - 3600,
      webhookStatus: "delivered",
      details: { periodStart: PERIOD_START },
    });

    const result = await evaluateBudgets(ctx, NOW);
    expect(result.fired).toBe(0);
    expect(result.skippedDeduped).toBe(1);
  });

  test("escalation from warning to error within the same period DOES fire (source differs)", async () => {
    const { ctx, tables } = baseCtx(300000, 120000);
    const first = await evaluateBudgets(ctx, NOW);
    expect(first.fired).toBe(1);
    expect(tables.alerts[0].severity).toBe("warning");

    // Push spend to a breach: add another hour's worth of tokens so total >= $5.
    seedHourlyTokens(tables.aggregates, HOUR_BUCKET + 3600, DIMS, 200000, 40000); // +$1.00 + $1.00 = +$2.00 -> $6.50 total
    const second = await evaluateBudgets(ctx, NOW);

    expect(second.fired).toBe(1);
    expect(second.skippedDeduped).toBe(0);
    expect(tables.alerts).toHaveLength(2);
    expect(tables.alerts[1].severity).toBe("error");
    expect(tables.alerts[1].source).toBe("cost-budget:costBudgets_1:error");
  });

  test("advancing nowSec into the next period re-arms and fires again", async () => {
    const { ctx, tables } = baseCtx(300000, 120000);
    const day1 = await evaluateBudgets(ctx, NOW);
    expect(day1.fired).toBe(1);

    const NOW_DAY2 = NOW + 86400;
    const day2PeriodStart = periodStartFor("daily", NOW_DAY2);
    seedHourlyTokens(
      tables.aggregates,
      day2PeriodStart + 10 * 3600,
      DIMS,
      300000,
      120000
    );

    const day2 = await evaluateBudgets(ctx, NOW_DAY2);
    expect(day2.fired).toBe(1);
    expect(day2.skippedDeduped).toBe(0);
    expect(tables.alerts).toHaveLength(2);
  });

  test("a quota budget with no gatewayQuotaSnapshots row for its provider fires nothing and increments skippedNoData", async () => {
    const costBudgets: FakeDoc[] = [
      {
        _id: "costBudgets_quota",
        scope: "quota",
        scopeKey: "claude-cli",
        period: "daily",
        limit: 90,
        warnFraction: 0.8,
        unit: "quota_pct",
        enabled: true,
      },
    ];
    const { ctx, tables } = makeEvalCtx({ costBudgets, gatewayQuotaSnapshots: [] });
    const result = await evaluateBudgets(ctx, NOW);

    expect(result.fired).toBe(0);
    expect(result.skippedNoData).toBe(1);
    expect(tables.alerts).toHaveLength(0);
  });

  test("a quota budget with a live snapshot fires from remainingPct correctly (0-1 fraction -> 0-100 consumed pct)", async () => {
    const costBudgets: FakeDoc[] = [
      {
        _id: "costBudgets_quota",
        scope: "quota",
        scopeKey: "claude-cli",
        period: "daily",
        limit: 90,
        warnFraction: 0.8,
        unit: "quota_pct",
        enabled: true,
      },
    ];
    // remainingPct 0.05 -> 5% remaining -> 95% consumed -> breaches a 90% limit.
    const gatewayQuotaSnapshots: FakeDoc[] = [
      { provider: "claude-cli", remainingPct: 0.05, timestamp: NOW - 60 },
    ];
    const { ctx, tables } = makeEvalCtx({ costBudgets, gatewayQuotaSnapshots });
    const result = await evaluateBudgets(ctx, NOW);

    expect(result.fired).toBe(1);
    expect(tables.alerts[0].severity).toBe("error");
    expect(tables.alerts[0].details.spend).toBeCloseTo(95, 6);
  });

  test("one budget row that throws does not prevent the remaining budgets from being evaluated", async () => {
    const costBudgets: FakeDoc[] = [
      {
        _id: "costBudgets_boom",
        scope: "quota",
        scopeKey: "THROW", // trapdoor: makeEvalCtx throws synchronously on this read
        period: "daily",
        limit: 90,
        warnFraction: 0.8,
        unit: "quota_pct",
        enabled: true,
      },
      {
        _id: "costBudgets_1",
        scope: "global",
        scopeKey: "",
        period: "daily",
        limit: 5,
        warnFraction: 0.8,
        unit: "usd",
        enabled: true,
      },
    ];
    const aggregates: FakeDoc[] = [];
    seedHourlyTokens(aggregates, HOUR_BUCKET, DIMS, 300000, 120000);
    const modelPricing: FakeDoc[] = [{ model: "claude-opus-5", ...RATE }];
    const { ctx, tables } = makeEvalCtx({ costBudgets, aggregates, modelPricing });

    const result = await evaluateBudgets(ctx, NOW);
    expect(result.evaluated).toBe(2);
    expect(result.errors).toBe(1);
    expect(result.fired).toBe(1); // the second (healthy) budget still fires
    expect(tables.alerts).toHaveLength(1);
    expect(tables.alerts[0].source).toContain("costBudgets_1");
  });

  test("D-16 guard: across every case above, every scheduler call carries exactly {alertId, attempt} — evaluateBudgets never schedules anything else", async () => {
    // evaluateBudgets's source has exactly one `ctx.scheduler.runAfter(...)`
    // call site, always `(0, internal.webhookDelivery.sendAlertWebhook,
    // {alertId, attempt: 1})` — asserting every recorded call's args shape
    // matches that (and never, say, a profileConfigs/activeEngineSnapshots/
    // astridrCommands-shaped payload) is the behavioral form of the D-16
    // guard the identity-unstable anyApi Proxy (see the prior test's note)
    // prevents from being asserted by fn reference.
    const { ctx: ctxA, schedulerCalls: callsA } = baseCtx(300000, 120000);
    await evaluateBudgets(ctxA, NOW);

    const { ctx: ctxB, schedulerCalls: callsB } = makeEvalCtx({
      costBudgets: [
        {
          _id: "costBudgets_quota",
          scope: "quota",
          scopeKey: "claude-cli",
          period: "daily",
          limit: 90,
          warnFraction: 0.8,
          unit: "quota_pct",
          enabled: true,
        },
      ],
      gatewayQuotaSnapshots: [{ provider: "claude-cli", remainingPct: 0.02, timestamp: NOW - 60 }],
    });
    await evaluateBudgets(ctxB, NOW);

    const allCalls = [...callsA, ...callsB];
    expect(allCalls.length).toBeGreaterThan(0);
    for (const call of allCalls) {
      expect(call.delay).toBe(0);
      expect(Object.keys(call.args as object).sort()).toEqual(["alertId", "attempt"]);
      expect((call.args as { attempt: number }).attempt).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// cron tail-append (D-14) — Task 3. Exercises the REAL computeHourly handler
// (imported below, AFTER the vi.mock("./costBudgetEval", ...) call above —
// module-level vi.mock calls are hoisted by vitest regardless of source
// order, so aggregates.ts's own `import { evaluateBudgets } from
// "./costBudgetEval"` resolves to the same spy-wrapped module here) via the
// `._handler` escape hatch, matching convex/aggregates.test.ts's own
// "token split" describe block's convention exactly (same fake-ctx shape:
// query/withIndex(eq/gte/gt/lte/lt)/filter(neq)/collect/first/paginate),
// extended with the costBudgets/gatewayQuotaSnapshots/alerts tables and a
// scheduler.runAfter recorder evaluateBudgets itself needs.
// ---------------------------------------------------------------------------

function makeCronCtx(
  opts: {
    llmMetrics?: FakeDoc[];
    aggregates?: FakeDoc[];
    agentConfigs?: FakeDoc[];
    modelPricing?: FakeDoc[];
    costBudgets?: FakeDoc[];
    gatewayQuotaSnapshots?: FakeDoc[];
    alerts?: FakeDoc[];
  } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    llmMetrics: [...(opts.llmMetrics ?? [])],
    aggregates: [...(opts.aggregates ?? [])],
    agentConfigs: [...(opts.agentConfigs ?? [])],
    modelPricing: [...(opts.modelPricing ?? [])],
    costBudgets: [...(opts.costBudgets ?? [])],
    gatewayQuotaSnapshots: [...(opts.gatewayQuotaSnapshots ?? [])],
    alerts: [...(opts.alerts ?? [])],
  };
  let nextId = 1;
  const schedulerCalls: Array<{ delay: number; args: unknown }> = [];

  function query(table: string) {
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
      order(direction: "asc" | "desc") {
        dir = direction;
        return chain;
      },
      async collect() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        return dir === "desc" ? [...filtered].reverse() : filtered;
      },
      async first() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered[0] ?? null;
      },
      async take(n: number) {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered.slice(0, n);
      },
      async paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const start = cursor ? Number(cursor) : 0;
        const page = filtered.slice(start, start + numItems);
        const isDone = start + numItems >= filtered.length;
        return { page, isDone, continueCursor: String(start + numItems) };
      },
    };
    return chain;
  }

  const db = {
    query,
    async insert(table: string, doc: FakeDoc) {
      const row = { ...doc, _id: `${table}_${nextId}`, _creationTime: nextId };
      nextId++;
      (tables[table] ?? (tables[table] = [])).push(row);
      return row._id;
    },
    async patch() {
      throw new Error("db.patch not expected in these cron tail-append tests");
    },
    async delete() {
      throw new Error("db.delete not expected in these cron tail-append tests");
    },
  };

  const scheduler = {
    async runAfter(delay: number, _fn: unknown, args: unknown) {
      schedulerCalls.push({ delay, args });
    },
  };

  return { ctx: { db, scheduler } as any, tables, schedulerCalls };
}

describe("computeHourly — cron tail-append (D-14)", () => {
  test("when evaluateBudgets throws, the handler still resolves and the token/cost bucket inserts are unaffected", async () => {
    vi.mocked(evaluateBudgets).mockClear();
    vi.mocked(evaluateBudgets).mockRejectedValueOnce(new Error("simulated evaluateBudgets failure"));

    const hourStart = Math.floor(Date.now() / 1000 / 3600) * 3600 - 3600;
    const { ctx, tables } = makeCronCtx({
      llmMetrics: [
        {
          provider: "anthropic_direct",
          model: "claude-sonnet-5",
          cost: 0.01,
          promptTokens: 100,
          completionTokens: 20,
          totalTokens: 120,
          billingType: "api",
          timestamp: hourStart + 10,
          archived: false,
        },
      ],
    });

    await expect((computeHourly as any)._handler(ctx)).resolves.toBeUndefined();

    const costRow = tables.aggregates.find((r) => r.metric_type === "cost");
    const promptRow = tables.aggregates.find((r) => r.metric_type === "tokens_prompt");
    expect(costRow).toBeDefined();
    expect(promptRow).toBeDefined();
    expect(promptRow!.value).toBe(100);

    vi.mocked(evaluateBudgets).mockClear();
  });

  test("evaluateBudgets is invoked exactly once per computeHourly invocation", async () => {
    vi.mocked(evaluateBudgets).mockClear();

    const { ctx } = makeCronCtx({});
    await (computeHourly as any)._handler(ctx);

    expect(vi.mocked(evaluateBudgets)).toHaveBeenCalledTimes(1);

    vi.mocked(evaluateBudgets).mockClear();
  });

  test("the timestamp passed to evaluateBudgets equals the `now` the handler used to compute hourStart", async () => {
    vi.mocked(evaluateBudgets).mockClear();
    const fixedNowMs = Date.UTC(2026, 6, 15, 13, 20, 0); // 2026-07-15 13:20:00 UTC
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNowMs);

    try {
      const { ctx } = makeCronCtx({});
      await (computeHourly as any)._handler(ctx);

      expect(vi.mocked(evaluateBudgets)).toHaveBeenCalledTimes(1);
      const [, nowArg] = vi.mocked(evaluateBudgets).mock.calls[0];
      expect(nowArg).toBe(fixedNowMs / 1000);
    } finally {
      dateSpy.mockRestore();
      vi.mocked(evaluateBudgets).mockClear();
    }
  });
});
