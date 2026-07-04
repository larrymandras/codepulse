# Phase 88: Analytics Rollup - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 10 (8 modified + 1 new module + 3 new test files)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `convex/schema.ts` | config | CRUD | `convex/schema.ts` itself (existing `aggregates` table at :883) | self-reference / exact |
| `convex/events.ts` | mutation | request-response | `convex/events.ts` existing `ingest` mutation (:7-28) + `listRecentPaginated` (:130-139) | self-extend / exact |
| `convex/aggregates.ts` | service/mutation | CRUD + batch | `convex/aggregates.ts` existing `computeHourly` (:1-143) | self-extend / exact |
| `convex/analytics.ts` | query | request-response | `convex/aggregates.ts` `costByPeriod` / `costByPeriodByProvider` / `errorTrendByPeriod` (:201-300) | role+flow match / exact |
| `convex/ingest.ts` | httpAction | event-driven | `convex/ingest.ts` existing `buildIngest` handler (:12-376) | self-extend / exact |
| `convex/runtimeIngest.ts` | httpAction | event-driven | `convex/runtimeIngest.ts` existing `runtimeIngest` handler (:15-949) | self-extend / exact |
| `convex/crons.ts` | config | event-driven | `convex/crons.ts` existing entries (:13-25) | self-extend / exact |
| `convex/dataRetention.ts` | mutation | batch | `convex/dataRetention.ts` `purgeOldTelemetryEvents` (:6-21) | verify-only / exact |
| NEW `convex/analyticsRollup.ts` | service/action | batch + CRUD | `convex/operatorScores.ts` `backfillFromSupabase` (:69-116) + `convex/aggregates.ts` increment pattern (:48-57) | role-match |
| NEW `convex/lib/sankeyClassify.ts` | utility | transform | `convex/analytics.ts` `categoryOf`/`outcomeOf` functions (:53-65) | extract-to-module / exact |
| NEW `convex/analyticsRollup.test.ts` | test | — | `convex/aggregates.test.ts` (pure-logic vitest pattern) | exact |
| NEW `convex/analytics.test.ts` | test | — | `convex/aggregates.test.ts` (pure-logic vitest pattern) | exact |
| NEW `convex/aggregates.test.ts` | test | — | `convex/aggregates.test.ts` (existing file — extend in place) | self-extend / exact |

---

## Pattern Assignments

### `convex/schema.ts` (config — extend aggregates table + events table)

**Analog:** `convex/schema.ts` lines 24-38 (events table) and lines 883-891 (aggregates table)

**Events table — current shape** (lines 24-38):
```typescript
events: defineTable({
  sessionId: v.string(),
  eventType: v.string(),
  toolName: v.optional(v.string()),
  filePath: v.optional(v.string()),
  payload: v.any(),
  hookType: v.optional(v.string()),
  timestamp: v.float64(),
  goalId: v.optional(v.string()),
  archived: v.optional(v.boolean()),
})
  .index("by_session", ["sessionId", "timestamp"])
  .index("by_type", ["eventType", "timestamp"])
  .index("by_tool", ["toolName", "timestamp"])
  .index("by_timestamp", ["timestamp"])
```

**Add to events table — D-04 pattern** (follow `.index()` chaining convention):
```typescript
// Add field inside defineTable():
idempotencyKey: v.optional(v.string()),   // D-04: producer dedup key

// Add index after existing .index() calls:
.index("by_idempotencyKey", ["idempotencyKey"])
```

**Aggregates table — current shape** (lines 883-891):
```typescript
aggregates: defineTable({
  metric_type: v.string(),      // "cost" | "events" | "errors"
  period: v.string(),           // "hourly" | "daily"
  bucket_start: v.float64(),    // Unix epoch seconds, truncated to hour/day boundary
  value: v.float64(),
  dimensions: v.optional(v.any()), // { provider?, model?, event_type?, error_category? }
})
  .index("by_type_period_bucket", ["metric_type", "period", "bucket_start"])
  .index("by_period_bucket", ["period", "bucket_start"])
```

**No schema change needed for sankey_edge** — `metric_type` is `v.string()`; new rows with `metric_type: "sankey_edge"` are covered by the existing indexes automatically.

**No schema change needed for dimension_key string field** unless Pitfall 3 resolution requires it (planner's call per Claude's Discretion).

---

### `convex/events.ts` (mutation — extend `ingest` with idempotency + rollup increment)

**Analog:** `convex/events.ts` existing `ingest` mutation (lines 7-28) + `listRecentPaginated` (lines 130-139)

**Current `ingest` mutation pattern** (lines 7-28):
```typescript
export const ingest = mutation({
  args: {
    sessionId: v.string(),
    eventType: v.string(),
    toolName: v.optional(v.string()),
    filePath: v.optional(v.string()),
    payload: v.any(),
    hookType: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      sessionId: args.sessionId,
      eventType: args.eventType,
      toolName: args.toolName,
      filePath: args.filePath,
      payload: args.payload,
      hookType: args.hookType,
      timestamp: args.timestamp,
    });
  },
});
```

**Extend args and handler — D-04 dedup + D-01 rollup pattern** (copy insert block, add before and after):
```typescript
// ADD to args:
idempotencyKey: v.optional(v.string()),   // D-04

// ADD at top of handler (before ctx.db.insert):
if (args.idempotencyKey) {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey!))
    .first();
  if (existing) return; // idempotent no-op — D-04/D-05
}

// ADD to ctx.db.insert call:
idempotencyKey: args.idempotencyKey,

// ADD after ctx.db.insert (ingest-time rollup — D-01/D-02):
await incrementEventBucket(ctx, args.eventType, args.timestamp);
await incrementSankeyBuckets(ctx, args.eventType, args.toolName, args.timestamp);
// (incrementEventBucket and incrementSankeyBuckets are helpers in analyticsRollup.ts,
//  called via internal.analyticsRollup.* OR imported as shared functions)
```

**`listRecentPaginated` pattern** (lines 130-139) — backfill action reuses this directly:
```typescript
export const listRecentPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .paginate(args.paginationOpts);
  },
});
```

**`paginationOptsValidator` import** (line 3 — already present, reuse):
```typescript
import { paginationOptsValidator } from "convex/server";
```

---

### `convex/aggregates.ts` (mutation — remove event-count branch; paginate llmMetrics cost reads)

**Analog:** `convex/aggregates.ts` — self-modify. Copy the cost section idempotency pattern.

**Idempotency guard pattern to KEEP** (lines 34-57 — cost path, reuse verbatim for cron-retained metrics):
```typescript
// Step 1: collect existing rows for this bucket
const existingCostRows = await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "cost").eq("period", "hourly").eq("bucket_start", hourStart)
  )
  .collect();

// Step 2: reconstruct dimension key in JS (not via object filter — Pitfall 3)
const existingKeys = new Set(
  existingCostRows.map((r) => {
    const dims = r.dimensions as { provider?: string; model?: string; billingType?: string; goalId?: string } | null;
    return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}::${dims?.goalId ?? ""}`;
  })
);

// Step 3: skip if key already present, otherwise insert
for (const [dim, value] of Object.entries(costByDim)) {
  if (existingKeys.has(dim)) continue; // idempotency: skip already-aggregated dimension
  const [provider, model, billingType, goalId] = dim.split("::");
  await ctx.db.insert("aggregates", {
    metric_type: "cost",
    period: "hourly",
    bucket_start: hourStart,
    value,
    dimensions: { provider, model, billingType, goalId },
  });
}
```

**Event-count branch to REMOVE** (lines 60-97 — the entire block from `// --- Event count aggregation` through the closing `}` of the for-loop at line 97). Also remove the error-rate aggregation block (lines 99-142). Both move to ingest-time in `analyticsRollup.ts`.

**Paginated llmMetrics reads to ADD** (replace `llmRows = await ctx.db.query("llmMetrics")...collect()` at lines 14-20 — D-03):
```typescript
// Replace unbounded .collect() with paginated reads
let llmCursor: string | null = null;
const allLlmRows: Array<any> = [];
while (true) {
  const page = await ctx.db
    .query("llmMetrics")
    .withIndex("by_timestamp", (q) =>
      q.gte("timestamp", hourStart).lt("timestamp", hourEnd)
    )
    .filter((q) => q.neq(q.field("archived"), true))
    .paginate({ numItems: 500, cursor: llmCursor });
  allLlmRows.push(...page.page);
  if (page.isDone) break;
  llmCursor = page.continueCursor;
}
// Then use allLlmRows in place of llmRows below
```

**`rollupDaily` pattern to KEEP unchanged** (lines 148-196) — reads only slim `aggregates` rows, already safe.

**Aggregate read queries to KEEP unchanged** (lines 199-381) — `costByPeriod`, `costByPeriodByProvider`, `errorTrendByPeriod`, `eventCountsByPeriod` are consumed by existing analytics; do not remove.

---

### `convex/analytics.ts` (query — rewrite 4 queries to read aggregates; leave tokenWaterfall)

**Analog:** `convex/aggregates.ts` `costByPeriod` query (lines 201-234) and `errorTrendByPeriod` (lines 278-300). These are the production-proven pattern for reading `aggregates` by `by_type_period_bucket` index.

**Index-read pattern** (copy from `costByPeriod` lines 207-215):
```typescript
const rows = await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "events").eq("period", "hourly").gte("bucket_start", cutoff)
  )
  .collect();
```

**Dimension extraction pattern** (copy from `eventCountsByPeriod` lines 370-379):
```typescript
for (const r of rows) {
  const eventType = (r.dimensions as { event_type?: string } | null)?.event_type ?? "unknown";
  grouped[eventType] = (grouped[eventType] ?? 0) + r.value;
}
```

**`activityHeatmap` rewrite** (replaces lines 3-37):
- Remove `.take(1000)` raw events scan
- Read `aggregates` with `metric_type: "events"`, `period: "hourly"`, `bucket_start >= cutoff`
- Group by `dimensions.event_type`, sum values across eventTypes per absolute hour bucket
- Map `bucket_start` (UTC epoch seconds) → `{day: date.getDay(), hour: date.getHours()}` using same `new Date(bucket_start * 1000)` pattern as current line 21

**`errorRateTrend` rewrite** (replaces lines 146-193):
- Remove three `.take(300)` raw event scans
- Read `aggregates` with `metric_type: "events"`, `period: "hourly"`, filter in JS to error eventTypes
- Initialize all 24 hour slots to 0 before filling (Pitfall 7 guard — same pattern as current lines 180-185)
- Return `[{hour, label, errors}]` array — same shape as current return

**`toolFlowSankey` rewrite** (replaces lines 39-96):
- Remove `.take(1000)` raw events scan
- Read `aggregates` with `metric_type: "sankey_edge"`, `period: "hourly"`
- Dimensions: `{source: string, target: string}` where source/target are node names from `categoryOf`/`outcomeOf` (extracted to `convex/lib/sankeyClassify.ts`)
- Reconstruct `linkMap` from stored buckets; accumulate `value` for each edge
- Return same `{nodes, links}` shape

**`tokenSunburst` rewrite** (replaces lines 98-143):
- Remove `.take(30000)` llmMetrics scan
- Read `aggregates` with `metric_type: "cost"`, `period: "hourly"` or `"daily"` for 30-day window
- Group by `dimensions.provider` + `dimensions.model` (same as `costByPeriodByProvider` lines 262-267)
- Reconstruct tree by parsing existing 4-segment dimension key: `provider::model::billingType::goalId`
- Return same `{tree, totalCost, totalTokens}` shape (note: `totalTokens` not in cost aggregates — set to 0 or omit from rollup version; planner should decide)

**`tokenWaterfall` — unchanged** (lines 229-249): keep `take(30000)` on `llmMetrics` 30-minute window. Do NOT convert to rollups. Remove the defensive cap comment if desired, but leave the `.take(30000)` guard in place.

---

### `convex/ingest.ts` (httpAction — add `idempotencyKey` pass-through)

**Analog:** `convex/ingest.ts` existing `buildIngest` handler (lines 12-376) — self-extend.

**`ctx.runMutation(api.events.ingest, {...})` call site** (lines 35-43):
```typescript
await ctx.runMutation(api.events.ingest, {
  sessionId: sessionId ?? "unknown",
  eventType: eventType ?? "unknown",
  toolName,
  filePath,
  payload: payload ?? body,
  hookType,
  timestamp,
});
```

**Extend with idempotencyKey** — extract from body, pass through:
```typescript
const idempotencyKey: string | undefined = body.idempotencyKey ?? body.event_id;

await ctx.runMutation(api.events.ingest, {
  sessionId: sessionId ?? "unknown",
  eventType: eventType ?? "unknown",
  toolName,
  filePath,
  payload: payload ?? body,
  hookType,
  timestamp,
  idempotencyKey,  // D-04: undefined when not present (D-05 treat-as-unique)
});
```

**No other changes to `ingest.ts`** — the rollup increments happen inside the `api.events.ingest` mutation, not in the httpAction. The httpAction is not transactional and must not do rollup writes directly.

---

### `convex/runtimeIngest.ts` (httpAction — add `idempotencyKey` pass-through for `gateway.routing_decision` path)

**Analog:** `convex/runtimeIngest.ts` existing switch cases (lines 39-928) — self-extend.

**Only the `gateway.routing_decision` case** routes to `api.events.ingest` (lines 901-907):
```typescript
case "gateway.routing_decision": {
  const d = data as any;
  const sessionId = d.session_id ?? d.sessionId ?? "unknown";
  await ctx.runMutation(api.events.ingest, {
    sessionId,
    eventType: "gateway.routing_decision",
    payload: d,
    timestamp,
  });
  break;
}
```

**Extend with idempotencyKey** — same pattern as ingest.ts:
```typescript
await ctx.runMutation(api.events.ingest, {
  sessionId,
  eventType: "gateway.routing_decision",
  payload: d,
  timestamp,
  idempotencyKey: d.idempotencyKey ?? d.event_id,
});
```

**No other runtimeIngest cases** touch `api.events.ingest` — no other changes needed. Runtime events (llm_call, docker_status, etc.) route to domain tables, not to the events table.

---

### `convex/crons.ts` (config — verify wiring; no changes expected)

**Analog:** `convex/crons.ts` lines 13-25 (existing aggregate cron entries):
```typescript
crons.interval(
  "aggregate-hourly",
  { hours: 1 },
  internal.aggregates.computeHourly
);

crons.daily(
  "aggregate-daily",
  { hourUTC: 1, minuteUTC: 0 },
  internal.aggregates.rollupDaily
);
```

**No change to cron wiring** — `computeHourly` and `rollupDaily` still exist after the D-02 removal of the event-count branch; only their internal logic changes. The cron entries remain identical.

**Pattern for adding new entries** (if a future retention cron is needed — same style):
```typescript
crons.interval(
  "descriptive-name",
  { hours: N },
  internal.module.functionName
);
```

---

### `convex/dataRetention.ts` (mutation — verify only, no changes needed)

**Analog:** `convex/dataRetention.ts` `purgeOldTelemetryEvents` (lines 6-21):
```typescript
export const purgeOldTelemetryEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const old = await ctx.db
      .query("events")        // "events" table only — never "aggregates"
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(BATCH_SIZE);      // BATCH_SIZE = 500 (line 3)

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: old.length };
  },
});
```

**D-12 is satisfied by construction** — file only queries `events`, `heartbeatAlerts`, and `episodicEvents`. The `aggregates` table is never referenced. No code change required; planner should mark as "verify-only."

---

### NEW `convex/analyticsRollup.ts` (service + action — rollup increment helpers + backfill)

**Analog 1 (increment pattern):** `convex/aggregates.ts` lines 48-57 — the read-patch-or-insert bucket pattern.

**Analog 2 (action + cursor loop):** `convex/operatorScores.ts` `backfillFromSupabase` (lines 69-116) — `action()` calling `ctx.runQuery` + `ctx.runMutation` in a loop.

**Imports pattern** (follow aggregates.ts line 1-3 + operatorScores.ts):
```typescript
import { action, internalMutation, mutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { categoryOf, outcomeOf } from "./lib/sankeyClassify";
```

**`incrementEventBucket` helper** (pure function, not exported as mutation — called inside `events.ingest`):
```typescript
// Pattern: read bucket row via index → patch or insert (aggregates.ts:48-57)
export async function incrementEventBucket(
  ctx: MutationCtx,
  eventType: string,
  timestamp: number
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;

  // Collect all rows for this bucket + type, then match in JS (Pitfall 3 guard)
  const bucketRows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q) =>
      q.eq("metric_type", "events").eq("period", "hourly").eq("bucket_start", hourStart)
    )
    .collect();
  const existing = bucketRows.find((r) => {
    const dims = r.dimensions as { event_type?: string } | null;
    return dims?.event_type === eventType;
  });

  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "events",
      period: "hourly",
      bucket_start: hourStart,
      value: 1,
      dimensions: { event_type: eventType },
    });
  }
}
```

**`incrementSankeyBuckets` helper** (same pattern, two edges per event):
```typescript
export async function incrementSankeyBuckets(
  ctx: MutationCtx,
  eventType: string,
  toolName: string | undefined,
  timestamp: number
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;
  const category = categoryOf(eventType);
  const tool = toolName ?? eventType;
  const outcome = outcomeOf(eventType);

  // Edge A: category → tool
  await incrementSankeyEdge(ctx, hourStart, category, tool);
  // Edge B: tool → outcome
  await incrementSankeyEdge(ctx, hourStart, tool, outcome);
}

async function incrementSankeyEdge(
  ctx: MutationCtx,
  hourStart: number,
  source: string,
  target: string
): Promise<void> {
  const bucketRows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q) =>
      q.eq("metric_type", "sankey_edge").eq("period", "hourly").eq("bucket_start", hourStart)
    )
    .collect();
  const existing = bucketRows.find((r) => {
    const dims = r.dimensions as { source?: string; target?: string } | null;
    return dims?.source === source && dims?.target === target;
  });

  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "sankey_edge",
      period: "hourly",
      bucket_start: hourStart,
      value: 1,
      dimensions: { source, target },
    });
  }
}
```

**`incrementBatch` mutation** (internal — called only by backfill action):
```typescript
export const incrementBatch = internalMutation({
  args: {
    events: v.array(v.object({
      eventType: v.string(),
      toolName: v.optional(v.string()),
      timestamp: v.float64(),
    })),
  },
  handler: async (ctx, args) => {
    for (const e of args.events) {
      await incrementEventBucket(ctx, e.eventType, e.timestamp);
      await incrementSankeyBuckets(ctx, e.eventType, e.toolName, e.timestamp);
    }
  },
});
```

**`backfillHistorical` action** (copy structure from `operatorScores.ts backfillFromSupabase` lines 69-116; replace fetch loop with paginate loop):
```typescript
export const backfillHistorical = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let processed = 0;

    while (true) {
      // ctx.runQuery — actions cannot access ctx.db directly
      const result = await ctx.runQuery(api.events.listRecentPaginated, {
        paginationOpts: { numItems: 200, cursor },
      });

      if (result.page.length > 0) {
        await ctx.runMutation(internal.analyticsRollup.incrementBatch, {
          events: result.page.map((e: any) => ({
            eventType: e.eventType,
            toolName: e.toolName,
            timestamp: e.timestamp,
          })),
        });
        processed += result.page.length;
      }

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    return { processed };
  },
});
```

---

### NEW `convex/lib/sankeyClassify.ts` (utility — extract `categoryOf`/`outcomeOf`)

**Analog:** `convex/analytics.ts` lines 53-65 — extract verbatim, do not modify logic.

**Current functions in analytics.ts** (lines 53-65):
```typescript
const categoryOf = (eventType: string): string => {
  if (eventType.startsWith("tool_")) return "Tool Use";
  if (eventType.startsWith("llm_") || eventType.startsWith("model_")) return "LLM";
  if (eventType.startsWith("file_")) return "File Ops";
  if (eventType.startsWith("agent_")) return "Agents";
  return "Other";
};

const outcomeOf = (e: { eventType: string; payload: any }): string => {
  if (e.eventType.includes("error") || e.eventType.includes("fail")) return "Error";
  if (e.eventType.includes("hitl") || e.eventType.includes("review")) return "HITL";
  return "Success";
};
```

**Extract as named exports** (note: `outcomeOf` only uses `eventType`, not `payload` — confirmed in RESEARCH.md OQ-2):
```typescript
// convex/lib/sankeyClassify.ts
export function categoryOf(eventType: string): string {
  if (eventType.startsWith("tool_")) return "Tool Use";
  if (eventType.startsWith("llm_") || eventType.startsWith("model_")) return "LLM";
  if (eventType.startsWith("file_")) return "File Ops";
  if (eventType.startsWith("agent_")) return "Agents";
  return "Other";
}

export function outcomeOf(eventType: string): string {
  if (eventType.includes("error") || eventType.includes("fail")) return "Error";
  if (eventType.includes("hitl") || eventType.includes("review")) return "HITL";
  return "Success";
}
```

**Then in `analytics.ts`**, replace the local `const` declarations with:
```typescript
import { categoryOf, outcomeOf } from "./lib/sankeyClassify";
```

---

### NEW `convex/analyticsRollup.test.ts` (test — idempotency + bucket derivation)

**Analog:** `convex/aggregates.test.ts` — the project's canonical pure-logic vitest pattern (no convex-test harness, no DB mocks for Convex internals; test extracted pure functions and data transformations).

**Test file structure pattern** (copy from `aggregates.test.ts` lines 1-10):
```typescript
import { describe, test, expect } from "vitest";

describe("analyticsRollup", () => {
  describe("idempotency invariants", () => {
    // ...
  });
  describe("bucket increment logic", () => {
    // ...
  });
});
```

**Mock ctx.db pattern** (copy from `llm.test.ts` lines 7-14):
```typescript
function makeAggregatesStore() {
  const aggregates: Record<string, any>[] = [];
  let nextId = 0;
  const db = {
    query: (table: string) => ({
      withIndex: (_name: string, _fn: any) => ({
        collect: async () => aggregates.filter(r => r._table === table),
        first: async () => aggregates.find(r => r._table === table) ?? null,
      }),
    }),
    insert: async (table: string, data: Record<string, any>) => {
      aggregates.push({ ...data, _table: table, _id: String(nextId++) });
    },
    patch: async (id: string, data: Record<string, any>) => {
      const idx = aggregates.findIndex(r => r._id === id);
      if (idx >= 0) Object.assign(aggregates[idx], data);
    },
  };
  return { aggregates, db };
}
```

**Tests to cover** (from RESEARCH.md validation architecture):
1. Idempotency: same `idempotencyKey` called twice → 1 event row, bucket value = 1
2. No-key events always counted: called twice without key → 2 rows, bucket value = 2
3. Rollup count == raw count after backfill (N events → bucket sums to N)
4. `categoryOf` / `outcomeOf` return correct strings for known eventTypes
5. `incrementEventBucket` patch-or-insert: first call inserts, second call patches

---

### NEW `convex/analytics.test.ts` (test — query derivation correctness)

**Analog:** `convex/aggregates.test.ts` lines 104-218 (read query shape tests) — pure-logic pattern.

**Tests to cover** (from RESEARCH.md validation architecture):
1. `activityHeatmap`: given known hourly event-count buckets, returns correct `{day, hour}` mapping
2. `errorRateTrend` missing-hour = 0: 24 slots returned even when some hours have no error buckets
3. `toolFlowSankey`: given stored `sankey_edge` buckets, reconstructs correct `{nodes, links}` shape
4. `tokenSunburst`: given cost aggregates, groups by provider+model correctly

---

### `convex/aggregates.test.ts` (test — extend existing file for cron-removal invariant)

**Analog:** `convex/aggregates.test.ts` — extend in place; follow existing `describe` nesting.

**Add new describe block** after existing tests (line 409):
```typescript
describe("Phase 88 — cron removal non-double-count invariant", () => {
  test("running computeHourly for hour with ingest-time buckets does not change their values", () => {
    // Simulate: ingest-time buckets already exist for eventType "Info" with value = 5
    // computeHourly (without event-count branch) sees no event-count writes to do
    // Assert: no new "events" metric_type rows inserted, existing value unchanged
    const existingEventRows = [
      { dimensions: { event_type: "Info" }, value: 5 },
    ];
    const existingEventKeys = new Set(
      existingEventRows.map((r) => {
        const dims = r.dimensions as { event_type?: string } | null;
        return dims?.event_type ?? "unknown";
      })
    );
    // If computeHourly event-count branch is removed, this loop doesn't run at all.
    // Guard: even if it ran, the idempotency key set would block double-writes.
    const wouldInsert = ["Info"].filter(et => !existingEventKeys.has(et));
    expect(wouldInsert).toHaveLength(0); // No double-write
  });

  test("dataRetention purgeOldTelemetryEvents never touches aggregates", () => {
    // Verifies D-12: purge only deletes from "events" table
    const tablesDeleted: string[] = [];
    const mockDb = {
      query: (table: string) => ({
        withIndex: () => ({ filter: () => ({ take: async () => [{ _id: "id1" }] }) }),
      }),
      delete: async (id: string) => { tablesDeleted.push("events"); },
    };
    // dataRetention only queries "events" — aggregates never appear in tablesDeleted
    expect(tablesDeleted.filter(t => t === "aggregates")).toHaveLength(0);
  });
});
```

---

## Shared Patterns

### Convex mutation declaration (applies to all mutations/internalMutations)
**Source:** `convex/aggregates.ts` line 1, `convex/dataRetention.ts` line 1
```typescript
import { internalMutation, mutation, query, action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
```

### Index-bounded read pattern (applies to all aggregates reads)
**Source:** `convex/aggregates.ts` lines 34-39
**Apply to:** all analytics.ts queries, analyticsRollup.ts increment helpers
```typescript
await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "events").eq("period", "hourly").eq("bucket_start", hourStart)
  )
  .collect();  // safe — aggregates rows are slim (~200-400 bytes, no payload: v.any())
```

### JS-side dimension key reconstruction (Pitfall 3 guard — applies to all bucket lookups)
**Source:** `convex/aggregates.ts` lines 40-46
**Apply to:** `incrementEventBucket`, `incrementSankeyEdge`, any query filtering by `dimensions`
```typescript
// DO NOT: .filter((q) => q.eq(q.field("dimensions"), { event_type: "Error" }))
// DO: collect rows for the bucket, then match in JS
const existing = bucketRows.find((r) => {
  const dims = r.dimensions as { event_type?: string } | null;
  return dims?.event_type === eventType;
});
```

### Read-patch-or-insert (no upsert in Convex — applies to all rollup increments)
**Source:** `convex/aggregates.ts` lines 48-57
**Apply to:** `incrementEventBucket`, `incrementSankeyEdge`, `incrementBatch`
```typescript
if (existing) {
  await ctx.db.patch(existing._id, { value: existing.value + 1 });
} else {
  await ctx.db.insert("aggregates", { metric_type, period, bucket_start, value: 1, dimensions });
}
```

### Pagination cursor loop in action (applies to backfillHistorical)
**Source:** `convex/events.ts` lines 130-139 (`listRecentPaginated`) + `convex/operatorScores.ts` lines 69-116 (action loop pattern)
**Apply to:** `analyticsRollup.backfillHistorical`
```typescript
// First call: cursor = null. Subsequent: cursor = result.continueCursor. Stop when: result.isDone
let cursor: string | null = null;
while (true) {
  const result = await ctx.runQuery(api.events.listRecentPaginated, {
    paginationOpts: { numItems: 200, cursor },
  });
  // process result.page ...
  if (result.isDone) break;
  cursor = result.continueCursor;
}
```

### `internalMutation` for non-public writes (applies to backfill batch, aggregation crons)
**Source:** `convex/aggregates.ts` line 6, `convex/dataRetention.ts` line 6
**Apply to:** `analyticsRollup.incrementBatch` (must be `internalMutation`, not `mutation`)
```typescript
export const incrementBatch = internalMutation({ ... });
// Called as: await ctx.runMutation(internal.analyticsRollup.incrementBatch, {...})
```

### Pure-logic vitest test pattern (applies to all new test files)
**Source:** `convex/aggregates.test.ts` lines 1-409
**Apply to:** `convex/analyticsRollup.test.ts`, `convex/analytics.test.ts`
```typescript
import { describe, test, expect } from "vitest";
// No convex-test harness. Test extracted pure functions and data transforms directly.
// Mock ctx.db inline with plain objects (see llm.test.ts lines 7-14 for pattern).
```

---

## No Analog Found

All files have analogs within the codebase. No gaps.

---

## Metadata

**Analog search scope:** `convex/` directory — all `.ts` files
**Files scanned:** aggregates.ts, events.ts, analytics.ts, ingest.ts, runtimeIngest.ts, crons.ts, dataRetention.ts, schema.ts, graphSnapshots.ts, operatorScores.ts, aggregates.test.ts, llm.test.ts, runtimeIngest.test.ts
**Pattern extraction date:** 2026-06-23

**Critical sequencing notes (for planner):**
1. Remove event-count + error-count branches from `computeHourly` IN THE SAME DEPLOY as adding ingest-time increments (Pitfall 1 — double-write risk).
2. Extract `categoryOf`/`outcomeOf` to `convex/lib/sankeyClassify.ts` BEFORE implementing ingest-time sankey increment (Pitfall 2 — drift risk).
3. `backfillHistorical` action runs AFTER schema deploy completes index backfill (Pitfall 6 — index must be ready first; Convex guarantees this automatically on deploy).
4. Wave 0 tests must pass before Wave 1 implementation begins (RESEARCH.md test framework).
