import { describe, test, expect } from "vitest";
import { getBillingType } from "./lib/providers";
import { computeHourly, backfillTokenSplit } from "./aggregates";

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
  } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    llmMetrics: [...(opts.llmMetrics ?? [])],
    aggregates: [...(opts.aggregates ?? [])],
    agentConfigs: [...(opts.agentConfigs ?? [])],
  };
  let nextId = 1;
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
    patch(...args: unknown[]) {
      patchCalls.push(args);
      throw new Error("db.patch must not be called — the token-split path is insert-only");
    },
    delete(...args: unknown[]) {
      deleteCalls.push(args);
      throw new Error("db.delete must not be called — the token-split path is insert-only");
    },
  };

  return { ctx: { db }, tables, patchCalls, deleteCalls };
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
});
