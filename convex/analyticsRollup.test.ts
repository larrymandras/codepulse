import { describe, test, expect, beforeAll } from "vitest";
import { categoryOf, outcomeOf } from "./lib/sankeyClassify";

// ---------------------------------------------------------------------------
// Phase 88 — Analytics Rollup write-path invariants (Nyquist gate, Wave 0).
//
// The "classifier" describe block targets convex/lib/sankeyClassify.ts which
// EXISTS now (Plan 01) and MUST pass green.
//
// The "idempotency", "increment patch-or-insert", and "backfill count-equality"
// describe blocks exercise incrementEventBucket / incrementSankeyBuckets (from
// convex/analyticsRollup.ts) and the idempotencyKey dedup path (from
// convex/events.ts) which DO NOT EXIST YET (Wave 1 / Plan 02). They are EXPECTED
// to fail RED now and go GREEN after Plan 02.
//
// To keep the file COMPILING and the rest of the suite runnable, the Wave-1
// module is loaded behind a dynamic-import guard (loadRollup, below). When the
// module or a helper is missing, `rollup` stays null and each dependent test
// asserts against it — the test FAILS (red) rather than the whole file ERRORING.
// ---------------------------------------------------------------------------

// --- in-memory aggregates + events store (mirrors convex/llm.test.ts:7-14) ---
type Row = Record<string, any>;

function makeStore() {
  const aggregates: Row[] = [];
  const events: Row[] = [];
  let nextId = 0;

  const tableOf = (name: string) => (name === "events" ? events : aggregates);

  const db = {
    query: (table: string) => ({
      withIndex: (_name: string, _fn?: any) => ({
        collect: async () => tableOf(table).slice(),
        first: async () => tableOf(table)[0] ?? null,
      }),
    }),
    insert: async (table: string, data: Row) => {
      const _id = String(nextId++);
      tableOf(table).push({ ...data, _id });
      return _id;
    },
    patch: async (id: string, data: Row) => {
      for (const t of [aggregates, events]) {
        const idx = t.findIndex((r) => r._id === id);
        if (idx >= 0) Object.assign(t[idx], data);
      }
    },
  };

  return { aggregates, events, db };
}

// Filter helper: find the single "events" rollup bucket for an eventType.
function eventBucket(aggregates: Row[], eventType: string): Row | undefined {
  return aggregates.find(
    (r) =>
      r.metric_type === "events" &&
      (r.dimensions as { event_type?: string } | null)?.event_type === eventType
  );
}

// --- Wave-1 module guard ---------------------------------------------------
// Dynamically load convex/analyticsRollup.ts. If absent (pre-Plan-02), `rollup`
// stays null so the dependent describe blocks RED instead of erroring the file.
// Loosely typed on purpose: a `typeof import("./analyticsRollup")` annotation
// would make `tsc --noEmit` fail (module absent until Plan 02). The runtime
// guards below (`typeof rollup.incrementEventBucket !== "function"`) provide the
// real safety; the dependent tests RED until the module lands.
type RollupModule = {
  incrementEventBucket?: (
    ctx: any,
    eventType: string,
    timestamp: number,
    shard: number
  ) => Promise<void>;
  incrementSankeyBuckets?: (
    ctx: any,
    eventType: string,
    toolName: string | undefined,
    timestamp: number,
    shard: number
  ) => Promise<void>;
  accumulateEvent?: (
    eventsAcc: Map<string, any>,
    sankeyAcc: Map<string, any>,
    e: { eventType: string; toolName?: string; timestamp: number },
    cutoffHour: number
  ) => void;
  accumulateLlmTokens?: (
    acc: Map<string, any>,
    r: {
      provider: string;
      model: string;
      billingType: string;
      goalId: string;
      totalTokens: number;
      timestamp: number;
    },
    cutoffHour: number
  ) => void;
};
let rollup: RollupModule | null = null;
beforeAll(async () => {
  try {
    // Non-literal specifier (+ @vite-ignore) so Vite does NOT statically resolve
    // the import at transform time. Until convex/analyticsRollup.ts lands (Plan
    // 02) the module is absent; we want a runtime catch → `rollup = null` → the
    // dependent tests RED, NOT a transform-time error that nukes the whole file.
    const spec = "./analyticsRollup" + "";
    rollup = (await import(/* @vite-ignore */ spec)) as RollupModule;
  } catch {
    rollup = null;
  }
});

// --- Wave-0 shard-constant module guard (Phase 107, plan 107-03) -----------
// Dynamically load convex/lib/aggregateShard.ts. It does not exist until plan
// 107-03, so this must degrade to `shardLib = null` (RED tests) rather than
// erroring the file — same non-literal-specifier + @vite-ignore convention as
// the `rollup` guard above.
type ShardLib = { AGGREGATE_SHARD_COUNT?: number; pickShard?: () => number } | null;
let shardLib: ShardLib = null;
beforeAll(async () => {
  try {
    const spec = "./lib/aggregateShard" + "";
    shardLib = (await import(/* @vite-ignore */ spec)) as ShardLib;
  } catch {
    shardLib = null;
  }
});

// Mirrors the idempotencyKey dedup path planned for convex/events.ts ingest
// (88-PATTERNS.md "events.ts" section). Used to exercise the D-04/D-05 invariant
// independently of Convex codegen. Returns true if the insert happened.
async function ingestWithDedup(
  ctx: { db: ReturnType<typeof makeStore>["db"] },
  store: ReturnType<typeof makeStore>,
  args: {
    eventType: string;
    toolName?: string;
    timestamp: number;
    idempotencyKey?: string;
    shard?: number; // Phase 107: explicit shard, defaults to 0 (D-01)
  }
): Promise<boolean> {
  if (args.idempotencyKey) {
    const existing = store.events.find((e) => e.idempotencyKey === args.idempotencyKey);
    if (existing) return false; // idempotent no-op — D-04/D-05
  }
  await ctx.db.insert("events", {
    eventType: args.eventType,
    toolName: args.toolName,
    timestamp: args.timestamp,
    idempotencyKey: args.idempotencyKey,
  });
  if (!rollup || typeof rollup.incrementEventBucket !== "function") {
    throw new Error("incrementEventBucket not implemented (Wave 1 / Plan 02)");
  }
  await rollup.incrementEventBucket(ctx as any, args.eventType, args.timestamp, args.shard ?? 0);
  return true;
}

describe("analyticsRollup", () => {
  // -------------------------------------------------------------------------
  // GREEN NOW — classifier is the SOLE source of categoryOf/outcomeOf (Plan 01).
  // -------------------------------------------------------------------------
  describe("classifier", () => {
    test("categoryOf maps known prefixes to category names", () => {
      expect(categoryOf("tool_use")).toBe("Tool Use");
      expect(categoryOf("llm_call")).toBe("LLM");
      expect(categoryOf("model_x")).toBe("LLM");
      expect(categoryOf("file_write")).toBe("File Ops");
      expect(categoryOf("agent_spawn")).toBe("Agents");
      expect(categoryOf("anything_else")).toBe("Other");
    });

    test("outcomeOf maps error/hitl/success from eventType substrings", () => {
      // The verbatim classifier (preserved from analytics.ts per T-88-01) uses
      // CASE-SENSITIVE .includes("error")/.includes("fail"). Ástríðr emits
      // lowercase snake_case event types (cf. categoryOf's tool_/llm_/file_/agent_
      // prefixes), so the "Error" branch fires on tool_error / tool_fail.
      expect(outcomeOf("tool_error")).toBe("Error");
      expect(outcomeOf("tool_fail")).toBe("Error");
      expect(outcomeOf("hitl_review")).toBe("HITL");
      expect(outcomeOf("Info")).toBe("Success");
      // KNOWN verbatim property (NOT a behavior change — documents the
      // case-sensitivity): capitalized "ToolError"/"PostToolUseFailure" contain
      // no lowercase "error"/"fail" substring, so they classify as "Success".
      expect(outcomeOf("ToolError")).toBe("Success");
      expect(outcomeOf("PostToolUseFailure")).toBe("Success");
    });
  });

  // -------------------------------------------------------------------------
  // RED until Plan 02 — depend on incrementEventBucket + idempotencyKey dedup.
  // -------------------------------------------------------------------------
  describe("idempotency invariants", () => {
    test("same idempotencyKey twice → exactly 1 event row and bucket value 1", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      await ingestWithDedup(ctx, store, {
        eventType: "tool_use",
        timestamp: 1_700_000_000,
        idempotencyKey: "key-1",
      });
      await ingestWithDedup(ctx, store, {
        eventType: "tool_use",
        timestamp: 1_700_000_000,
        idempotencyKey: "key-1",
      });
      expect(store.events).toHaveLength(1);
      expect(eventBucket(store.aggregates, "tool_use")?.value).toBe(1);
    });

    test("no idempotencyKey twice → 2 event rows and bucket value 2 (D-05, no lossy drop)", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      await ingestWithDedup(ctx, store, { eventType: "tool_use", timestamp: 1_700_000_000 });
      await ingestWithDedup(ctx, store, { eventType: "tool_use", timestamp: 1_700_000_000 });
      expect(store.events).toHaveLength(2);
      expect(eventBucket(store.aggregates, "tool_use")?.value).toBe(2);
    });
  });

  describe("increment patch-or-insert", () => {
    test("first call inserts (value 1); second call for same {eventType, hour} patches to 2", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      if (!rollup || typeof rollup.incrementEventBucket !== "function") {
        throw new Error("incrementEventBucket not implemented (Wave 1 / Plan 02)");
      }
      // Phase 107: shard is pinned to 0 deliberately. Once incrementEventBucket
      // draws its own shard via Math.random() (plan 107-03), an implicit draw at
      // these two call sites would land on different shards about 7 times in 8,
      // and this test would flake (two separate rows instead of one patched row).
      await rollup.incrementEventBucket(ctx as any, "llm_call", 1_700_000_000, 0);
      expect(store.aggregates).toHaveLength(1);
      expect(eventBucket(store.aggregates, "llm_call")?.value).toBe(1);

      await rollup.incrementEventBucket(ctx as any, "llm_call", 1_700_000_000, 0);
      expect(store.aggregates).toHaveLength(1); // patched, not a second row
      expect(eventBucket(store.aggregates, "llm_call")?.value).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Phase 107 Wave-0 — write-path shard contract (RED until plan 107-03).
  // Every test name below contains "shard" so `-t "shard"` selects this whole
  // set. Fixtures stay inside a SINGLE hour and metric_type per test — the fake
  // makeStore() withIndex() ignores the index predicate entirely (returns the
  // whole aggregates array), so the production code's own JS .find() is what
  // does the real matching (107-PATTERNS.md section 3).
  // -------------------------------------------------------------------------
  describe("shard", () => {
    test("same explicit shard patches the same row", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      if (!rollup || typeof rollup.incrementEventBucket !== "function") {
        throw new Error("incrementEventBucket shard param not implemented (plan 107-03)");
      }
      await rollup.incrementEventBucket(ctx as any, "llm_call", 1_700_000_000, 0);
      await rollup.incrementEventBucket(ctx as any, "llm_call", 1_700_000_000, 0);
      expect(store.aggregates).toHaveLength(1);
      expect(store.aggregates[0].value).toBe(2);
      expect(store.aggregates[0].shard).toBe(0);
    });

    test("different explicit shards insert separate rows that still sum to the full count", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      if (!rollup || typeof rollup.incrementEventBucket !== "function") {
        throw new Error("incrementEventBucket shard param not implemented (plan 107-03)");
      }
      await rollup.incrementEventBucket(ctx as any, "llm_call", 1_700_000_000, 0);
      await rollup.incrementEventBucket(ctx as any, "llm_call", 1_700_000_000, 3);
      expect(store.aggregates).toHaveLength(2);
      const shards = new Set(store.aggregates.map((r) => r.shard));
      expect(shards).toEqual(new Set([0, 3]));
      for (const row of store.aggregates) {
        expect(row.value).toBe(1);
      }
      // Assert the SUM, not just the count — a count assertion alone is a
      // false-green once a bucket can span multiple rows (VALIDATION.md #4).
      const sum = store.aggregates.reduce((acc, r) => acc + (r.value as number), 0);
      expect(sum).toBe(2);
    });

    test("a legacy row with no shard field is not patched by a sharded write (D-04, shard-aware)", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      if (!rollup || typeof rollup.incrementEventBucket !== "function") {
        throw new Error("incrementEventBucket shard param not implemented (plan 107-03)");
      }
      // Pre-existing unsharded history row — NO shard key at all (D-04).
      store.aggregates.push({
        _id: "legacy",
        metric_type: "events",
        period: "hourly",
        bucket_start: 1_700_000_000,
        value: 42,
        dimensions: { event_type: "llm_call" },
      });
      await rollup.incrementEventBucket(ctx as any, "llm_call", 1_700_000_000, 0);
      const legacy = store.aggregates.find((r) => r._id === "legacy");
      // Strict shard match (r.shard === shard, not (r.shard ?? 0) === shard):
      // the legacy row is retired, not patched — it keeps absorbing writes
      // otherwise, and the read side stays correct regardless because every
      // reader sums across all matching rows irrespective of shard.
      expect(legacy?.value).toBe(42); // unchanged
      expect(store.aggregates).toHaveLength(2);
      const newRow = store.aggregates.find((r) => r._id !== "legacy");
      expect(newRow?.shard).toBe(0);
      expect(newRow?.value).toBe(1);
      const sum = store.aggregates.reduce((acc, r) => acc + (r.value as number), 0);
      expect(sum).toBe(43);
    });

    test("one incrementSankeyBuckets call writes exactly two edges carrying the passed shard", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      if (!rollup || typeof rollup.incrementSankeyBuckets !== "function") {
        throw new Error("incrementSankeyBuckets shard param not implemented (plan 107-03)");
      }
      await rollup.incrementSankeyBuckets(ctx as any, "tool_use", "Read", 1_700_000_000, 2);
      const edges = store.aggregates.filter((r) => r.metric_type === "sankey_edge");
      expect(edges).toHaveLength(2);
      for (const e of edges) {
        expect(e.shard).toBe(2);
      }
      const pairs = edges.map((e) => `${e.dimensions.source}>${e.dimensions.target}`);
      expect(pairs).toContain(`${categoryOf("tool_use")}>Read`);
      expect(pairs).toContain(`Read>${outcomeOf("tool_use")}`);
    });

    test("different shards split each sankey edge without changing the edge totals", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      if (!rollup || typeof rollup.incrementSankeyBuckets !== "function") {
        throw new Error("incrementSankeyBuckets shard param not implemented (plan 107-03)");
      }
      await rollup.incrementSankeyBuckets(ctx as any, "tool_use", "Read", 1_700_000_000, 1);
      await rollup.incrementSankeyBuckets(ctx as any, "tool_use", "Read", 1_700_000_000, 5);
      const edges = store.aggregates.filter((r) => r.metric_type === "sankey_edge");
      expect(edges).toHaveLength(4);
      const byPair = new Map<string, number>();
      for (const e of edges) {
        const key = `${e.dimensions.source}::${e.dimensions.target}`;
        byPair.set(key, (byPair.get(key) ?? 0) + (e.value as number));
      }
      expect(byPair.size).toBe(2);
      for (const total of byPair.values()) {
        expect(total).toBe(2);
      }
    });

    test("pickShard returns an integer within AGGREGATE_SHARD_COUNT across 200 draws", () => {
      if (!shardLib || typeof shardLib.pickShard !== "function") {
        throw new Error("pickShard not implemented (plan 107-03)");
      }
      expect(shardLib.AGGREGATE_SHARD_COUNT).toBe(8);
      const count = shardLib.AGGREGATE_SHARD_COUNT as number;
      // No assertion on the DISTRIBUTION of draws — only the range. A
      // distribution assertion would be genuinely flaky (VALIDATION.md #5/#6
      // analog for this file: don't assert statistics on a random draw).
      for (let i = 0; i < 200; i++) {
        const v = shardLib.pickShard();
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(count);
      }
    });
  });

  describe("backfill count-equality", () => {
    test("N seeded events across types/hours → sum of 'events' bucket values === N", async () => {
      const store = makeStore();
      const ctx = { db: store.db };
      if (!rollup || typeof rollup.incrementEventBucket !== "function") {
        throw new Error("incrementEventBucket not implemented (Wave 1 / Plan 02)");
      }
      const seeded = [
        { eventType: "tool_use", timestamp: 1_700_000_000 },
        { eventType: "tool_use", timestamp: 1_700_000_500 }, // same hour
        { eventType: "llm_call", timestamp: 1_700_003_700 }, // next hour
        { eventType: "file_write", timestamp: 1_700_000_100 },
      ];
      for (const e of seeded) {
        // Phase 107: explicit shard 0 — this test asserts the pre-existing
        // count-equality invariant, not the shard split, so every write is
        // pinned to the same shard.
        await rollup.incrementEventBucket(ctx as any, e.eventType, e.timestamp, 0);
      }
      const sum = store.aggregates
        .filter((r) => r.metric_type === "events")
        .reduce((acc, r) => acc + (r.value as number), 0);
      expect(sum).toBe(seeded.length);
    });
  });

  // -------------------------------------------------------------------------
  // Backfill rewrite (gap-closure): amplification-free in-memory aggregation.
  // accumulateEvent folds events into bucket accumulators with a current-hour
  // cutoff so the backfill never double-counts live-ingested current-hour events.
  // -------------------------------------------------------------------------
  describe("backfill aggregation (accumulateEvent)", () => {
    const CUTOFF = 1_700_010_000; // arbitrary "current hour" boundary for tests

    test("sum of 'events' bucket values === number of pre-cutoff events", () => {
      if (!rollup || typeof rollup.accumulateEvent !== "function") {
        throw new Error("accumulateEvent not implemented (backfill rewrite)");
      }
      const eventsAcc = new Map<string, any>();
      const sankeyAcc = new Map<string, any>();
      const seeded = [
        { eventType: "tool_use", timestamp: 1_700_000_000 },
        { eventType: "tool_use", timestamp: 1_700_000_500 }, // same hour+type → +1
        { eventType: "llm_call", timestamp: 1_700_003_700 }, // next hour
        { eventType: "file_write", timestamp: 1_700_000_100 },
      ];
      for (const e of seeded) rollup.accumulateEvent(eventsAcc, sankeyAcc, e, CUTOFF);

      const sum = [...eventsAcc.values()].reduce((a, r) => a + r.value, 0);
      expect(sum).toBe(seeded.length);
      // same-hour same-type collapsed into ONE bucket of value 2
      const toolUseHour = Math.floor(1_700_000_000 / 3600) * 3600;
      const toolUseBucket = [...eventsAcc.values()].find(
        (r) => r.bucket_start === toolUseHour && r.dimensions.event_type === "tool_use"
      );
      expect(toolUseBucket?.value).toBe(2);
    });

    test("events at/after the cutoff hour are SKIPPED (live ingest owns them)", () => {
      if (!rollup || typeof rollup.accumulateEvent !== "function") {
        throw new Error("accumulateEvent not implemented (backfill rewrite)");
      }
      const eventsAcc = new Map<string, any>();
      const sankeyAcc = new Map<string, any>();
      rollup.accumulateEvent(eventsAcc, sankeyAcc, { eventType: "tool_use", timestamp: CUTOFF }, CUTOFF);
      rollup.accumulateEvent(eventsAcc, sankeyAcc, { eventType: "tool_use", timestamp: CUTOFF + 5000 }, CUTOFF);
      expect(eventsAcc.size).toBe(0);
      expect(sankeyAcc.size).toBe(0);
    });

    test("each event writes exactly two sankey edges (category→tool, tool→outcome)", () => {
      if (!rollup || typeof rollup.accumulateEvent !== "function") {
        throw new Error("accumulateEvent not implemented (backfill rewrite)");
      }
      const eventsAcc = new Map<string, any>();
      const sankeyAcc = new Map<string, any>();
      rollup.accumulateEvent(
        eventsAcc,
        sankeyAcc,
        { eventType: "tool_use", toolName: "Bash", timestamp: 1_700_000_000 },
        CUTOFF
      );
      const sankeySum = [...sankeyAcc.values()].reduce((a, r) => a + r.value, 0);
      expect(sankeySum).toBe(2);
      // edges use the SAME classifier as the read path (categoryOf/outcomeOf)
      const edges = [...sankeyAcc.values()].map((r) => `${r.dimensions.source}>${r.dimensions.target}`);
      expect(edges).toContain(`${categoryOf("tool_use")}>Bash`);
      expect(edges).toContain(`Bash>${outcomeOf("tool_use")}`);
    });
  });

  // -------------------------------------------------------------------------
  // Phase 88 token-fidelity follow-up (gap-closure): the "tokens" rollup
  // backfill. accumulateLlmTokens folds llmMetrics rows into token-sum bucket
  // accumulators with a current-hour cutoff so the backfill never double-counts
  // current-hour rows the cron owns. Mirrors accumulateEvent.
  // -------------------------------------------------------------------------
  describe("backfill aggregation (accumulateLlmTokens)", () => {
    const CUTOFF = 1_700_010_000; // arbitrary "current hour" boundary for tests

    test("sums totalTokens per {provider,model} for pre-cutoff rows", () => {
      if (!rollup || typeof rollup.accumulateLlmTokens !== "function") {
        throw new Error("accumulateLlmTokens not implemented (token backfill)");
      }
      const acc = new Map<string, any>();
      const seeded = [
        { provider: "anthropic", model: "opus", billingType: "api", goalId: "", totalTokens: 100, timestamp: 1_700_000_000 },
        { provider: "anthropic", model: "opus", billingType: "api", goalId: "", totalTokens: 50, timestamp: 1_700_000_500 }, // same hour+dim → summed
        { provider: "openai", model: "gpt-4", billingType: "api", goalId: "", totalTokens: 200, timestamp: 1_700_000_100 },
      ];
      for (const r of seeded) rollup.accumulateLlmTokens(acc, r, CUTOFF);

      const hour = Math.floor(1_700_000_000 / 3600) * 3600;
      const opusBucket = [...acc.values()].find(
        (b) => b.bucket_start === hour && b.dimensions.provider === "anthropic" && b.dimensions.model === "opus"
      );
      expect(opusBucket?.value).toBe(150); // 100 + 50 collapsed into one bucket
      const gptBucket = [...acc.values()].find(
        (b) => b.dimensions.provider === "openai" && b.dimensions.model === "gpt-4"
      );
      expect(gptBucket?.value).toBe(200);
    });

    test("rows at/after the cutoff hour are SKIPPED (live cron owns them)", () => {
      if (!rollup || typeof rollup.accumulateLlmTokens !== "function") {
        throw new Error("accumulateLlmTokens not implemented (token backfill)");
      }
      const acc = new Map<string, any>();
      rollup.accumulateLlmTokens(
        acc,
        { provider: "anthropic", model: "opus", billingType: "api", goalId: "", totalTokens: 100, timestamp: CUTOFF },
        CUTOFF
      );
      rollup.accumulateLlmTokens(
        acc,
        { provider: "anthropic", model: "opus", billingType: "api", goalId: "", totalTokens: 100, timestamp: CUTOFF + 5000 },
        CUTOFF
      );
      expect(acc.size).toBe(0);
    });

    test("sum of bucket values === sum of pre-cutoff totalTokens", () => {
      if (!rollup || typeof rollup.accumulateLlmTokens !== "function") {
        throw new Error("accumulateLlmTokens not implemented (token backfill)");
      }
      const acc = new Map<string, any>();
      const seeded = [
        { provider: "anthropic", model: "opus", billingType: "api", goalId: "", totalTokens: 100, timestamp: 1_700_000_000 },
        { provider: "anthropic", model: "sonnet", billingType: "api", goalId: "", totalTokens: 40, timestamp: 1_700_003_700 }, // next hour
        { provider: "openai", model: "gpt-4", billingType: "api", goalId: "g1", totalTokens: 200, timestamp: 1_700_000_100 },
        { provider: "anthropic", model: "opus", billingType: "api", goalId: "", totalTokens: 999, timestamp: CUTOFF + 1 }, // post-cutoff, skipped
      ];
      for (const r of seeded) rollup.accumulateLlmTokens(acc, r, CUTOFF);

      const sum = [...acc.values()].reduce((a, b) => a + b.value, 0);
      expect(sum).toBe(100 + 40 + 200); // post-cutoff 999 excluded
    });
  });
});
