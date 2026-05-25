# Phase 59: Schema Foundation - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 7 (5 modified, 2 new)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/schema.ts` | config | CRUD | `convex/schema.ts` itself (webhookDeliveryLog + existing tables) | self-reference (exact) |
| `convex/callGraphEdges.ts` | service | CRUD (upsert) | `convex/commandExecutions.ts` | exact (query-then-patch-or-insert) |
| `convex/deliveryLogs.ts` | service | CRUD (insert) | `convex/llm.ts` (recordCall insert) | role-match |
| `convex/llm.ts` | service | CRUD + batch | `convex/llm.ts` (rollupCosts internalMutation) | self-reference (extend) |
| `convex/alertRuleCustom.ts` | service | CRUD | `convex/alertRuleCustom.ts` (conditionValidator pattern) | self-reference (extend) |
| `convex/archival.ts` | service | batch | `convex/archival.ts` (markStaleArchived tables list) | self-reference (extend) |
| `convex/runtimeIngest.ts` | middleware | event-driven | `convex/runtimeIngest.ts` (switch case block) | self-reference (extend) |

---

## Pattern Assignments

### `convex/schema.ts` (config, CRUD)

**Analog:** `convex/schema.ts` — existing table definitions

**Imports pattern** (lines 1-3):
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
```

**Existing table section header pattern** (lines 855-857):
```typescript
  // ============================================================
  // ALERT ROUTING (Phase 6)
  // ============================================================
```

**Core table definition pattern — webhookDeliveryLog** (lines 893-901):
```typescript
  webhookDeliveryLog: defineTable({
    alertId: v.id("alerts"),
    channel: v.string(),          // "discord" | "slack"
    attempt: v.float64(),
    status: v.string(),           // "success" | "failed"
    statusCode: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
    sentAt: v.float64(),
  }).index("by_alert", ["alertId", "sentAt"]),
```

**Optional field pattern — llmMetrics** (lines 269-284):
```typescript
  llmMetrics: defineTable({
    provider: v.string(),
    model: v.string(),
    promptTokens: v.float64(),
    completionTokens: v.float64(),
    totalTokens: v.float64(),
    latencyMs: v.float64(),
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
    archived: v.optional(v.boolean()),
  })
    .index("by_provider", ["provider", "timestamp"])
    .index("by_model", ["model", "timestamp"])
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
```

**Nested object field pattern — alertRuleCustom conditionGroups** (lines 870-878):
```typescript
    conditionGroups: v.optional(v.array(v.object({
      conditions: v.array(v.object({
        metric: v.string(),
        operator: v.string(),
        threshold: v.float64(),
        lookbackWindow: v.string(),
      })),
      logic: v.string(),          // "AND" | "OR"
    }))),
```

**New tables to add** (after line 901 `webhookDeliveryLog` block, or in a new Phase 59 section):
- `callGraphEdges` — edge count/status table with `by_agent_tool`, `by_session`, `by_timestamp` indexes
- `emailDeliveryLog` — mirrors webhookDeliveryLog + ruleId, recipient, subject; `by_alert`, `by_rule`, `by_timestamp` indexes
- `pagerdutyDeliveryLog` — mirrors webhookDeliveryLog + ruleId, dedupKey; same index pattern
- `githubTriggerLog` — mirrors webhookDeliveryLog + ruleId, dispatchId, runUrl; same index pattern

**Existing tables to extend** (in-place edits):
- `llmMetrics` (line 269): add `agentId: v.optional(v.string())` and `toolName: v.optional(v.string())` fields; add `.index("by_agent", ["agentId", "timestamp"])`
- `alertRuleCustom` (line 859): add `pagerdutyConfig: v.optional(v.object({...}))` and `githubTrigger: v.optional(v.object({...}))` fields

---

### `convex/callGraphEdges.ts` (service, CRUD upsert) — NEW FILE

**Analog:** `convex/commandExecutions.ts`

**Imports pattern** (lines 1-2):
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
```

**Core upsert pattern — query-then-patch-or-insert** (lines 11-66):
```typescript
export const upsertLifecycle = mutation({
  args: {
    executionId: v.string(),
    // ... other args
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("commandExecutions")
      .withIndex("by_executionId", (q) => q.eq("executionId", args.executionId))
      .first();

    if (existing) {
      // Patch with computed/incremented fields
      await ctx.db.patch(existing._id, patch);
    } else {
      // Insert new record with defaults
      await ctx.db.insert("commandExecutions", { ... });
    }
  },
});
```

**Adapted for callGraphEdges** — the `upsertEdge` mutation follows the same structure with count-increment logic in the patch branch:
```typescript
export const upsertEdge = mutation({
  args: {
    agentId: v.string(),
    toolName: v.string(),
    sessionId: v.string(),
    success: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("callGraphEdges")
      .withIndex("by_agent_tool", (q) =>
        q.eq("agentId", args.agentId).eq("toolName", args.toolName)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        callCount: existing.callCount + 1,
        lastCallAt: args.timestamp,
        errorCount: args.success ? existing.errorCount : existing.errorCount + 1,
        lastErrorAt: args.success ? existing.lastErrorAt : args.timestamp,
        status: args.success ? "healthy" : "errored",
      });
    } else {
      await ctx.db.insert("callGraphEdges", {
        agentId: args.agentId,
        toolName: args.toolName,
        sessionId: args.sessionId,
        callCount: 1,
        lastCallAt: args.timestamp,
        errorCount: args.success ? 0 : 1,
        lastErrorAt: args.success ? undefined : args.timestamp,
        status: args.success ? "healthy" : "errored",
        archived: undefined,
      });
    }
  },
});
```

**No auth guard** — this mutation is called internally from runtimeIngest (not user-facing), matching the pattern of `api.llm.recordCall`, `api.docker.recordStatus`, etc. which have no Clerk check.

---

### `convex/deliveryLogs.ts` (service, CRUD insert) — NEW FILE

**Analog:** `convex/llm.ts` — `recordCall` mutation (simple insert pattern)

**Imports pattern** (line 1):
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
```

**Core simple-insert pattern** (`convex/llm.ts` lines 5-30):
```typescript
export const recordCall = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    // ... typed args
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("llmMetrics", {
      provider: args.provider,
      model: args.model,
      // ... spread args
    });
  },
});
```

**Adapted for deliveryLogs** — three separate export mutations in one file, one per table:
```typescript
export const insertEmailLog = mutation({ ... });    // → emailDeliveryLog
export const insertPagerdutyLog = mutation({ ... }); // → pagerdutyDeliveryLog
export const insertGithubLog = mutation({ ... });    // → githubTriggerLog
```

Each mutation: typed args matching the table schema, direct `ctx.db.insert()`, no auth guard (Phase 64/65 actions call these internally).

---

### `convex/llm.ts` (service, CRUD + batch) — MODIFY

**Analog:** `convex/llm.ts` itself — `rollupCosts` internalMutation (lines 154-189)

**internalMutation pattern for backfill** (lines 154-188):
```typescript
export const rollupCosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(1000);   // ← batch limit, never .collect()

    for (const m of dayMetrics) {
      await ctx.db.insert("metricSnapshots", { ... });
    }

    return { providers: Object.keys(byProvider).length };
  },
});
```

**Imports to add** (line 1 — `internalMutation` already imported):
```typescript
import { mutation, query, internalMutation } from "./_generated/server";
```

**recordCall args extension** — add to existing `args` block (after line 15):
```typescript
    agentId: v.optional(v.string()),    // NEW — SCH-02
    toolName: v.optional(v.string()),   // NEW — SCH-02
```

**recordCall handler extension** — add to existing `ctx.db.insert` call (after line 26):
```typescript
      agentId: args.agentId,
      toolName: args.toolName,
```

**New backfill export** — add after `rollupCosts`:
```typescript
export const backfillAgentId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .filter((q) => q.eq(q.field("agentId"), undefined))
      .take(100);   // batch of 100; run repeatedly until processed === 0
    // ... join logic via sessionId → agents table
    return { processed: rows.length };
  },
});
```

---

### `convex/alertRuleCustom.ts` (service, CRUD) — MODIFY

**Analog:** `convex/alertRuleCustom.ts` itself — `conditionValidator` / `conditionGroupValidator` pattern (lines 5-15)

**Module-scope validator pattern** (lines 5-15):
```typescript
const conditionValidator = v.object({
  metric: v.string(),
  operator: v.string(),
  threshold: v.float64(),
  lookbackWindow: v.string(),
});

const conditionGroupValidator = v.object({
  conditions: v.array(conditionValidator),
  logic: v.string(),
});
```

**New validators to add at top of file** (after line 15, before `create` mutation):
```typescript
const pagerdutyConfigValidator = v.object({
  enabled: v.boolean(),
  routingKey: v.string(),
  severity: v.optional(v.string()),
});

const githubTriggerValidator = v.object({
  enabled: v.boolean(),
  repo: v.string(),
  workflowFile: v.string(),
  ref: v.string(),
});
```

**Auth pattern** (lines 31-33 — apply to all write mutations, already present):
```typescript
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
```

**create mutation args extension** — add to existing `args` block (after line 28):
```typescript
    pagerdutyConfig: v.optional(pagerdutyConfigValidator),
    githubTrigger: v.optional(githubTriggerValidator),
```

**create mutation insert extension** — add to existing `ctx.db.insert` call (after line 43):
```typescript
      pagerdutyConfig: args.pagerdutyConfig,
      githubTrigger: args.githubTrigger,
```

**update mutation args extension** — add to existing `args` block (after line 59):
```typescript
    pagerdutyConfig: v.optional(pagerdutyConfigValidator),
    githubTrigger: v.optional(githubTriggerValidator),
```
(The `{ id, ...rest }` spread on line 66 already forwards new optional fields through to `ctx.db.patch` — no handler change needed.)

---

### `convex/archival.ts` (service, batch) — MODIFY

**Analog:** `convex/archival.ts` itself — `markStaleArchived` tables list (line 17)

**Current tables list** (line 17):
```typescript
    const tables = ["events", "runtime_events", "llmMetrics", "toolExecutions", "agentMetrics"] as const;
```

**Extended tables list** — add three new delivery log tables:
```typescript
    const tables = [
      "events",
      "runtime_events",
      "llmMetrics",
      "toolExecutions",
      "agentMetrics",
      "emailDeliveryLog",          // NEW — Phase 59 D-10
      "pagerdutyDeliveryLog",      // NEW — Phase 59 D-10
      "githubTriggerLog",          // NEW — Phase 59 D-10
    ] as const;
```

All three new tables follow the same `archived: v.optional(v.boolean())` + `by_timestamp` index pattern required by `markStaleArchived`. No other handler changes needed.

---

### `convex/runtimeIngest.ts` (middleware, event-driven) — MODIFY

**Analog:** `convex/runtimeIngest.ts` itself — switch case block (lines 52-701)

**Case block pattern** — exact copy structure to follow (e.g., `hive_mind_entry` case at lines 583-603, which also carries `agentId` and `toolName`):
```typescript
        case "hive_mind_entry": {
          const d = data as any;
          await ctx.runMutation(api.hiveMind.recordEntry, {
            agentId: d.agent_type ?? d.agentType ?? "unknown",
            toolName: d.tool_name ?? d.toolName,
            // ... snake_case ?? camelCase ?? fallback pattern throughout
            timestamp,
          });
          break;
        }
```

**New case to add** — insert before the closing `}` of the switch block (after line 700), following the same snake_case ?? camelCase ?? fallback convention:
```typescript
        case "tool_execution": {
          const d = data as any;
          await ctx.runMutation(api.callGraphEdges.upsertEdge, {
            agentId: d.agentId ?? d.agent_id ?? "unknown",
            toolName: d.toolName ?? d.tool_name ?? "unknown",
            sessionId: d.sessionId ?? d.session_id ?? "unknown",
            success: d.success ?? true,
            timestamp,
          });
          break;
        }
```

**Open question (from RESEARCH.md):** If Ástríðr sends `agentId` and `toolName` on `hive_mind_entry` events (lines 583-603 confirm `toolName` and `agentType` are present), the planner should confirm whether callGraphEdges should be populated from `hive_mind_entry` instead of a new `tool_execution` case. The pattern is the same either way — just the `case` label differs.

---

## Shared Patterns

### No Auth Guard on Ingest-Facing Mutations
**Source:** `convex/llm.ts` `recordCall` (line 5-30), `convex/commandExecutions.ts` `upsertLifecycle` (line 11)
**Apply to:** `callGraphEdges.upsertEdge`, all three insert mutations in `deliveryLogs.ts`
**Rationale:** These are called internally from httpAction handlers (`runtimeIngest`, Phase 64/65 actions) that enforce Bearer token auth at the HTTP layer (CPHLTH-02). No Clerk check needed at the mutation level.

### Clerk Auth Guard on User-Facing Write Mutations
**Source:** `convex/alertRuleCustom.ts` lines 31-33; `convex/archival.ts` lines 36-38
```typescript
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
```
**Apply to:** `alertRuleCustom.ts` create, update, remove mutations (already present — just ensure extended args don't bypass it)
**Import:** `ConvexError` must be imported from `"convex/values"` (line 3 of `alertRuleCustom.ts`)

### Timestamp Convention
**Source:** `convex/alertRuleCustom.ts` line 35; `convex/llm.ts` throughout
```typescript
const now = Date.now() / 1000;   // epoch seconds, v.float64()
```
**Apply to:** All new tables. Timestamps are epoch seconds (float64), not milliseconds, not ISO strings.

### Optional Archived Field
**Source:** `convex/schema.ts` lines 14, 279
```typescript
archived: v.optional(v.boolean()),
```
**Apply to:** `callGraphEdges`, `emailDeliveryLog`, `pagerdutyDeliveryLog`, `githubTriggerLog` tables in schema.ts; and the archival extension in `archival.ts`.

### Index Naming Convention
**Source:** `convex/schema.ts` throughout
- `.index("by_alert", ["alertId", "sentAt"])` — field-based naming
- `.index("by_timestamp", ["timestamp"])` — always compound with timestamp for range queries
- `.index("by_agent_tool", ["agentId", "toolName"])` — compound multi-field follows `by_fieldA_fieldB` pattern
**Apply to:** All new table definitions.

### Batch `.take(N)` Pattern for Internal Mutations
**Source:** `convex/llm.ts` `rollupCosts` line 165; `convex/archival.ts` `markStaleArchived` line 22
```typescript
.take(1000);   // rollupCosts
.take(500);    // markStaleArchived
```
**Apply to:** `backfillAgentId` internalMutation in `llm.ts` — use `.take(100)` (conservative; document that caller must repeat until `processed === 0`).

---

## Test Pattern

### Style (pure logic, not DB round-trips)
**Source:** `convex/archival.test.ts` (lines 1-59), `convex/agentMetrics.test.ts` (lines 1-14)

```typescript
import { describe, it, expect } from "vitest";

describe("callGraphEdges", () => {
  describe("upsertEdge — upsert logic", () => {
    it("increments callCount on subsequent call", () => {
      // Test pure arithmetic, not DB
      const existing = { callCount: 3, errorCount: 1 };
      const patch = { callCount: existing.callCount + 1 };
      expect(patch.callCount).toBe(4);
    });
    it("sets status to errored when success is false", () => {
      const status = false ? "healthy" : "errored";
      expect(status).toBe("errored");
    });
    it.todo("should create new row on first call (DB round-trip)");
  });
});
```

DB-dependent paths use `it.todo()`. Pure computation/formula paths get real assertions. No live Convex test environment.

**New test files required:**
- `convex/callGraphEdges.test.ts` — SCH-01 upsert logic
- `convex/deliveryLogs.test.ts` — SCH-04 insert arg shapes
- `convex/llm.test.ts` — SCH-02 optional field args + backfill batch logic
- `convex/alertRuleCustom.test.ts` — SCH-03 new validator args

---

## No Analog Found

None — all seven files have direct analogs in the codebase. Every pattern (upsert, simple insert, internalMutation backfill, module-scope validators, switch case dispatch, archival table list) has an exact or role-match example.

---

## Metadata

**Analog search scope:** `convex/` directory
**Files read:** `schema.ts` (targeted sections), `alertRuleCustom.ts`, `llm.ts`, `runtimeIngest.ts`, `archival.ts`, `commandExecutions.ts`, `agentMetrics.test.ts`, `archival.test.ts`
**Pattern extraction date:** 2026-05-17
