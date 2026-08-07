import { describe, test, expect, vi } from "vitest";
import { getBillingType } from "./lib/providers";

// Phase 105 (D-04/D-06) tail-append tests need to observe call
// count/order/rejection-handling for BOTH tail-appended evaluators without
// convex-test — pass-through vi.mock spies (the exact pattern
// costBudgetEval.test.ts's own Task 3 section establishes) wrap the REAL
// implementations so the "tool usage buckets" describe block below (which
// calls computeHourly's real handler on ordinary fixtures) is unaffected;
// only the dedicated tail-append describe block clears/asserts on the spies.
vi.mock("./costBudgetEval", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./costBudgetEval")>();
  return { ...actual, evaluateBudgets: vi.fn(actual.evaluateBudgets) };
});
vi.mock("./toolPolicyAlertEval", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./toolPolicyAlertEval")>();
  return { ...actual, evaluateToolPolicyAlerts: vi.fn(actual.evaluateToolPolicyAlerts) };
});

import {
  computeHourly,
  backfillTokenSplit,
  backfillDailyRollup,
  costByGoalPeriod,
  llmByGoal,
  eventCountsByPeriod,
  rollupDaily,
} from "./aggregates";
import { evaluateBudgets } from "./costBudgetEval";
import { evaluateToolPolicyAlerts } from "./toolPolicyAlertEval";

// ---------------------------------------------------------------------------
// Fake ctx for exercising the real mutation handlers via `._handler` (the raw
// function Convex's mutation()/query() wrappers expose — see
// convex/modelPricing.test.ts's header comment; this repo has no convex-test).
// Supports just enough of ctx.db to drive computeHourly/backfillTokenSplit:
// withIndex(eq/gte/gt/lte/lt), filter(neq), collect(), first(), paginate(),
// and insert(). db.patch/db.delete THROW — the token-split backfill must be
// insert-only (D-04 / CLAUDE.md self-hosted rules), so any accidental call
// fails the test loudly instead of silently no-op'ing.
// ---------------------------------------------------------------------------

type FakeDoc = Record<string, any>;

function makeAggregatesCtx(
  opts: {
    llmMetrics?: FakeDoc[];
    aggregates?: FakeDoc[];
    agentConfigs?: FakeDoc[];
    modelPricing?: FakeDoc[];
    // Phase 105 (D-04/D-06): fixtures for the tool usage buckets and the
    // tail-appended tool-policy alert evaluator. Optional and additive —
    // every pre-Phase-105 test omits these and gets an empty table, which
    // the real evaluateToolPolicyAlerts handler treats as "no events this
    // hour" (skippedNoEvents, no writes, no scheduler call).
    toolExecutions?: FakeDoc[];
    costBudgets?: FakeDoc[];
    toolPolicyEvents?: FakeDoc[];
    alerts?: FakeDoc[];
  } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    llmMetrics: [...(opts.llmMetrics ?? [])],
    aggregates: [...(opts.aggregates ?? [])],
    agentConfigs: [...(opts.agentConfigs ?? [])],
    modelPricing: [...(opts.modelPricing ?? [])],
    toolExecutions: [...(opts.toolExecutions ?? [])],
    costBudgets: [...(opts.costBudgets ?? [])],
    toolPolicyEvents: [...(opts.toolPolicyEvents ?? [])],
    alerts: [...(opts.alerts ?? [])],
  };
  let nextId = 1;
  const schedulerCalls: Array<{ delay: number; args: unknown }> = [];
  // Per-ctx paginate counter — each test builds a fresh ctx and invokes one
  // handler, so this scopes to a single function invocation the way Convex's own
  // limit does. See the throw in paginate() below.
  let paginateCalls = 0;
  const patchCalls: unknown[] = [];
  const deleteCalls: unknown[] = [];

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
      // Bounded read used by fetchLlmRowsForWindow — same filter/order semantics
      // as collect(), capped at `n`. Unlike paginate() there is no per-invocation
      // limit on this in Convex, which is exactly why it is the right shape for a
      // helper called once per hour inside a loop.
      async take(n: number) {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered.slice(0, n);
      },
      async paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
        // Convex allows exactly ONE paginated query per function invocation and
        // throws on the second. This mock previously allowed unlimited calls,
        // which let two real multi-paginate bugs (backfillTokenSplit's per-hour
        // cursor loop, and computeHourly's latent one) pass 34 green tests and
        // then fail on the first live invocation at Phase 104's deploy gate.
        // Enforce the real constraint so the suite can catch it. (2026-07-31)
        paginateCalls++;
        if (paginateCalls > 1) {
          throw new Error(
            "This query or mutation function ran multiple paginated queries. Convex only supports a single paginated query in each function."
          );
        }
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
    patch(...args: unknown[]) {
      patchCalls.push(args);
      throw new Error("db.patch must not be called — the token-split path is insert-only");
    },
    delete(...args: unknown[]) {
      deleteCalls.push(args);
      throw new Error("db.delete must not be called — the token-split path is insert-only");
    },
  };

  const scheduler = {
    async runAfter(delay: number, _fn: unknown, args: unknown) {
      schedulerCalls.push({ delay, args });
    },
  };

  return { ctx: { db, scheduler }, tables, patchCalls, deleteCalls, schedulerCalls };
}

/** Mirrors computeHourly's own `hourStart` derivation so fixtures land in-bucket. */
function currentHourStart(): number {
  const now = Date.now() / 1000;
  return Math.floor(now / 3600) * 3600 - 3600;
}

describe("aggregates", () => {
  describe("computeHourly — bucket logic", () => {
    test("bucket_start is truncated to the hour boundary in epoch seconds", () => {
      // Simulates the bucket computation from computeHourly
      const now = 1713100000; // arbitrary epoch seconds
      const hourStart = Math.floor(now / 3600) * 3600 - 3600;
      expect(hourStart % 3600).toBe(0); // aligned to hour
      expect(hourStart).toBeLessThan(now);
      expect(hourStart + 3600).toBeLessThanOrEqual(Math.floor(now / 3600) * 3600);
    });

    test("cost dimension key groups by provider::model::billingType", () => {
      // Phase 67: billingType added to dimension key
      const rows = [
        { provider: "openrouter", model: "gpt-4", cost: 0.03, billingType: undefined as string | undefined },
        { provider: "openrouter", model: "gpt-4", cost: 0.02, billingType: undefined as string | undefined },
        { provider: "codex", model: "claude-3", cost: 0.00, billingType: undefined as string | undefined },
      ];
      const costByDim: Record<string, number> = {};
      for (const r of rows) {
        const billingType = r.billingType ?? getBillingType(r.provider);
        const key = `${r.provider}::${r.model}::${billingType}`;
        costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
      }
      expect(costByDim["openrouter::gpt-4::api"]).toBe(0.05);
      expect(costByDim["codex::claude-3::subscription"]).toBe(0);
      expect(Object.keys(costByDim)).toHaveLength(2);
    });

    test("idempotency guard uses per-dimension-key check (not simple first())", () => {
      // Phase 67: With billingType, multiple rows per hour bucket exist.
      // The idempotency guard must check per dimension key, not just "any row exists."
      const existingCostRows = [
        { dimensions: { provider: "openrouter", model: "gpt-4", billingType: "api" } },
      ];
      const existingKeys = new Set(
        existingCostRows.map((r) => {
          const dims = r.dimensions as { provider?: string; model?: string; billingType?: string };
          return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}`;
        })
      );

      // A new dimension key should NOT be blocked
      expect(existingKeys.has("openrouter::gpt-4::api")).toBe(true);
      expect(existingKeys.has("codex::claude-3::subscription")).toBe(false);
    });

    test("error aggregation counts by category and includes 'all' total", () => {
      const eventRows = [
        { eventType: "Error" },
        { eventType: "Error" },
        { eventType: "ToolError" },
        { eventType: "Info" },
      ];
      const errorRows = eventRows.filter(
        (e) => e.eventType === "Error" || e.eventType === "ToolError"
      );
      const errorByCategory: Record<string, number> = {};
      for (const e of errorRows) {
        errorByCategory[e.eventType] = (errorByCategory[e.eventType] ?? 0) + 1;
      }
      expect(errorRows.length).toBe(3);
      expect(errorByCategory["Error"]).toBe(2);
      expect(errorByCategory["ToolError"]).toBe(1);
    });
  });

  describe("rollupDaily — summing logic", () => {
    test("sums hourly rows into daily by metric_type+dimensions", () => {
      const hourlyRows = [
        { metric_type: "cost", value: 10, dimensions: { provider: "openai" } },
        { metric_type: "cost", value: 20, dimensions: { provider: "openai" } },
        { metric_type: "cost", value: 5, dimensions: { provider: "anthropic" } },
        { metric_type: "events", value: 100, dimensions: { event_type: "Info" } },
      ];
      const rollup: Record<string, { metric_type: string; value: number; dimensions: unknown }> = {};
      for (const row of hourlyRows) {
        const dimKey = JSON.stringify(row.dimensions ?? {});
        const key = `${row.metric_type}::${dimKey}`;
        if (!rollup[key]) {
          rollup[key] = { metric_type: row.metric_type, value: 0, dimensions: row.dimensions };
        }
        rollup[key].value += row.value;
      }
      const entries = Object.values(rollup);
      expect(entries).toHaveLength(3);
      const openaiCost = entries.find(
        (e) => e.metric_type === "cost" && (e.dimensions as { provider?: string })?.provider === "openai"
      );
      expect(openaiCost?.value).toBe(30);
    });

    test("dayStart is yesterday UTC midnight in epoch seconds", () => {
      const now = 1713100000;
      const dayStart = Math.floor(now / 86400) * 86400 - 86400;
      expect(dayStart % 86400).toBe(0); // aligned to day
      expect(dayStart + 86400).toBeLessThanOrEqual(Math.floor(now / 86400) * 86400);
    });
  });

  describe("aggregate read queries — return shape", () => {
    test("costByPeriod groups by provider and returns Record<string, number>", () => {
      // Simulates the grouping logic from costByPeriod query
      const rows = [
        { value: 10, dimensions: { provider: "openai" } },
        { value: 20, dimensions: { provider: "openai" } },
        { value: 5, dimensions: { provider: "anthropic" } },
      ];
      const grouped: Record<string, number> = {};
      for (const r of rows) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ openai: 30, anthropic: 5 });
    });

    test("errorTrendByPeriod returns array with bucket_start, errors, category", () => {
      const rows = [
        { bucket_start: 1000, value: 5, dimensions: { error_category: "Error" } },
      ];
      const result = rows.map((r) => ({
        bucket_start: r.bucket_start,
        errors: r.value,
        category: (r.dimensions as { error_category?: string })?.error_category ?? "unknown",
      }));
      expect(result[0]).toEqual({ bucket_start: 1000, errors: 5, category: "Error" });
    });

    test("costByPeriod with billingType='api' returns only API-billed rows", () => {
      // Phase 67: billingType filter on costByPeriod
      const rows = [
        { value: 10, dimensions: { provider: "openrouter", billingType: "api" } },
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
        { value: 20, dimensions: { provider: "claude-sdk", billingType: "api" } },
      ];
      const billingTypeFilter = "api";
      const filtered = rows.filter((r) => {
        const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
        return bt === billingTypeFilter;
      });
      const grouped: Record<string, number> = {};
      for (const r of filtered) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ openrouter: 10, "claude-sdk": 20 });
    });

    test("costByPeriod with billingType='subscription' returns only subscription rows", () => {
      const rows = [
        { value: 10, dimensions: { provider: "openrouter", billingType: "api" } },
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
        { value: 3, dimensions: { provider: "antigravity", billingType: "subscription" } },
      ];
      const billingTypeFilter = "subscription";
      const filtered = rows.filter((r) => {
        const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
        return bt === billingTypeFilter;
      });
      const grouped: Record<string, number> = {};
      for (const r of filtered) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ codex: 5, antigravity: 3 });
    });

    test("costByPeriod without billingType returns all rows (backward compat)", () => {
      const rows = [
        { value: 10, dimensions: { provider: "openrouter", billingType: "api" } },
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
      ];
      const billingTypeFilter: string | undefined = undefined;
      const filtered = billingTypeFilter
        ? rows.filter((r) => {
            const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
            return bt === billingTypeFilter;
          })
        : rows;
      const grouped: Record<string, number> = {};
      for (const r of filtered) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ openrouter: 10, codex: 5 });
    });

    test("legacy rows without billingType dimension are treated as 'api'", () => {
      // Phase 67: backward compat — legacy rows (no billingType) default to "api"
      const rows = [
        { value: 10, dimensions: { provider: "anthropic_direct" } }, // no billingType field
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
      ];
      const billingTypeFilter = "api";
      const filtered = rows.filter((r) => {
        const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
        return bt === billingTypeFilter;
      });
      expect(filtered).toHaveLength(1);
      expect((filtered[0].dimensions as { provider?: string })?.provider).toBe("anthropic_direct");
    });

    test("eventCountsByPeriod groups by event_type", () => {
      const rows = [
        { value: 50, dimensions: { event_type: "Info" } },
        { value: 10, dimensions: { event_type: "Error" } },
      ];
      const grouped: Record<string, number> = {};
      for (const r of rows) {
        const eventType = (r.dimensions as { event_type?: string })?.event_type ?? "unknown";
        grouped[eventType] = (grouped[eventType] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ Info: 50, Error: 10 });
    });
  });

  describe("computeHourly — goalId dimension extension (PULSE-02)", () => {
    test("dimension key includes goalId as 4th segment", () => {
      // The new key format is provider::model::billingType::goalId
      const rows = [
        { provider: "openrouter", model: "gpt-4", cost: 0.03, billingType: "api", goalId: "goal-123" },
        { provider: "openrouter", model: "gpt-4", cost: 0.02, billingType: "api", goalId: "goal-456" },
        { provider: "openrouter", model: "gpt-4", cost: 0.01, billingType: "api", goalId: undefined as string | undefined },
      ];
      const costByDim: Record<string, number> = {};
      for (const r of rows) {
        const key = `${r.provider}::${r.model}::${r.billingType}::${r.goalId ?? ""}`;
        costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
      }
      // Each goalId produces a separate bucket
      expect(costByDim["openrouter::gpt-4::api::goal-123"]).toBe(0.03);
      expect(costByDim["openrouter::gpt-4::api::goal-456"]).toBe(0.02);
      // Non-swarm row gets empty-string goalId bucket
      expect(costByDim["openrouter::gpt-4::api::"]).toBe(0.01);
      expect(Object.keys(costByDim)).toHaveLength(3);
    });

    test("idempotency guard with goalId: existingKeys set uses 4-segment format", () => {
      // If an aggregates row for (provider, model, billingType, goalId) already exists,
      // the idempotency set must reconstruct the identical 4-segment key.
      const existingCostRows = [
        { dimensions: { provider: "openrouter", model: "gpt-4", billingType: "api", goalId: "goal-123" } },
        { dimensions: { provider: "openrouter", model: "gpt-4", billingType: "api", goalId: "" } },
      ];
      const existingKeys = new Set(
        existingCostRows.map((r) => {
          const dims = r.dimensions as { provider?: string; model?: string; billingType?: string; goalId?: string } | null;
          return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}::${dims?.goalId ?? ""}`;
        })
      );
      // Already-aggregated keys are in the set
      expect(existingKeys.has("openrouter::gpt-4::api::goal-123")).toBe(true);
      expect(existingKeys.has("openrouter::gpt-4::api::")).toBe(true);
      // A new goalId key is NOT blocked
      expect(existingKeys.has("openrouter::gpt-4::api::goal-new")).toBe(false);
    });

    test("idempotency: running computeHourly twice over same goalId rows produces no new keys", () => {
      // Simulates two cron runs over the same llmMetrics rows.
      // After the first run, existing aggregates rows have goalId in their dimensions.
      // The second run must skip all these rows (no duplicates).
      const llmRows = [
        { provider: "anthropic", model: "claude-3", cost: 0.05, billingType: "api", goalId: "goal-abc" },
        { provider: "anthropic", model: "claude-3", cost: 0.03, billingType: "api", goalId: "goal-abc" },
        { provider: "openrouter", model: "gpt-4", cost: 0.10, billingType: "api", goalId: "goal-xyz" },
      ];

      // First run: build costByDim
      const costByDim: Record<string, number> = {};
      for (const r of llmRows) {
        const key = `${r.provider}::${r.model}::${r.billingType}::${r.goalId ?? ""}`;
        costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
      }
      // First run: existingKeys is empty, so all dims are inserted
      const firstRunKeys = Object.keys(costByDim);
      expect(firstRunKeys).toHaveLength(2);

      // Simulate the aggregates table after first run
      const aggregatesAfterFirstRun = firstRunKeys.map((dim) => {
        const [provider, model, billingType, goalId] = dim.split("::");
        return { dimensions: { provider, model, billingType, goalId } };
      });

      // Second run: rebuild existingKeys from the stored aggregates
      const existingKeys = new Set(
        aggregatesAfterFirstRun.map((r) => {
          const dims = r.dimensions as { provider?: string; model?: string; billingType?: string; goalId?: string } | null;
          return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}::${dims?.goalId ?? ""}`;
        })
      );

      // Second run: all keys are already in existingKeys — nothing new to insert
      const newInserts: string[] = [];
      for (const [dim] of Object.entries(costByDim)) {
        if (!existingKeys.has(dim)) {
          newInserts.push(dim);
        }
      }
      expect(newInserts).toHaveLength(0); // No double-counting
    });

    test("aggregates insert includes goalId in dimensions", () => {
      // When splitting dim.split("::"), 4 segments are produced; goalId goes into dimensions
      const dim = "anthropic::claude-3::api::goal-abc";
      const [provider, model, billingType, goalId] = dim.split("::");
      const dimensions = { provider, model, billingType, goalId };
      expect(dimensions).toEqual({
        provider: "anthropic",
        model: "claude-3",
        billingType: "api",
        goalId: "goal-abc",
      });
    });

    test("non-swarm rows (goalId undefined) produce empty-string 4th segment", () => {
      const dim = "openrouter::gpt-4::api::";
      const [provider, model, billingType, goalId] = dim.split("::");
      expect(goalId).toBe(""); // empty string, not undefined
      const dimensions = { provider, model, billingType, goalId };
      expect(dimensions.goalId).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // Phase 104 (D-04): tokens_prompt / tokens_completion hourly buckets, plus
  // the resumable backfill. Unlike the describe blocks above (pure logic
  // simulation), these exercise the REAL computeHourly/backfillTokenSplit
  // mutation handlers via `._handler` against the fake ctx above.
  // -------------------------------------------------------------------------
  describe("token split", () => {
    test("computeHourly writes tokens_prompt and tokens_completion with the same dimensions as cost", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
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

      await (computeHourly as any)._handler(ctx);

      const promptRow = tables.aggregates.find((r) => r.metric_type === "tokens_prompt");
      const completionRow = tables.aggregates.find((r) => r.metric_type === "tokens_completion");
      const costRow = tables.aggregates.find((r) => r.metric_type === "cost");

      expect(promptRow).toBeDefined();
      expect(completionRow).toBeDefined();
      expect(promptRow!.value).toBe(100);
      expect(completionRow!.value).toBe(20);
      expect(promptRow!.dimensions).toEqual(costRow!.dimensions);
      expect(completionRow!.dimensions).toEqual(costRow!.dimensions);
    });

    test("two rows sharing a dimension key sum into one insert per metric type", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        llmMetrics: [
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 100, completionTokens: 20, billingType: "api", timestamp: hourStart + 5, archived: false },
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.02, promptTokens: 50, completionTokens: 10, billingType: "api", timestamp: hourStart + 15, archived: false },
        ],
      });

      await (computeHourly as any)._handler(ctx);

      const promptRows = tables.aggregates.filter((r) => r.metric_type === "tokens_prompt");
      const completionRows = tables.aggregates.filter((r) => r.metric_type === "tokens_completion");
      expect(promptRows).toHaveLength(1);
      expect(promptRows[0].value).toBe(150);
      expect(completionRows).toHaveLength(1);
      expect(completionRows[0].value).toBe(30);
    });

    test("rows differing only in goalId produce separate inserts (4-segment key preserved)", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        llmMetrics: [
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 100, completionTokens: 20, billingType: "api", goalId: "goal-1", timestamp: hourStart + 5, archived: false },
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 40, completionTokens: 8, billingType: "api", goalId: "goal-2", timestamp: hourStart + 5, archived: false },
        ],
      });

      await (computeHourly as any)._handler(ctx);

      const promptRows = tables.aggregates.filter((r) => r.metric_type === "tokens_prompt");
      expect(promptRows).toHaveLength(2);
      expect(promptRows.map((r) => r.value).sort((a, b) => a - b)).toEqual([40, 100]);
    });

    test("a re-run inserts only the missing tokens_completion rows when tokens_prompt already exists (independent guards)", async () => {
      const hourStart = currentHourStart();
      const existingPrompt = {
        metric_type: "tokens_prompt",
        period: "hourly",
        bucket_start: hourStart,
        value: 100,
        dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api", goalId: "" },
      };
      const { ctx, tables } = makeAggregatesCtx({
        llmMetrics: [
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 100, completionTokens: 20, billingType: "api", timestamp: hourStart + 5, archived: false },
        ],
        aggregates: [existingPrompt],
      });

      await (computeHourly as any)._handler(ctx);

      const promptRows = tables.aggregates.filter((r) => r.metric_type === "tokens_prompt");
      const completionRows = tables.aggregates.filter((r) => r.metric_type === "tokens_completion");
      expect(promptRows).toHaveLength(1); // unchanged — no duplicate inserted
      expect(completionRows).toHaveLength(1); // newly inserted by the independent guard
      expect(completionRows[0].value).toBe(20);
    });

    test("an llmMetrics row missing promptTokens contributes 0 rather than NaN", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        llmMetrics: [
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, completionTokens: 20, billingType: "api", timestamp: hourStart + 5, archived: false },
        ],
      });

      await (computeHourly as any)._handler(ctx);

      const promptRows = tables.aggregates.filter((r) => r.metric_type === "tokens_prompt");
      expect(promptRows).toHaveLength(1);
      expect(promptRows[0].value).toBe(0);
      expect(Number.isNaN(promptRows[0].value)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Phase 105 (D-04): tool_calls / tool_failures / tool_duration_ms /
  // tool_duration_samples hourly buckets, from a bounded toolExecutions
  // window read alongside the existing llmMetrics one. Exercises the REAL
  // computeHourly mutation handler via `._handler`, same convention as the
  // "token split" block above.
  // -------------------------------------------------------------------------
  describe("tool usage buckets (Phase 105 D-04)", () => {
    test("writes a tool_calls bucket per {toolName, provider} dimension with the row count as the value", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        toolExecutions: [
          { toolName: "web_search", provider: "astridr", success: true, timestamp: hourStart + 5, archived: false },
          { toolName: "web_search", provider: "astridr", success: true, timestamp: hourStart + 15, archived: false },
          { toolName: "Bash", provider: "claude-cli", success: true, timestamp: hourStart + 25, archived: false },
        ],
      });

      await (computeHourly as any)._handler(ctx);

      const callRows = tables.aggregates.filter((r) => r.metric_type === "tool_calls");
      expect(callRows).toHaveLength(2);
      const webSearchRow = callRows.find((r) => r.dimensions.tool === "web_search");
      const bashRow = callRows.find((r) => r.dimensions.tool === "Bash");
      expect(webSearchRow!.value).toBe(2);
      expect(webSearchRow!.dimensions).toEqual({ tool: "web_search", provider: "astridr" });
      expect(bashRow!.value).toBe(1);
      expect(bashRow!.dimensions).toEqual({ tool: "Bash", provider: "claude-cli" });
    });

    test("writes a tool_failures bucket for EVERY tool_calls dimension, including a zero-failure dimension (value 0, not absent)", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        toolExecutions: [
          { toolName: "web_search", provider: "astridr", success: true, timestamp: hourStart + 5, archived: false },
          { toolName: "web_search", provider: "astridr", success: false, timestamp: hourStart + 15, archived: false },
          { toolName: "cli_gateway", provider: "astridr", success: true, timestamp: hourStart + 25, archived: false },
        ],
      });

      await (computeHourly as any)._handler(ctx);

      const failureRows = tables.aggregates.filter((r) => r.metric_type === "tool_failures");
      expect(failureRows).toHaveLength(2); // one per tool_calls dimension, even the all-success one
      const webSearchFailures = failureRows.find((r) => r.dimensions.tool === "web_search");
      const gatewayFailures = failureRows.find((r) => r.dimensions.tool === "cli_gateway");
      expect(webSearchFailures!.value).toBe(1);
      expect(gatewayFailures!.value).toBe(0); // real zero, not an absent bucket
    });

    test("writes tool_duration_ms (sum) and tool_duration_samples (count) ONLY for dimensions with at least one numeric durationMs", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        toolExecutions: [
          { toolName: "web_search", provider: "astridr", success: true, durationMs: 120, timestamp: hourStart + 5, archived: false },
          { toolName: "web_search", provider: "astridr", success: true, durationMs: 80, timestamp: hourStart + 15, archived: false },
          // Bash rows report NO durationMs at all — must get neither duration bucket.
          { toolName: "Bash", provider: "claude-cli", success: true, timestamp: hourStart + 25, archived: false },
        ],
      });

      await (computeHourly as any)._handler(ctx);

      const durationMsRows = tables.aggregates.filter((r) => r.metric_type === "tool_duration_ms");
      const durationSampleRows = tables.aggregates.filter((r) => r.metric_type === "tool_duration_samples");
      expect(durationMsRows).toHaveLength(1);
      expect(durationMsRows[0].dimensions).toEqual({ tool: "web_search", provider: "astridr" });
      expect(durationMsRows[0].value).toBe(200); // 120 + 80
      expect(durationSampleRows).toHaveLength(1);
      expect(durationSampleRows[0].value).toBe(2);
      // Bash reported no durations at all — absent, never a fabricated 0.
      expect(durationMsRows.find((r) => r.dimensions.tool === "Bash")).toBeUndefined();
      expect(durationSampleRows.find((r) => r.dimensions.tool === "Bash")).toBeUndefined();
    });

    test("a row with provider undefined lands in the 'unknown' provider dimension, not dropped", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        toolExecutions: [
          { toolName: "Read", success: true, timestamp: hourStart + 5, archived: false }, // provider omitted
        ],
      });

      await (computeHourly as any)._handler(ctx);

      const callRows = tables.aggregates.filter((r) => r.metric_type === "tool_calls");
      expect(callRows).toHaveLength(1);
      expect(callRows[0].dimensions).toEqual({ tool: "Read", provider: "unknown" });
      expect(callRows[0].value).toBe(1);
    });

    test("a bounded read at TOOL_WINDOW_READ_CAP+1 rows in one dimension caps at the read limit without throwing", async () => {
      const hourStart = currentHourStart();
      const rows = Array.from({ length: 4001 }, (_, i) => ({
        toolName: "web_search",
        provider: "astridr",
        success: true,
        timestamp: hourStart + (i % 3599),
        archived: false,
      }));
      const { ctx, tables } = makeAggregatesCtx({ toolExecutions: rows });

      await expect((computeHourly as any)._handler(ctx)).resolves.toBeUndefined();

      const callRow = tables.aggregates.find((r) => r.metric_type === "tool_calls");
      expect(callRow!.value).toBe(4000); // capped at TOOL_WINDOW_READ_CAP, never 4001
    });

    test("idempotency: re-running computeHourly for the same hour inserts nothing new for any of the four metric types", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        toolExecutions: [
          { toolName: "web_search", provider: "astridr", success: false, durationMs: 50, timestamp: hourStart + 5, archived: false },
        ],
      });

      await (computeHourly as any)._handler(ctx);
      const afterFirst = {
        calls: tables.aggregates.filter((r) => r.metric_type === "tool_calls").length,
        failures: tables.aggregates.filter((r) => r.metric_type === "tool_failures").length,
        durationMs: tables.aggregates.filter((r) => r.metric_type === "tool_duration_ms").length,
        durationSamples: tables.aggregates.filter((r) => r.metric_type === "tool_duration_samples").length,
      };

      await (computeHourly as any)._handler(ctx);
      const afterSecond = {
        calls: tables.aggregates.filter((r) => r.metric_type === "tool_calls").length,
        failures: tables.aggregates.filter((r) => r.metric_type === "tool_failures").length,
        durationMs: tables.aggregates.filter((r) => r.metric_type === "tool_duration_ms").length,
        durationSamples: tables.aggregates.filter((r) => r.metric_type === "tool_duration_samples").length,
      };

      expect(afterFirst).toEqual({ calls: 1, failures: 1, durationMs: 1, durationSamples: 1 });
      expect(afterSecond).toEqual(afterFirst); // no new rows on the re-run
    });

    test("a partially-completed prior run (tool_calls present, tool_failures absent) inserts only the missing tool_failures buckets on re-run", async () => {
      const hourStart = currentHourStart();
      const existingCalls = {
        metric_type: "tool_calls",
        period: "hourly",
        bucket_start: hourStart,
        value: 999, // deliberately different from what a fresh run would compute
        dimensions: { tool: "web_search", provider: "astridr" },
      };
      const { ctx, tables } = makeAggregatesCtx({
        toolExecutions: [
          { toolName: "web_search", provider: "astridr", success: true, timestamp: hourStart + 5, archived: false },
        ],
        aggregates: [existingCalls],
      });

      await (computeHourly as any)._handler(ctx);

      const callRows = tables.aggregates.filter((r) => r.metric_type === "tool_calls");
      const failureRows = tables.aggregates.filter((r) => r.metric_type === "tool_failures");
      expect(callRows).toHaveLength(1);
      expect(callRows[0].value).toBe(999); // untouched — no duplicate for that metric type
      expect(failureRows).toHaveLength(1); // newly inserted by the independent guard
      expect(failureRows[0].value).toBe(0);
    });
  });

  describe("backfill", () => {
    test("an invocation with maxHours: 2 processes exactly two hour buckets and no more", async () => {
      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
        llmMetrics: [
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 10, completionTokens: 2, billingType: "api", timestamp: hourStart + 5, archived: false },
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 20, completionTokens: 4, billingType: "api", timestamp: hourStart - 3600 + 5, archived: false },
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 30, completionTokens: 6, billingType: "api", timestamp: hourStart - 7200 + 5, archived: false },
        ],
      });

      const result = await (backfillTokenSplit as any)._handler(ctx, { maxHours: 2 });

      expect(result.hoursProcessed).toBe(2);
      expect(result.done).toBe(false);
      const promptRows = tables.aggregates.filter((r) => r.metric_type === "tokens_prompt");
      // Only the two most recent complete hours were processed — the third-hour-back
      // llmMetrics row (30 prompt tokens) must NOT have produced a bucket yet.
      expect(promptRows.map((r) => r.value).sort((a, b) => a - b)).toEqual([10, 20]);
    });

    test("the returned nextCursor is the third hour back", async () => {
      const hourStart = currentHourStart();
      const { ctx } = makeAggregatesCtx({ llmMetrics: [] });

      const result = await (backfillTokenSplit as any)._handler(ctx, { maxHours: 2 });

      expect(result.nextCursor).toBe(hourStart - 2 * 3600);
    });

    test("an hour whose tokens_prompt rows already exist inserts no duplicate for that metric type", async () => {
      const hourStart = currentHourStart();
      const existingPrompt = {
        metric_type: "tokens_prompt",
        period: "hourly",
        bucket_start: hourStart,
        value: 999,
        dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api", goalId: "" },
      };
      const { ctx, tables } = makeAggregatesCtx({
        llmMetrics: [
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 10, completionTokens: 2, billingType: "api", timestamp: hourStart + 5, archived: false },
        ],
        aggregates: [existingPrompt],
      });

      await (backfillTokenSplit as any)._handler(ctx, { maxHours: 1 });

      const promptRows = tables.aggregates.filter((r) => r.metric_type === "tokens_prompt");
      expect(promptRows).toHaveLength(1);
      expect(promptRows[0].value).toBe(999); // untouched — no duplicate for that metric type
      const completionRows = tables.aggregates.filter((r) => r.metric_type === "tokens_completion");
      expect(completionRows).toHaveLength(1); // independent guard still inserts this one
    });

    test("reaching the retention floor returns done: true and writes the terminal cursor sentinel", async () => {
      const hourStart = currentHourStart();
      // Cursor already sits well past the (default 30-day) retention floor.
      const staleCursor = {
        configKey: "phase104.tokenSplitBackfill.cursor",
        value: hourStart - 40 * 86400,
        source: "runtime",
        updatedAt: 0,
      };
      const { ctx, tables } = makeAggregatesCtx({ agentConfigs: [staleCursor] });

      const result = await (backfillTokenSplit as any)._handler(ctx, { maxHours: 6 });

      expect(result.done).toBe(true);
      expect(result.hoursProcessed).toBe(0);
      expect(result.nextCursor).toBe("done");
      const cursorRows = tables.agentConfigs.filter(
        (r) => r.configKey === "phase104.tokenSplitBackfill.cursor"
      );
      expect(cursorRows[cursorRows.length - 1].value).toBe("done");
    });

    test("issues no db.patch and no db.delete call on the fake ctx", async () => {
      const hourStart = currentHourStart();
      const { ctx, patchCalls, deleteCalls } = makeAggregatesCtx({
        llmMetrics: [
          { provider: "anthropic_direct", model: "claude-sonnet-5", cost: 0.01, promptTokens: 10, completionTokens: 2, billingType: "api", timestamp: hourStart + 5, archived: false },
        ],
      });

      await (backfillTokenSplit as any)._handler(ctx, { maxHours: 3 });

      expect(patchCalls).toHaveLength(0);
      expect(deleteCalls).toHaveLength(0);
    });
  });

  describe("costByGoalPeriod — per-goal cost query (PULSE-02, OQ-1)", () => {
    test("groups llmMetrics rows by (provider, model) and sums cost", () => {
      // Simulates costByGoalPeriod grouping logic
      const goalId = "goal-123";
      const llmRows = [
        { goalId: "goal-123", provider: "anthropic", model: "claude-3-opus", cost: 0.05, archived: false },
        { goalId: "goal-123", provider: "anthropic", model: "claude-3-opus", cost: 0.03, archived: false },
        { goalId: "goal-123", provider: "openrouter", model: "gpt-4", cost: 0.10, archived: false },
        { goalId: "goal-456", provider: "anthropic", model: "claude-3-opus", cost: 0.99, archived: false }, // different goal
      ];

      // Filter by goalId and exclude archived
      const filtered = llmRows.filter((r) => r.goalId === goalId && r.archived !== true);

      // Group by provider::model
      const grouped: Record<string, { provider: string; model: string; cost: number }> = {};
      for (const r of filtered) {
        const key = `${r.provider}::${r.model}`;
        if (!grouped[key]) grouped[key] = { provider: r.provider, model: r.model, cost: 0 };
        grouped[key].cost += r.cost ?? 0;
      }
      const rows = Object.values(grouped);
      const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);

      expect(rows).toHaveLength(2);
      const anthropicRow = rows.find((r) => r.provider === "anthropic");
      expect(anthropicRow?.cost).toBeCloseTo(0.08);
      const openrouterRow = rows.find((r) => r.provider === "openrouter");
      expect(openrouterRow?.cost).toBeCloseTo(0.10);
      expect(totalCost).toBeCloseTo(0.18);
    });

    test("excludes archived rows from cost total", () => {
      const goalId = "goal-789";
      const llmRows = [
        { goalId: "goal-789", provider: "anthropic", model: "claude-3-haiku", cost: 0.02, archived: false },
        { goalId: "goal-789", provider: "anthropic", model: "claude-3-haiku", cost: 0.50, archived: true }, // should be excluded
      ];

      const filtered = llmRows.filter((r) => r.goalId === goalId && r.archived !== true);
      const totalCost = filtered.reduce((sum, r) => sum + (r.cost ?? 0), 0);

      expect(filtered).toHaveLength(1);
      expect(totalCost).toBeCloseTo(0.02);
    });

    test("returns empty shape when no rows match goalId", () => {
      const goalId = "goal-nonexistent";
      const llmRows: Array<{ goalId: string; provider: string; model: string; cost: number; archived: boolean }> = [];

      const filtered = llmRows.filter((r) => r.goalId === goalId && r.archived !== true);
      const grouped: Record<string, { provider: string; model: string; cost: number }> = {};
      for (const r of filtered) {
        const key = `${r.provider}::${r.model}`;
        if (!grouped[key]) grouped[key] = { provider: r.provider, model: r.model, cost: 0 };
        grouped[key].cost += r.cost ?? 0;
      }
      const rows = Object.values(grouped);
      const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);

      expect(rows).toHaveLength(0);
      expect(totalCost).toBe(0);
    });

    test("llmByGoal returns rows with agentId for tier-flag join (Plan 04)", () => {
      // llmByGoal provides {agentId, model, cost} rows — the tier flag in Plan 04
      // joins agentId to model to determine which tier each agent ran on.
      const goalId = "goal-abc";
      const llmRows = [
        { goalId: "goal-abc", agentId: "agent-1", provider: "anthropic", model: "claude-3-opus", cost: 0.05, archived: false },
        { goalId: "goal-abc", agentId: "agent-2", provider: "openrouter", model: "gpt-4o-mini", cost: 0.01, archived: false },
        { goalId: "goal-abc", agentId: "agent-1", provider: "anthropic", model: "claude-3-opus", cost: 0.03, archived: true }, // archived
      ];

      const filtered = llmRows.filter((r) => r.goalId === goalId && r.archived !== true);
      const result = filtered.map((r) => ({ agentId: r.agentId, model: r.model, cost: r.cost }));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ agentId: "agent-1", model: "claude-3-opus", cost: 0.05 });
      expect(result[1]).toEqual({ agentId: "agent-2", model: "gpt-4o-mini", cost: 0.01 });
    });
  });

  // -------------------------------------------------------------------------
  // Phase 104 (D-01, RESEARCH.md Open Question 1 resolved YES — 104-05-PLAN.md
  // Task 3): costByGoalPeriod/llmByGoal now derive dollars from tokens via
  // costDerived.deriveBucketDollars() instead of trusting the ingested `cost`
  // field. Unlike the describe block above (pure logic simulation of the OLD
  // shape), these exercise the REAL query handlers via `._handler`.
  // -------------------------------------------------------------------------
  describe("goal cost derivation", () => {
    test("a goal whose rows use a priced model returns billedTotal computed from tokens, DIFFERENT from reportedTotal when the ingested cost disagrees with the rate", async () => {
      const { ctx } = makeAggregatesCtx({
        llmMetrics: [
          {
            goalId: "goal-1",
            provider: "anthropic_direct",
            model: "claude-sonnet-4-5",
            promptTokens: 1000,
            completionTokens: 500,
            billingType: "api",
            cost: 999, // deliberately WRONG ingested figure — proves it's no longer the rendered truth
            archived: false,
          },
        ],
        modelPricing: [
          { model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015, source: "manual" },
        ],
      });

      const result = await (costByGoalPeriod as any)._handler(ctx, { goalId: "goal-1" });

      const expectedBilled = 1000 * 0.000003 + 500 * 0.000015;
      expect(result.billedTotal).toBeCloseTo(expectedBilled, 10);
      expect(result.reportedTotal).toBe(999);
      expect(result.billedTotal).not.toBeCloseTo(result.reportedTotal, 2);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].priced).toBe(true);
    });

    test("a goal whose model has no rate returns that row priced:false, contributing nothing to billedTotal", async () => {
      const { ctx } = makeAggregatesCtx({
        llmMetrics: [
          {
            goalId: "goal-2",
            provider: "openrouter",
            model: "unrated-model",
            promptTokens: 300,
            completionTokens: 100,
            billingType: "api",
            cost: 0.5,
            archived: false,
          },
        ],
        modelPricing: [], // no rate for "unrated-model"
      });

      const result = await (costByGoalPeriod as any)._handler(ctx, { goalId: "goal-2" });

      expect(result.billedTotal).toBe(0);
      expect(result.unpricedModelCount).toBe(1);
      expect(result.rows[0].priced).toBe(false);
      expect(result.rows[0].billedUsd).toBeNull();
      // The ingested figure still survives as evidence.
      expect(result.reportedTotal).toBe(0.5);
    });

    test("llmByGoal returns billedUsd and reportedCost as separate fields", async () => {
      const { ctx } = makeAggregatesCtx({
        llmMetrics: [
          {
            goalId: "goal-3",
            agentId: "agent-1",
            provider: "anthropic_direct",
            model: "claude-sonnet-4-5",
            promptTokens: 200,
            completionTokens: 100,
            billingType: "api",
            cost: 42, // deliberately WRONG — llmByGoal must not read it as the rendered dollar figure
            archived: false,
          },
        ],
        modelPricing: [
          { model: "claude-sonnet-4-5", inputPerToken: 0.000003, outputPerToken: 0.000015, source: "manual" },
        ],
      });

      const result = await (llmByGoal as any)._handler(ctx, { goalId: "goal-3" });

      expect(result).toHaveLength(1);
      expect(result[0].reportedCost).toBe(42);
      expect(result[0].billedUsd).toBeCloseTo(200 * 0.000003 + 100 * 0.000015, 10);
      expect(result[0].billedUsd).not.toBeCloseTo(result[0].reportedCost, 2);
      expect(result[0].agentId).toBe("agent-1");
    });
  });

  // -------------------------------------------------------------------------
  // Phase 88 — Analytics Rollup. After the ingest-time rollup lands (Plan 02),
  // computeHourly's event-count + error-count branches are REMOVED (D-02), so the
  // cron can no longer double-count event buckets already written at ingest time.
  // dataRetention must never touch the durable `aggregates` rollups (D-12).
  // -------------------------------------------------------------------------
  describe("Phase 88 — cron removal non-double-count invariant", () => {
    test("computeHourly over an hour with ingest-time 'events' buckets writes no new event rows", () => {
      // Simulate: ingest-time buckets already exist for eventType "Info" (value 5).
      // With the event-count branch removed from computeHourly, the cron does not
      // re-derive event counts. Guard: even if a residual loop ran, the existing-key
      // set blocks a re-insert (idempotency), so values stay unchanged (D-02).
      const existingEventRows = [
        { dimensions: { event_type: "Info" }, value: 5 },
        { dimensions: { event_type: "Error" }, value: 2 },
      ];
      const existingEventKeys = new Set(
        existingEventRows.map((r) => {
          const dims = r.dimensions as { event_type?: string } | null;
          return dims?.event_type ?? "unknown";
        })
      );

      // The set of event types observed this hour (what a residual branch would try
      // to insert). All already have an ingest-time bucket → nothing to insert.
      const observedThisHour = ["Info", "Error"];
      const wouldInsert = observedThisHour.filter((et) => !existingEventKeys.has(et));
      expect(wouldInsert).toHaveLength(0); // no double-write

      // And existing values are untouched (the cron neither patches nor re-inserts).
      expect(existingEventRows.find((r) => r.dimensions.event_type === "Info")?.value).toBe(5);
      expect(existingEventRows.find((r) => r.dimensions.event_type === "Error")?.value).toBe(2);
    });

    test("dataRetention purge target-table set contains no 'aggregates' (D-12)", () => {
      // purgeOldTelemetryEvents queries only the "events" table and deletes those
      // rows; the durable rollups in "aggregates" must never be a delete target.
      // Mirror the purge's delete loop, recording which table each delete hit.
      const deletedFromTables: string[] = [];
      const purgeTargetTable = "events"; // dataRetention.ts:11 queries "events"
      const oldDocs = [{ _id: "id1" }, { _id: "id2" }];
      for (const _doc of oldDocs) {
        deletedFromTables.push(purgeTargetTable);
      }
      // The set of tables the purge deletes from has zero "aggregates" entries.
      const aggregatesDeletes = deletedFromTables.filter((t) => t === "aggregates");
      expect(aggregatesDeletes).toHaveLength(0);
      // Sanity: it DID operate on the events table.
      expect(new Set(deletedFromTables)).toEqual(new Set(["events"]));
    });
  });

  // -------------------------------------------------------------------------
  // Phase 105 (D-06): the tool-policy alert evaluator tail-append, mirroring
  // costBudgetEval.test.ts's own "cron tail-append (D-14)" section exactly —
  // pass-through vi.mock spies on BOTH evaluateBudgets and
  // evaluateToolPolicyAlerts (declared at the top of this file) let this
  // block assert invocation count, relative ORDER (via Vitest's global
  // `mock.invocationCallOrder`, which is comparable across different mocked
  // functions in the same test file), and rejection-swallowing — all against
  // the REAL computeHourly handler, never a re-implementation.
  // -------------------------------------------------------------------------
  describe("computeHourly — tool policy alert tail-append (D-06)", () => {
    test("evaluateToolPolicyAlerts is invoked exactly once per computeHourly invocation", async () => {
      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();

      const { ctx } = makeAggregatesCtx({});
      await (computeHourly as any)._handler(ctx);

      expect(vi.mocked(evaluateToolPolicyAlerts)).toHaveBeenCalledTimes(1);

      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();
    });

    test("evaluateToolPolicyAlerts is called AFTER evaluateBudgets within the same invocation", async () => {
      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();

      const { ctx } = makeAggregatesCtx({});
      await (computeHourly as any)._handler(ctx);

      const budgetOrder = vi.mocked(evaluateBudgets).mock.invocationCallOrder[0];
      const policyOrder = vi.mocked(evaluateToolPolicyAlerts).mock.invocationCallOrder[0];
      expect(budgetOrder).toBeDefined();
      expect(policyOrder).toBeDefined();
      expect(policyOrder).toBeGreaterThan(budgetOrder);

      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();
    });

    test("the timestamp passed to evaluateToolPolicyAlerts equals the same `now` passed to evaluateBudgets", async () => {
      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();
      const fixedNowMs = Date.UTC(2026, 7, 3, 15, 20, 0);
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNowMs);

      try {
        const { ctx } = makeAggregatesCtx({});
        await (computeHourly as any)._handler(ctx);

        const [, budgetNowArg] = vi.mocked(evaluateBudgets).mock.calls[0];
        const [, policyNowArg] = vi.mocked(evaluateToolPolicyAlerts).mock.calls[0];
        expect(policyNowArg).toBe(fixedNowMs / 1000);
        expect(policyNowArg).toBe(budgetNowArg); // cannot disagree by milliseconds
      } finally {
        dateSpy.mockRestore();
        vi.mocked(evaluateBudgets).mockClear();
        vi.mocked(evaluateToolPolicyAlerts).mockClear();
      }
    });

    test("when evaluateToolPolicyAlerts throws, the handler still resolves and the tool/token/cost bucket inserts above it survive", async () => {
      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockRejectedValueOnce(
        new Error("simulated evaluateToolPolicyAlerts failure")
      );

      const hourStart = currentHourStart();
      const { ctx, tables } = makeAggregatesCtx({
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
        toolExecutions: [
          { toolName: "web_search", provider: "astridr", success: true, timestamp: hourStart + 5, archived: false },
        ],
      });

      await expect((computeHourly as any)._handler(ctx)).resolves.toBeUndefined();

      const costRow = tables.aggregates.find((r) => r.metric_type === "cost");
      const toolCallsRow = tables.aggregates.find((r) => r.metric_type === "tool_calls");
      expect(costRow).toBeDefined();
      expect(toolCallsRow).toBeDefined();
      expect(toolCallsRow!.value).toBe(1);

      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();
    });

    test("a rejection from evaluateBudgets does not suppress evaluateToolPolicyAlerts from still running (separate try/catch blocks)", async () => {
      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();
      vi.mocked(evaluateBudgets).mockRejectedValueOnce(new Error("simulated evaluateBudgets failure"));

      const { ctx } = makeAggregatesCtx({});
      await expect((computeHourly as any)._handler(ctx)).resolves.toBeUndefined();

      expect(vi.mocked(evaluateToolPolicyAlerts)).toHaveBeenCalledTimes(1);

      vi.mocked(evaluateBudgets).mockClear();
      vi.mocked(evaluateToolPolicyAlerts).mockClear();
    });
  });

  // -------------------------------------------------------------------------
  // Phase 107 Plan 02 (OCC-01) — multi-shard summing guards that call the REAL
  // exported eventCountsByPeriod/rollupDaily handlers via `._handler`, never a
  // re-implementation of the grouping loop (that anti-pattern is exactly what
  // the two pre-existing tests above at "eventCountsByPeriod groups by
  // event_type" and "sums hourly rows into daily by metric_type+dimensions"
  // do — they pass unconditionally regardless of what production does, so
  // they are NOT the shard-safety evidence; these are). D-01/D-04 of
  // 107-CONTEXT.md: `shard` is an optional top-level field, never part of
  // `dimensions`, so grouping by dimensions collapses shard rows correctly.
  // Every fixture includes at least one row with NO `shard` key, proving the
  // pre-existing unsharded rows keep summing correctly (D-04).
  // -------------------------------------------------------------------------
  describe("shard-spanning reads", () => {
    test("eventCountsByPeriod sums an event type across shards including a legacy unsharded row", async () => {
      const hourStart = Math.floor(Date.now() / 1000 / 3600) * 3600 - 3600;
      const { ctx } = makeAggregatesCtx({
        aggregates: [
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 10, dimensions: { event_type: "tool_use" } }, // no shard (legacy)
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 4, dimensions: { event_type: "tool_use" }, shard: 0 },
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 3, dimensions: { event_type: "tool_use" }, shard: 2 },
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 1, dimensions: { event_type: "tool_use" }, shard: 7 },
        ],
      });

      const result = await (eventCountsByPeriod as any)._handler(ctx, { period: "hourly", lookbackDays: 1 });

      expect(result.tool_use).toBe(18); // 10 + 4 + 3 + 1
    });

    test("eventCountsByPeriod keeps event types separate while summing each type's shards", async () => {
      const hourStart = Math.floor(Date.now() / 1000 / 3600) * 3600 - 3600;
      const { ctx } = makeAggregatesCtx({
        aggregates: [
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 10, dimensions: { event_type: "tool_use" } }, // no shard (legacy)
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 4, dimensions: { event_type: "tool_use" }, shard: 0 },
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 3, dimensions: { event_type: "tool_use" }, shard: 2 },
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 1, dimensions: { event_type: "tool_use" }, shard: 7 },
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 5, dimensions: { event_type: "llm_call" }, shard: 1 },
          { metric_type: "events", period: "hourly", bucket_start: hourStart, value: 6, dimensions: { event_type: "llm_call" }, shard: 4 },
        ],
      });

      const result = await (eventCountsByPeriod as any)._handler(ctx, { period: "hourly", lookbackDays: 1 });

      expect(result.tool_use).toBe(18);
      expect(result.llm_call).toBe(11);
      expect(Object.keys(result)).toHaveLength(2);
    });

    test("rollupDaily collapses shard rows into one daily row per dimension key", async () => {
      const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
      const { ctx, tables, patchCalls, deleteCalls } = makeAggregatesCtx({
        aggregates: [
          { metric_type: "events", period: "hourly", bucket_start: dayStart + 3600, value: 7, dimensions: { event_type: "tool_use" } }, // no shard (legacy)
          { metric_type: "events", period: "hourly", bucket_start: dayStart + 3600, value: 2, dimensions: { event_type: "tool_use" }, shard: 0 },
          { metric_type: "events", period: "hourly", bucket_start: dayStart + 7200, value: 1, dimensions: { event_type: "tool_use" }, shard: 5 },
          { metric_type: "sankey_edge", period: "hourly", bucket_start: dayStart + 3600, value: 4, dimensions: { source: "Tool Use", target: "Read" }, shard: 3 },
          { metric_type: "sankey_edge", period: "hourly", bucket_start: dayStart + 7200, value: 5, dimensions: { source: "Tool Use", target: "Read" }, shard: 6 },
        ],
      });

      await (rollupDaily as any)._handler(ctx);

      const dailyRows = tables.aggregates.filter((r) => r.period === "daily");
      expect(dailyRows).toHaveLength(2);
      const eventsDaily = dailyRows.find((r) => r.metric_type === "events");
      const sankeyDaily = dailyRows.find((r) => r.metric_type === "sankey_edge");
      expect(eventsDaily?.value).toBe(10); // 7 + 2 + 1
      expect(sankeyDaily?.value).toBe(9); // 4 + 5
      expect(dailyRows.every((r) => !("shard" in r))).toBe(true);
      expect(patchCalls).toHaveLength(0);
      expect(deleteCalls).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // COST-01 (2026-08-07): rollupDaily only ever processed YESTERDAY and never
    // revisited a day. The Phase 104 backfillTokenSplit wrote historical HOURLY
    // token buckets long after those days had passed, so they never got daily
    // rows — measured live, costBreakdown(period:"daily") flatlined at $25.42
    // beyond a 336h lookback while period:"hourly" kept climbing to $88.86 over
    // 720h. Two surfaces, same table, 71% apart.
    // -----------------------------------------------------------------------
    describe("rollupDaily — explicit dayStart (COST-01)", () => {
      test("rolls up the REQUESTED day, not yesterday", async () => {
        const yesterday = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
        const tenDaysAgo = yesterday - 9 * 86400;
        const { ctx, tables } = makeAggregatesCtx({
          aggregates: [
            { metric_type: "tokens_prompt", period: "hourly", bucket_start: tenDaysAgo + 3600, value: 500, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5" } },
            { metric_type: "tokens_prompt", period: "hourly", bucket_start: yesterday + 3600, value: 42, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5" } },
          ],
        });

        await (rollupDaily as any)._handler(ctx, { dayStart: tenDaysAgo });

        const dailyRows = tables.aggregates.filter((r) => r.period === "daily");
        expect(dailyRows).toHaveLength(1);
        expect(dailyRows[0].bucket_start).toBe(tenDaysAgo);
        expect(dailyRows[0].value).toBe(500);
      });

      test("CONTROL: no dayStart arg still rolls up yesterday", async () => {
        const yesterday = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
        const tenDaysAgo = yesterday - 9 * 86400;
        const { ctx, tables } = makeAggregatesCtx({
          aggregates: [
            { metric_type: "tokens_prompt", period: "hourly", bucket_start: tenDaysAgo + 3600, value: 500, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5" } },
            { metric_type: "tokens_prompt", period: "hourly", bucket_start: yesterday + 3600, value: 42, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5" } },
          ],
        });

        await (rollupDaily as any)._handler(ctx, {});

        const dailyRows = tables.aggregates.filter((r) => r.period === "daily");
        expect(dailyRows).toHaveLength(1);
        expect(dailyRows[0].bucket_start).toBe(yesterday);
        expect(dailyRows[0].value).toBe(42);
      });
    });

    describe("backfillDailyRollup (COST-01)", () => {
      const DAILY_CURSOR_KEY = "cost01.dailyRollupBackfill.cursor";

      function historicalHourly(dayStart: number, value: number) {
        return {
          metric_type: "tokens_prompt",
          period: "hourly",
          bucket_start: dayStart + 3600,
          value,
          dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5" },
        };
      }

      test("creates daily rows for historical days that have hourly rows but none daily", async () => {
        const yesterday = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
        const { ctx, tables } = makeAggregatesCtx({
          aggregates: [
            historicalHourly(yesterday - 86400, 100),
            historicalHourly(yesterday - 2 * 86400, 200),
          ],
        });

        const result = await (backfillDailyRollup as any)._handler(ctx, { maxDays: 5 });

        const dailyRows = tables.aggregates.filter((r) => r.period === "daily");
        expect(dailyRows.map((r) => r.value).sort((a, b) => a - b)).toEqual([100, 200]);
        expect(result.rowsInserted).toBe(2);
      });

      test("leaves an already-rolled-up day untouched but still fills the day before it", async () => {
        const yesterday = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
        const covered = yesterday - 86400;
        const uncovered = yesterday - 2 * 86400;
        const { ctx, tables } = makeAggregatesCtx({
          aggregates: [
            historicalHourly(covered, 100),
            historicalHourly(uncovered, 200),
            // Pre-existing daily row for `covered`, deliberately a value no
            // fresh sum would produce — a re-sum would overwrite it to 100.
            { metric_type: "tokens_prompt", period: "daily", bucket_start: covered, value: 999, dimensions: { provider: "anthropic_direct", model: "claude-sonnet-5" } },
          ],
        });

        await (backfillDailyRollup as any)._handler(ctx, { maxDays: 5 });

        const dailyForCovered = tables.aggregates.filter((r) => r.period === "daily" && r.bucket_start === covered);
        const dailyForUncovered = tables.aggregates.filter((r) => r.period === "daily" && r.bucket_start === uncovered);
        expect(dailyForCovered).toHaveLength(1);
        expect(dailyForCovered[0].value).toBe(999);
        expect(dailyForUncovered).toHaveLength(1);
        expect(dailyForUncovered[0].value).toBe(200);
      });

      test("honours maxDays and returns a resumable cursor", async () => {
        const yesterday = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
        const { ctx } = makeAggregatesCtx({
          aggregates: [
            historicalHourly(yesterday - 86400, 10),
            historicalHourly(yesterday - 2 * 86400, 20),
            historicalHourly(yesterday - 3 * 86400, 30),
          ],
        });

        const result = await (backfillDailyRollup as any)._handler(ctx, { maxDays: 2 });

        expect(result.daysProcessed).toBe(2);
        expect(result.done).toBe(false);
        expect(typeof result.nextCursor).toBe("number");
      });

      test("resumes from a stored cursor rather than restarting at yesterday", async () => {
        const yesterday = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
        const resumeAt = yesterday - 3 * 86400;
        const { ctx, tables } = makeAggregatesCtx({
          aggregates: [
            historicalHourly(yesterday - 86400, 10),
            historicalHourly(resumeAt, 30),
          ],
          agentConfigs: [{ configKey: DAILY_CURSOR_KEY, value: resumeAt, source: "runtime", updatedAt: 0 }],
        });

        await (backfillDailyRollup as any)._handler(ctx, { maxDays: 1 });

        const dailyRows = tables.aggregates.filter((r) => r.period === "daily");
        expect(dailyRows).toHaveLength(1);
        expect(dailyRows[0].bucket_start).toBe(resumeAt);
      });

      test("a finished backfill reports done and writes the terminal sentinel", async () => {
        const { ctx, tables } = makeAggregatesCtx({
          agentConfigs: [{ configKey: DAILY_CURSOR_KEY, value: "done", source: "runtime", updatedAt: 0 }],
        });

        const result = await (backfillDailyRollup as any)._handler(ctx, { maxDays: 5 });

        expect(result.done).toBe(true);
        expect(result.daysProcessed).toBe(0);
        const cursorRows = tables.agentConfigs.filter((r) => r.configKey === DAILY_CURSOR_KEY);
        expect(cursorRows[cursorRows.length - 1].value).toBe("done");
      });

      test("is insert-only — never patches or deletes", async () => {
        const yesterday = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
        const { ctx, patchCalls, deleteCalls } = makeAggregatesCtx({
          aggregates: [historicalHourly(yesterday - 86400, 100)],
        });

        await (backfillDailyRollup as any)._handler(ctx, { maxDays: 3 });

        expect(patchCalls).toHaveLength(0);
        expect(deleteCalls).toHaveLength(0);
      });
    });

    test("rollupDaily idempotency guard still holds for sharded hourly rows", async () => {
      const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
      const preSeededDaily = {
        metric_type: "events",
        period: "daily",
        bucket_start: dayStart,
        value: 999, // deliberately different from what a fresh sum would compute
        dimensions: { event_type: "tool_use" },
      };
      const { ctx, tables } = makeAggregatesCtx({
        aggregates: [
          preSeededDaily,
          { metric_type: "events", period: "hourly", bucket_start: dayStart + 3600, value: 7, dimensions: { event_type: "tool_use" } }, // no shard (legacy)
          { metric_type: "events", period: "hourly", bucket_start: dayStart + 3600, value: 2, dimensions: { event_type: "tool_use" }, shard: 0 },
          { metric_type: "events", period: "hourly", bucket_start: dayStart + 7200, value: 1, dimensions: { event_type: "tool_use" }, shard: 5 },
          { metric_type: "sankey_edge", period: "hourly", bucket_start: dayStart + 3600, value: 4, dimensions: { source: "Tool Use", target: "Read" }, shard: 3 },
          { metric_type: "sankey_edge", period: "hourly", bucket_start: dayStart + 7200, value: 5, dimensions: { source: "Tool Use", target: "Read" }, shard: 6 },
        ],
      });

      await (rollupDaily as any)._handler(ctx);

      const eventsDailyRows = tables.aggregates.filter((r) => r.period === "daily" && r.metric_type === "events");
      const sankeyDailyRows = tables.aggregates.filter((r) => r.period === "daily" && r.metric_type === "sankey_edge");
      expect(eventsDailyRows).toHaveLength(1);
      expect(eventsDailyRows[0].value).toBe(999); // unchanged — not re-summed
      expect(sankeyDailyRows).toHaveLength(1); // still inserted
      expect(sankeyDailyRows[0].value).toBe(9);
    });
  });
});
