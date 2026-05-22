---
phase: 68-gateway-observability
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - convex/aggregates.ts
  - convex/crons.ts
  - convex/gatewayQuota.ts
  - convex/gatewayQuota.test.ts
  - convex/gatewayTasks.ts
  - convex/gatewayTasks.test.ts
  - convex/otelLogs.ts
  - convex/routingDecisions.ts
  - convex/routingDecisions.test.ts
  - src/components/CostTrendChart.tsx
  - src/components/FlexBarChart.tsx
  - src/components/FlexBarChart.test.tsx
  - src/components/GatewayQuotaPanel.tsx
  - src/components/GatewayTasksPanel.tsx
  - src/components/LlmProviderPanel.tsx
  - src/components/ProviderComparisonChart.tsx
  - src/components/RoutingDecisionsTable.tsx
  - src/hooks/useGatewayTasks.ts
  - src/hooks/useRoutingDecisions.ts
  - src/pages/Analytics.tsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 68: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 68 adds gateway observability: quota snapshots (polled from Astridr every 5 minutes), gateway task tracking, routing decision logging, and a new OTel ingest path for gateway events. The backend is solid and the schema is well-structured. However, there are two blockers: the `latestByProvider` query has a hard cap of 100 rows that silently drops providers when the table grows, and the `listPaginated` query for routing decisions accepts a `fallbackOnly` filter argument but never applies it. There are also several warnings around timestamp precision loss, negative-time display in UI components, a missing upsert idempotency gap in gateway tasks, and a missing `billingType` in the OTel gateway event paths.

---

## Critical Issues

### CR-01: `latestByProvider` silently drops providers when snapshot count exceeds 100

**File:** `convex/gatewayQuota.ts:130`

**Issue:** The query fetches at most 100 rows from `gatewayQuotaSnapshots` with `.take(100)`, then deduplicates to one row per provider. The cron runs every 5 minutes and inserts one row per provider per poll cycle. With 6 providers, after 17 poll cycles (~85 minutes), the 100-row cap is hit and the oldest rows are silently excluded. Since `take` operates on the most recent rows (desc), this specific ordering means the 100-row window contains only recent rows per provider and deduplication likely still works — but only so long as each provider has had at least one snapshot in the most recent 100 inserts.

The real failure mode: if one provider is temporarily offline for several cycles while others continue polling, its last row could fall outside the 100-row window. With more than ~16-17 providers, any given provider's latest snapshot falls outside the window immediately. The `.take(100)` hard cap is unpredictable and grows more fragile as the system scales.

**Fix:** Use a proper per-provider index instead of take-then-deduplicate. The schema has `by_provider` indexed on `["provider", "timestamp"]`. Fetch the latest snapshot per known provider directly:

```typescript
export const latestByProvider = query({
  args: {},
  handler: async (ctx) => {
    // One indexed read per provider — O(providers) not O(total_snapshots)
    const results: (typeof ctx.db._types.gatewayQuotaSnapshots | null)[] = [];
    for (const provider of ALL_PROVIDERS) {
      const row = await ctx.db
        .query("gatewayQuotaSnapshots")
        .withIndex("by_provider", (q) => q.eq("provider", provider))
        .order("desc")
        .first();
      if (row) results.push(row);
    }
    return results;
  },
});
```

Alternatively, bump the take limit to a number that guarantees coverage (e.g., providers * expected_cycles_retained), but the index approach is correct and scalable.

---

### CR-02: `listPaginated` in `routingDecisions.ts` ignores the `fallbackOnly` filter

**File:** `convex/routingDecisions.ts:37-48`

**Issue:** The query accepts a `fallbackOnly: v.optional(v.boolean())` argument, and the JSDoc says it "returns only decisions where a fallback was used." But the handler does not filter on this field at all — it returns all routing decisions regardless of the argument value. Any UI or consumer that passes `fallbackOnly: true` will silently receive unfiltered results.

```typescript
// Current — filter arg declared but never used:
handler: async (ctx, args) => {
  return await ctx.db
    .query("routingDecisions")
    .withIndex("by_timestamp")
    .order("desc")
    .paginate(args.paginationOpts);
  // args.fallbackOnly is never read
},
```

**Fix:** The schema already has a `by_fallback` index on `["fallbackUsed", "timestamp"]`. Use it when the filter is requested:

```typescript
handler: async (ctx, args) => {
  if (args.fallbackOnly) {
    return await ctx.db
      .query("routingDecisions")
      .withIndex("by_fallback", (q) => q.eq("fallbackUsed", true))
      .order("desc")
      .paginate(args.paginationOpts);
  }
  return await ctx.db
    .query("routingDecisions")
    .withIndex("by_timestamp")
    .order("desc")
    .paginate(args.paginationOpts);
},
```

---

## Warnings

### WR-01: OTel `gateway.task_completed` and `gateway.task_started` do not forward `billingType`

**File:** `convex/otelLogs.ts:236-274`

**Issue:** The `gateway.task_completed` and `gateway.task_started` event handlers call `api.gatewayTasks.upsert` without passing `billingType`. The `upsert` mutation accepts `billingType` as an optional argument and the `gatewayTasks` schema stores it. As a result, tasks inserted via OTel will always have `billingType: undefined`, making it impossible to distinguish API vs subscription tasks in the `providerStats` query or any future billing breakdown.

The `gateway.task_failed` handler also lacks `billingType`. All three handlers have access to `attrs` and can extract it with `getAttr(attrs, "billing_type")`.

**Fix:** Add `billingType` extraction in all three gateway task handlers:

```typescript
case "gateway.task_completed": {
  await ctx.runMutation(api.gatewayTasks.upsert, {
    taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
    sessionId,
    provider: getAttr(attrs, "provider") ?? "unknown",
    billingType: getAttr(attrs, "billing_type"),  // add this
    status: "completed",
    durationSeconds: getNumAttr(attrs, "duration_seconds"),
    timestamp,
  });
  // ...
}
```

Apply the same change to `gateway.task_started` and `gateway.task_failed`.

---

### WR-02: Timestamp precision loss in `nanoToSec` for large nanosecond values

**File:** `convex/otelLogs.ts:34-38`

**Issue:** `parseInt(nanos, 10)` is used to parse a nanosecond Unix timestamp string. Current nanosecond timestamps are approximately `1748000000000000000` (1.748e18). JavaScript's `parseInt` returns a standard 64-bit float, which has 53 bits of mantissa precision — enough for integers up to ~9e15. At 1.748e18, the integer is ~200x beyond that precision boundary. `parseInt` will round to the nearest representable float, introducing an error of approximately 256 nanoseconds per conversion (due to rounding to the nearest power-of-2 float step at this scale).

This results in timestamps that are wrong by microseconds, which can cause ordering issues in the database.

**Fix:** Use `BigInt` for parsing, then convert after dividing by 1e9:

```typescript
function nanoToSec(nanos: string | number | undefined): number {
  if (!nanos) return Date.now() / 1000;
  if (typeof nanos === "number") return nanos / 1_000_000_000;
  // Parse as BigInt to avoid float precision loss at nanosecond scale
  try {
    return Number(BigInt(nanos)) / 1_000_000_000;
  } catch {
    return Date.now() / 1000;
  }
}
```

---

### WR-03: Negative elapsed time displayed in `GatewayTasksPanel` and `RoutingDecisionsTable`

**File:** `src/components/GatewayTasksPanel.tsx:57-63`, `src/components/RoutingDecisionsTable.tsx:52-58`

**Issue:** Both components compute relative time as:

```typescript
const ago = Math.round((Date.now() / 1000 - t.timestamp) / 60);
```

If the event timestamp is slightly in the future (possible with clock skew between the gateway and Convex, or due to precision issues in `nanoToSec`), `ago` will be negative, producing display strings like `-1m ago` or `-0m ago`. This is confusing and suggests a data integrity issue to users.

**Fix:** Clamp `ago` to 0 before formatting:

```typescript
const ago = Math.max(0, Math.round((Date.now() / 1000 - t.timestamp) / 60));
```

---

### WR-04: `upsert` in `gatewayTasks.ts` does not update `provider` or `billingType` on patch

**File:** `convex/gatewayTasks.ts:91-97`

**Issue:** When a task already exists and `upsert` patches it (the `started → completed` lifecycle), it only patches `status`, `durationSeconds`, `error`, and `timestamp`. It does not update `provider` or `billingType`. This is mostly correct since those should be set on the initial `task_started` insert. However, if the first event to arrive is `task_completed` (out-of-order delivery, which is possible with OTel), the task will be inserted with `status: "completed"` but any prior `task_started` event will then patch it back to `status: "running"` when it arrives late — corrupting the status.

The upsert semantics assume strict event ordering, but OTel delivery makes no ordering guarantees.

**Fix:** Only advance status forward (completed > failed > running), never backward:

```typescript
if (existing) {
  // Only advance status: completed/failed should not be overwritten by running
  const STATUS_RANK: Record<string, number> = { running: 0, failed: 1, completed: 2 };
  const currentRank = STATUS_RANK[existing.status] ?? 0;
  const newRank = STATUS_RANK[args.status] ?? 0;
  if (newRank >= currentRank) {
    await ctx.db.patch(existing._id, {
      status: args.status,
      durationSeconds: args.durationSeconds ?? existing.durationSeconds,
      error: args.error ?? existing.error,
      timestamp: args.timestamp,
    });
  }
}
```

---

### WR-05: `computeHourly` double-counts errors — totals for "all" category can diverge from per-category sums

**File:** `convex/aggregates.ts:120-138`

**Issue:** The error aggregation inserts both an "all" aggregate row (line 121-129) and individual per-category rows (lines 130-138). The `errorTrendByPeriod` query returns all error rows including both the "all" row and the per-category rows without filtering. Any consumer that sums all returned rows (or expects the "all" row to equal the sum of per-category rows) will double-count. Also, the "all" aggregate is only inserted when `totalErrors > 0` (line 121), but re-runs of `computeHourly` for the same hour with new data will skip adding the "all" row because it already exists — but new per-category rows could still be added, making "all" permanently undercount from that hour forward.

**Fix:** Either exclude the "all" aggregate row and let consumers sum per-category rows, or make the "all" row an upsert (update value if exists). Given the current idempotency model doesn't support updates, the simplest fix is to remove the "all" aggregate row and update `errorTrendByPeriod` consumers to sum appropriately.

---

### WR-06: `GatewayQuotaPanel` uses `remainingPct` directly as a CSS width percentage without bounds check

**File:** `src/components/GatewayQuotaPanel.tsx:69-72`

**Issue:** The quota bar width is set as `${Math.round(snapshot.remainingPct * 100)}%`. The `remainingPct` value comes from the Astridr API response and is stored as-is (no clamping in `insertSnapshot`). If the gateway returns a value outside `[0, 1]` (e.g., `1.05` due to rounding, or negative when overdraft), the bar will render outside bounds: wider than the container or with a negative width, breaking the layout.

**Fix:** Clamp before use:

```typescript
const pct = Math.min(100, Math.max(0, Math.round(snapshot.remainingPct * 100)));
// then use pct in both the label and the style
```

---

## Info

### IN-01: Test suites for `gatewayTasks` and `routingDecisions` only test static shape, not behavior

**File:** `convex/gatewayTasks.test.ts:6-28`, `convex/routingDecisions.test.ts:5-51`

**Issue:** The `upsert lifecycle` tests (lines 6-28 in `gatewayTasks.test.ts`) only assert that a plain object has expected properties — they do not actually call `upsert` or verify that the Convex mutation behaves correctly. The routing decisions tests similarly only sort an in-memory array, not the actual query. These tests provide false confidence: `CR-02` (filter not applied) and `WR-04` (out-of-order upsert) would not be caught by the current test suite.

**Fix:** Use Convex's testing utilities or integration tests that exercise the actual handler logic. At minimum, add unit tests for `computeProviderStats` edge cases such as all-failed providers and a provider with zero completed tasks but non-zero duration values.

---

### IN-02: `claude-cli` and `claude-sdk` share the same color in `PROVIDER_COLORS`

**File:** `src/components/CostTrendChart.tsx:8-9`, `src/components/ProviderComparisonChart.tsx:8-9`

**Issue:** Both `claude-cli` and `claude-sdk` are assigned `#10b981` (the same green). On stacked bar charts where both providers appear simultaneously, their segments are visually indistinguishable. This is present in both files (duplicated color map).

**Fix:** Assign distinct colors and consolidate the `PROVIDER_COLORS` constant into a shared `lib/providerColors.ts` file to avoid future drift.

---

### IN-03: `Analytics.tsx` imports `FlexBarChart` and table primitives directly but only uses them in leaf sections

**File:** `src/pages/Analytics.tsx:32-42`

**Issue:** `Analytics.tsx` directly imports `FlexBarChart`, `Table`, `TableHeader`, etc. for the Advisor Strategy and Execution Depth sections. These sections should be extracted into dedicated components (e.g., `AdvisorStrategyPanel`, `ExecutionDepthPanel`) consistent with how all other sections in this page are structured. The page component is already 317 lines and growing; mixing layout with leaf-level rendering increases cognitive load and makes the components untestable in isolation.

**Fix:** Extract the Advisor Strategy block (lines 271-314) and Execution Depth block (lines 256-269) into standalone components.

---

### IN-04: `void errorTrend` suppression comment signals dead code

**File:** `src/pages/Analytics.tsx:72-73`

**Issue:** The `errorTrend` query result is fetched (line 56) and then immediately suppressed with `void errorTrend` (line 73) to avoid a lint warning. The comment "available for future ErrorRateTrend prop swap" indicates this is intentional placeholder work, but the effect is an unnecessary Convex query being executed on every Analytics page load with no consumer. This wastes a network round-trip and a Convex read operation every time the page is mounted.

**Fix:** Remove the `errorTrend` query from `Analytics.tsx` until `ErrorRateTrend` actually needs it passed as a prop. The `ErrorRateTrend` component presumably fetches its own data already (consistent with how other child components are structured here).

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
