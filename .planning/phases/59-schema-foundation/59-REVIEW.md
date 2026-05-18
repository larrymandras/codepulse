---
phase: 59-schema-foundation
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - convex/schema.ts
  - convex/callGraphEdges.ts
  - convex/deliveryLogs.ts
  - convex/callGraphEdges.test.ts
  - convex/deliveryLogs.test.ts
  - convex/llm.test.ts
  - convex/alertRuleCustom.test.ts
  - convex/alertRuleCustom.ts
  - convex/llm.ts
  - convex/archival.ts
  - convex/runtimeIngest.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-05-18
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 59 adds four new tables (`callGraphEdges`, `emailDeliveryLog`, `pagerdutyDeliveryLog`, `githubTriggerLog`), extends `llmMetrics` and `alertRuleCustom` with new fields, and wires everything into `runtimeIngest.ts`. The schema definitions are structurally sound. The principal bugs are a cross-session upsert collision in `callGraphEdges` (existing edges from a different session are overwritten silently) and an infinite-backfill loop risk in `llm.backfillAgentId`. Four of the five warnings are correctness-adjacent; the fifth is a meaningful data quality gap. The test suite is mostly structural smoke tests — all DB round-trip cases are deferred — which is acceptable scaffolding but leaves the core mutation logic unverified at the integration level.

---

## Critical Issues

### CR-01: `upsertEdge` ignores `sessionId` in the upsert lookup — edges from different sessions silently collide

**File:** `convex/callGraphEdges.ts:19-22`

The index lookup that drives the upsert uses only `(agentId, toolName)`:

```typescript
.withIndex("by_agent_tool", (q) =>
  q.eq("agentId", args.agentId).eq("toolName", args.toolName)
)
```

`sessionId` is accepted as an argument and stored on insert, but is **never used in the lookup**. This means if `agent-alpha` calls `web_search` in session A and then in session B, the session-B call patches the session-A row — incrementing its counters and updating `lastCallAt` — rather than creating a separate edge for session B or updating the correct row. The `sessionId` column on the edge record becomes meaningless after the first upsert.

This is a design ambiguity (is an edge per-session or global?), but the current behavior is definitely wrong: the stored `sessionId` is stale after any cross-session call. If the intent is global per-agent-tool edges, remove `sessionId` from the schema and args. If the intent is per-session, add `sessionId` to the index.

**Fix (per-session variant):**

Add `sessionId` to the `by_agent_tool` index or create a dedicated `by_agent_tool_session` index, and include it in the query:

```typescript
// schema.ts — replace the existing index
.index("by_agent_tool_session", ["agentId", "toolName", "sessionId"])

// callGraphEdges.ts — use the new index
.withIndex("by_agent_tool_session", (q) =>
  q.eq("agentId", args.agentId).eq("toolName", args.toolName).eq("sessionId", args.sessionId)
)
```

**Fix (global edges, remove stale field):** Drop `sessionId` from the `callGraphEdges` table in schema and from the `upsertEdge` args. Update `getBySession` accordingly (it would need to join via the `agents` or `events` tables or be removed).

---

### CR-02: `backfillAgentId` always returns `processed: rows.length`, never signals completion when all rows are already patched

**File:** `convex/llm.ts:228`

```typescript
return { processed: rows.length, patched };
```

The comment on line 227 states "caller repeats until processed === 0." However, `processed` is set to the number of rows that matched the `agentId === undefined` filter (line 199–204), **not** the number actually patched. If a batch of 100 rows all have `sessionId` but none of them find a matching agent in the `agents` table, `processed` returns 100 and `patched` returns 0 — but a caller following the documented protocol would re-query the same 100 rows forever, creating an infinite loop.

The correct termination sentinel is when the query returns zero rows (all `agentId`-undefined records are exhausted). But if rows exist where `agentId` is undefined AND no agent can be resolved (no matching `sessionId` in the `agents` table), the backfill can never make progress on those rows yet will keep retrying them indefinitely. There is no "give up" mechanism, no max-attempts guard, and no way to skip rows that will never resolve.

**Fix:** Either use `patched` as the completion signal (stop when `patched === 0` on a full batch), or write a sentinel value (e.g., `agentId: "unknown"`) to rows that couldn't be resolved so they are excluded from future filter passes:

```typescript
// Write a sentinel so the row is excluded from future backfill passes
if (!derivedAgentId) {
  await ctx.db.patch(row._id, { agentId: "__unresolvable__" });
  patched++;  // count as processed even if not meaningfully filled
}
// Return patched as the termination signal
return { processed: rows.length, patched };
// Caller stops when patched === 0
```

---

## Warnings

### WR-01: `archival.markStaleArchived` uses `by_timestamp` index but three new delivery-log tables lack that index path

**File:** `convex/archival.ts:17`

```typescript
const tables = ["events", "runtime_events", "llmMetrics", "toolExecutions", "agentMetrics",
  "emailDeliveryLog", "pagerdutyDeliveryLog", "githubTriggerLog"] as const;
// ...
.withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
```

`emailDeliveryLog`, `pagerdutyDeliveryLog`, and `githubTriggerLog` all index on `sentAt`, not `timestamp` — their `by_timestamp` index is defined as `.index("by_timestamp", ["sentAt"])` (schema.ts lines 948, 964, 982). The archival cron queries `.lt("timestamp", cutoff)` but the field it is range-filtering on via `by_timestamp` is actually `sentAt`. This will work at runtime (Convex resolves the index field name), but the archival cron filters on the Convex `_creationTime` system field or the literal field at position 0 of the index — here that is `sentAt`. The code is accidentally correct only because `by_timestamp` maps to `sentAt` in these tables, but calling the parameter `cutoff` and the field `timestamp` in the filter makes this extremely misleading and brittle. Any future rename or refactor will break silently.

**Fix:** For clarity and correctness, use the actual field name in the filter:

```typescript
// For delivery log tables, filter on sentAt explicitly
.filter((q) => q.neq(q.field("archived"), true))
// OR document the index field discrepancy with an explicit comment
```

Alternatively, normalize the field name to `timestamp` in the delivery log tables' schemas (preferred for consistency with the rest of the codebase).

---

### WR-02: `alertRuleCustom.update` spreads all optional args including `undefined` fields into `ctx.db.patch`

**File:** `convex/alertRuleCustom.ts:85-89`

```typescript
const { id, ...rest } = args;
await ctx.db.patch(id, {
  ...rest,
  updatedAt: Date.now() / 1000,
});
```

In Convex, `patch` with an `undefined` value on an optional field sets that field to `undefined` (removes it). If a caller sends `update({ id, pagerdutyConfig: undefined })` — which TypeScript allows for an optional field — the patch will clear the `pagerdutyConfig` on an existing rule, even though the caller's intent may have been "don't touch this field." This is the classic "partial update vs. explicit clear" footgun.

**Fix:** Strip undefined keys before patching:

```typescript
const { id, ...rest } = args;
const patch = Object.fromEntries(
  Object.entries(rest).filter(([, v]) => v !== undefined)
) as Partial<typeof rest>;
await ctx.db.patch(id, { ...patch, updatedAt: Date.now() / 1000 });
```

---

### WR-03: `listThresholdOverrides` scans the entire `agentConfigs` table with `.collect()`

**File:** `convex/alertRuleCustom.ts:193`

```typescript
const all = await ctx.db.query("agentConfigs").collect();
return all.filter((c) => c.configKey.startsWith("alert-rule-override:"))...
```

This loads every row in `agentConfigs` into memory on every call. `agentConfigs` is a shared key-value store used by multiple subsystems. As the table grows, this query degrades linearly. The filter cannot use the existing `by_key` index because `startsWith` is not an equality predicate.

**Fix:** Add a dedicated index or table for threshold overrides, or add a `type` field to `agentConfigs` and index it:

```typescript
// schema.ts — add optional type field
type: v.optional(v.string()), // "threshold_override" | "retention" | etc.

// query
.withIndex("by_type", (q) => q.eq("type", "threshold_override")).collect()
```

As a short-term workaround, at minimum add a `.take(N)` guard so the query cannot accidentally read unbounded rows.

---

### WR-04: `runtimeIngest` routes `tool_execution` events to `callGraphEdges.upsertEdge` but never records in `toolExecutions` table

**File:** `convex/runtimeIngest.ts:714-723`

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

The `toolExecutions` table (schema.ts line 518) exists specifically to capture per-execution telemetry including `durationMs`, `decision`, `decisionSource`, and `errorMessage`. This handler only updates the aggregate edge counters. Any caller sending a `tool_execution` event expecting it to appear in `toolExecutions` (e.g. for the per-execution audit trail) will get no record there. This is either a missing `api.toolExec.record` call or the event type is intentionally only for graph edges — but if the latter, the case label `"tool_execution"` is misleading given the existing table name.

**Fix:** Add the `toolExecutions` insert alongside the `upsertEdge` call, or rename the event type to `"call_graph_update"` to clarify intent.

---

### WR-05: `upsertEdge` status logic overwrites "errored" with "healthy" on any subsequent successful call

**File:** `convex/callGraphEdges.ts:30`

```typescript
status: args.success ? "healthy" : "errored",
```

An edge that has accumulated errors will have its `status` flipped back to `"healthy"` on the very next successful call, regardless of `errorCount`. This means an agent-tool pair with 50 failures and 1 success shows `status: "healthy"` — which may mislead operators. The `errorCount` field correctly accumulates failures, but `status` provides no meaningful signal beyond "last call result."

**Fix:** Base `status` on a threshold against `errorCount` / `callCount`, or at minimum document this as "last-call status" in a comment. A simple rule: only reset to `"healthy"` if the rolling error rate is below a threshold (e.g., fewer than 3 errors in the last 10 calls).

---

## Info

### IN-01: Tests do not exercise Convex DB context — all are pure logic mirrors of the source

**Files:** `convex/callGraphEdges.test.ts`, `convex/deliveryLogs.test.ts`, `convex/llm.test.ts`, `convex/alertRuleCustom.test.ts`

Every test re-implements the same inline logic already present in the source mutations (e.g., `const status = success ? "healthy" : "errored"`). These tests verify only that JavaScript ternaries work. They provide zero protection against mutation handler regressions, index mismatches, or schema violations. The 11 `it.todo` entries correctly flag this gap — they need to be filled using Convex's test harness (`convexTest()` from `convex-test`) to provide real coverage.

This is acceptable scaffolding for Phase 59, but should be tracked as a follow-up blocker before any dependent phase builds on these mutations.

---

### IN-02: `pagerdutyConfig.routingKey` stored in plaintext in the database

**File:** `convex/schema.ts:885-887`

```typescript
pagerdutyConfig: v.optional(v.object({
  enabled: v.boolean(),
  routingKey: v.string(),   // PagerDuty integration key stored as-is
```

PagerDuty routing keys are effectively API credentials that allow anyone who has them to trigger incidents. Storing them in a Convex document (accessible via any authenticated query) means the key is visible in Convex dashboard, logs, and to any function that can read `alertRuleCustom`. The same concern applies to any future GitHub token or webhook secret stored in `githubTrigger`.

This is an accepted pattern in some dashboards (Grafana, etc. store integration keys in DB), but worth flagging given the project's stated security posture. Consider masking the key on read (return only last 4 characters for display) and ensuring the `alertRuleCustom` queries are not publicly accessible (they are behind `ConvexError("Unauthenticated")` on writes, but `list` and `get` are unauthenticated reads).

---

### IN-03: Magic number `500` used as archival batch size in `archival.ts`

**File:** `convex/archival.ts:22`

```typescript
.take(500);
```

The value `500` appears without a named constant or comment explaining its derivation (Convex mutation timeout budget). This same limit appears in `callGraphEdges.listEdges` (`take(500)`, line 57) and `listEmailLogs`/`listPagerdutyLogs`/`listGithubLogs` (`take(100)`). Centralizing these as named constants would make it easier to tune them together if Convex's limits change.

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
