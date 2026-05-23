---
phase: 69-sdk-spend-guard-multi-provider-ux
reviewed: 2026-05-23T14:42:35Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - convex/_generated/api.d.ts
  - convex/alerts.test.ts
  - convex/alerts.ts
  - convex/providerConfig.ts
  - convex/schema.ts
  - convex/seedGateway.ts
  - convex/toolExecutions.ts
  - src/components/ActiveSessions.tsx
  - src/components/CostTrendChart.tsx
  - src/components/ProviderControls.test.tsx
  - src/components/ProviderControls.tsx
  - src/components/RoutingDecisionsTable.tsx
  - src/components/SDKSpendCapGauge.tsx
  - src/components/SDKSpendGuard.test.tsx
  - src/components/SDKSpendGuard.tsx
  - src/components/SessionTimeline.test.tsx
  - src/components/SessionTimeline.tsx
  - src/components/skills/__tests__/CategoryGrid.test.tsx
  - src/components/skills/__tests__/SkillsInCategory.test.tsx
  - src/components/skills/SkillsInCategory.tsx
  - src/hooks/useProviderConfig.ts
  - src/lib/providers.ts
  - src/pages/__tests__/Skills.test.tsx
  - src/pages/Analytics.tsx
  - src/pages/SessionDetail.tsx
  - src/pages/Settings.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 69: Code Review Report

**Reviewed:** 2026-05-23T14:42:35Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

This phase adds the SDK Spend Guard widget (daily cap gauge + sparkline + projection), multi-provider UX controls (drag-to-reorder, enable/disable toggles), provider badges in the session timeline, and the seed mutation for gateway defaults. The implementation is structurally sound, but contains one critical dead-code path that silently bypasses the loading state, six warnings covering logic bugs, race conditions, and type-safety gaps, and four info-level items.

---

## Critical Issues

### CR-01: `rawBuckets === undefined` check is unreachable — loading skeleton never renders

**File:** `src/components/SDKSpendGuard.tsx:47-55`

**Issue:** `rawBuckets` is initialized with `?? []` on line 45, so it can never be `undefined` at the check on line 47. The loading skeleton (`animate-pulse` placeholder) is dead code. When Convex has not yet returned data, the component immediately falls through with an empty array, computes `todaySpend = 0`, and renders the gauge showing "$0.00 of $5.00 today" — indistinguishable from genuine zero spend. Users cannot tell whether data is loading or the cap is genuinely untouched.

```tsx
// Current (broken):
const rawBuckets = useQuery(api.aggregates.costByPeriodByProvider, {
  period: "hourly",
  lookbackHours: 24,
  billingType: "api",
}) ?? [];          // <-- coalesces undefined to [] immediately

if (rawBuckets === undefined) {   // <-- never true; dead code
  return <LoadingSkeleton />;
}

// Fix — remove the ?? [] default and check undefined explicitly:
const rawBuckets = useQuery(api.aggregates.costByPeriodByProvider, {
  period: "hourly",
  lookbackHours: 24,
  billingType: "api",
});

if (rawBuckets === undefined) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-mono tracking-widest text-primary uppercase">SDK DAILY CAP</h3>
      <div className="h-2 bg-muted animate-pulse rounded-none" />
      <div className="h-10 bg-muted animate-pulse rounded-none" />
      <div className="h-4 bg-muted animate-pulse rounded-none w-1/2" />
    </div>
  );
}

const buckets = rawBuckets;  // now typed as the actual array
```

---

## Warnings

### WR-01: `evaluateInternal` stale-alert auto-resolve only fires on `status === "active"` — field is optional and often absent

**File:** `convex/alerts.ts:686-690`

**Issue:** The auto-resolve logic checks `alert.status === "active"` before patching an alert to `"resolved"`. The schema defines `status` as `v.optional(v.string())`, and the `create` mutation (line 29-38) and the public `evaluate` mutation's `createIfNew` helper (line 227-235) never write a `status` field. Alerts created by those paths will have `status === undefined`, so the auto-resolve predicate is never satisfied and stale alerts accumulate indefinitely. Only alerts created by `evaluateInternal`'s own `createIfNew` (which does not set `status` either) or by callers that explicitly pass `status: "active"` would be affected — and none do.

```ts
// Fix — remove the status guard, or write status on insert:
// Option A: remove the guard (resolve by age alone)
if (now - alert.createdAt > 21600) {
  await ctx.db.patch(alert._id, { status: "resolved", resolvedAt: now });
}

// Option B: write status on creation in createIfNew (both evaluate and evaluateInternal):
await ctx.db.insert("alerts", {
  // ...existing fields...
  status: "active",   // add this
});
```

### WR-02: `setPriority` creates new rows with `enabled: true` without consulting the existing enabled state

**File:** `convex/providerConfig.ts:48-53`

**Issue:** When a provider appears in the `providers` drag order array but has no existing config row, `setPriority` inserts a new row with `enabled: true` as a hard-coded default. If the user had previously disabled a provider via `setEnabled`, then triggered a drag-reorder that includes that provider, `setPriority` would silently re-enable it.

```ts
// Fix — read existing enabled value before inserting:
} else {
  const existing = await ctx.db
    .query("providerConfig")
    .withIndex("by_provider", (q) => q.eq("provider", provider))
    .first();
  await ctx.db.insert("providerConfig", {
    provider,
    enabled: existing?.enabled ?? true,   // preserve prior state
    priority: index,
    updatedAt: Date.now() / 1000,
  });
}
```

Note: The inner `existing` query is actually already performed earlier in the same loop iteration; refactor to reuse it rather than querying twice.

### WR-03: `handleDragEnd` in `ProviderControls` calls `setPriority` on every drag but `orderedProviders` may contain providers not yet in Convex

**File:** `src/components/ProviderControls.tsx:209-219`

**Issue:** `orderedProviders` is initialised from `GATEWAY_PROVIDERS` (all four providers) regardless of what rows exist in the database. If `seedGatewayProfiles` has not been run and configs is empty, the component shows the seed prompt — but once at least one config row exists, `configs.length > 0` is true, the seed prompt disappears, and `orderedProviders` is synced to only the providers that have config rows. However `setPriority` receives the full `reordered` array — which may include providers that have no row yet — and `providerConfig.setPriority` will create new rows for them with `enabled: true` (see WR-02). This means dragging after partial seeding will ghost-create rows for un-seeded providers.

```ts
// Fix — filter orderedProviders to only providers already in configs before sending:
const knownProviders = configs.map(c => c.provider);
const reordered = arrayMove(orderedProviders, oldIndex, newIndex)
  .filter(p => knownProviders.includes(p));
setOrderedProviders(reordered);
setPriority({ providers: reordered });
```

### WR-04: Provider-to-toolExecution matching is timestamp-rounded and can produce wrong badges when two different tools fire within the same second

**File:** `src/components/SessionTimeline.tsx:46-55`

**Issue:** The `toolExecProviderMap` uses `toolName:Math.round(timestamp)` as the key. If two different tool calls with the same name fire within the same second (e.g., two sequential `read_file` calls 0.3 s apart), both events will map to the same key and the second one will display whichever provider was inserted first. The map will silently show the wrong badge. This is a correctness issue when session volume is high.

```ts
// Fix — use the event's _id as primary lookup key rather than a timestamp approximation,
// or pass toolExecution._id alongside each event when building the map.
// Alternatively, match on toolName + sessionId + Math.round(timestamp) and
// accept the last-write-wins behavior, but document it explicitly.
```

### WR-05: `toolExecutions.successRate` and `toolExecutions.avgDuration` queries do a full table scan on every call

**File:** `convex/toolExecutions.ts:33-44` and `convex/toolExecutions.ts:66-77`

**Issue:** Both queries call `.collect()` on the entire `toolExecutions` table and then filter in JavaScript with `e.timestamp >= cutoff`. The `by_timestamp` index is ordered; the queries should use `.order("desc").take(N)` or a range index filter, not collect everything. On a production instance with thousands of executions, this will eventually hit Convex's document-read limit and throw a runtime error, silently breaking the success rate and avg duration widgets.

```ts
// Fix — use index range to avoid full scan:
const cutoff = Date.now() / 1000 - 86400;
const recent = await ctx.db
  .query("toolExecutions")
  .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
  .collect();
// No JavaScript filter needed — index filter handles the cutoff.
```

### WR-06: `IntelligenceSettings` swallows save errors silently

**File:** `src/pages/Settings.tsx:138-148`

**Issue:** The `handleSave` function in `IntelligenceSettings` has a `try/catch` that resets `saveState` to `"idle"` on failure but never shows the user any error feedback (no `toast.error`, no error state in the UI). If the Convex mutation fails (network error, validation error), the button returns to "Save Budget Settings" with no indication the save failed.

```tsx
// Fix — surface the error:
} catch (err) {
  setSaveState("idle");
  toast.error("Failed to save budget cap. Please try again.");
}
```

---

## Info

### IN-01: `SDKSpendCapGauge.tsx` is now a re-export shim — callers in other files should be updated to import from `SDKSpendGuard`

**File:** `src/components/SDKSpendCapGauge.tsx:1-3`

**Issue:** The file exists purely as a backward-compat shim. Any callers still importing from `SDKSpendCapGauge` will get the re-export, which works, but creates an unnecessary indirection. If `SDKSpendCapGauge` is not referenced anywhere outside this phase's new files, the shim can be deleted.

**Fix:** Run a codebase search for `SDKSpendCapGauge` imports; if none exist outside the shim itself, delete the file.

### IN-02: `Analytics.tsx` uses array index as React key for advisor cost table rows

**File:** `src/pages/Analytics.tsx:302`

**Issue:** `key={i}` on a mapped table row derived from `advisorRecent` — a live Convex query — will cause incorrect diffing if rows are inserted or removed at positions other than the end.

```tsx
// Fix — use a stable identifier:
<TableRow key={`${evt.provider}-${evt.timestamp}`}>
```

### IN-03: `alerts.ts` `evaluate` (public mutation) duplicates the entire rule-check body from `evaluateInternal` without threshold-override or webhook support

**File:** `convex/alerts.ts:195-662`

**Issue:** The public `evaluate` mutation is ~460 lines of checks that are largely a subset of `evaluateInternal`. The public version lacks threshold-override support, webhook scheduling, and custom-rule evaluation. This is a maintenance hazard: any rule change must be made in two places. Consider deprecating the public mutation or delegating to the internal one.

**Fix:** Either mark `evaluate` as deprecated and route callers to `evaluateInternal`, or have `evaluate` call `ctx.runMutation(internal.alerts.evaluateInternal)`.

### IN-04: `seedGateway.ts` hardcodes `"claude-sonnet-4-6"` as the model for the `claude-sdk` profile

**File:** `convex/seedGateway.ts:11`

**Issue:** Model names like `"claude-sonnet-4-6"` will become stale as new model versions are released. This is a seed function (idempotent, only runs once), but the hardcoded value will be wrong for any new deployment after a model upgrade. Consider sourcing from a constant shared with `src/lib/providers.ts`.

**Fix:** Export a `GATEWAY_PROVIDER_DEFAULTS` map from `providers.ts` and import it in `seedGateway.ts`.

---

_Reviewed: 2026-05-23T14:42:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
