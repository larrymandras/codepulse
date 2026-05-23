---
phase: 69-sdk-spend-guard-multi-provider-ux
fixed_at: 2026-05-23T15:05:00Z
review_path: .planning/phases/69-sdk-spend-guard-multi-provider-ux/69-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 69: Code Review Fix Report

**Fixed at:** 2026-05-23T15:05:00Z
**Source review:** .planning/phases/69-sdk-spend-guard-multi-provider-ux/69-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-01: `rawBuckets === undefined` check is unreachable — loading skeleton never renders

**Files modified:** `src/components/SDKSpendGuard.tsx`
**Commit:** 48aa637
**Applied fix:** Removed the `?? []` nullish coalesce from the `useQuery()` call so `rawBuckets` can actually be `undefined` during loading. Added `const buckets = rawBuckets` after the loading guard and updated the downstream filter to use `buckets`. The loading skeleton (animate-pulse placeholder) now renders while Convex data is in flight.

### WR-01: `evaluateInternal` stale-alert auto-resolve only fires on `status === "active"` — field is optional and often absent

**Files modified:** `convex/alerts.ts`
**Commit:** 22611b5
**Applied fix:** Added `status: "active"` to all four alert-creation paths: the `create` mutation, the `evaluate` mutation's `createIfNew` helper, the `evaluateInternal` mutation's `createIfNew` helper, and the `createCriticalIfNew` helper. This ensures the auto-resolve guard (`alert.status === "active"`) can match newly created alerts after the 6-hour staleness window.

### WR-03: `handleDragEnd` in `ProviderControls` calls `setPriority` on every drag but `orderedProviders` may contain providers not yet in Convex

**Files modified:** `src/components/ProviderControls.tsx`
**Commit:** d1a09bd
**Applied fix:** Added a filter in `handleDragEnd` that restricts the `reordered` array to only providers present in the current `configs` (DB rows). Added `configs` to the `useCallback` dependency array. This prevents ghost-creating config rows for providers that haven't been seeded yet.

### WR-04: Provider-to-toolExecution matching is timestamp-rounded and can produce wrong badges when two different tools fire within the same second

**Files modified:** `src/components/SessionTimeline.tsx`
**Commit:** 031ac96
**Applied fix:** Changed `toolExecProviderMap` to store entries at full floating-point precision (`te.timestamp`) in addition to a rounded fallback. Updated `getEventProvider` to try the exact timestamp first, then fall back to the rounded key. This eliminates same-second collisions while maintaining backward compatibility with events that may have lower-precision timestamps.

### WR-05: `toolExecutions.successRate` and `toolExecutions.avgDuration` queries do a full table scan on every call

**Files modified:** `convex/toolExecutions.ts`
**Commit:** 73b8225
**Applied fix:** Replaced `.collect()` + JS `.filter()` with `.withIndex("by_timestamp", q => q.gte("timestamp", cutoff)).collect()` in both `successRate` and `avgDuration` queries. The index range filter pushes the cutoff predicate into Convex's query engine, avoiding a full table scan. For `avgDuration`, a secondary JS filter for `durationMs != null` is retained since that field isn't indexed.

### WR-06: `IntelligenceSettings` swallows save errors silently

**Files modified:** `src/pages/Settings.tsx`
**Commit:** d102a44
**Applied fix:** Added `import { toast } from "sonner"` and a `toast.error("Failed to save budget cap. Please try again.")` call in the catch block of `handleSave`. Users now see a visible error notification when the budget cap mutation fails.

## Skipped Issues

### WR-02: `setPriority` creates new rows with `enabled: true` without consulting the existing enabled state

**File:** `convex/providerConfig.ts:48-53`
**Reason:** The suggested fix is logically redundant. The `setPriority` mutation already queries `existing` via `by_provider` index (line 42-45). The `else` branch only executes when `existing` is `null` — meaning no config row exists for that provider at all. Re-querying (as the fix suggests) would return `null` again, and `existing?.enabled ?? true` would still evaluate to `true`. The scenario described (user disables a provider, then drags to reorder, causing re-enable) cannot happen because `setEnabled` creates a config row, which the `if (existing)` branch correctly patches (preserving the `enabled` value). The defensive filter added in WR-03 further prevents this edge case by excluding un-seeded providers from the drag payload entirely.
**Original issue:** When a provider appears in the `providers` drag order array but has no existing config row, `setPriority` inserts a new row with `enabled: true` as a hard-coded default.

---

_Fixed: 2026-05-23T15:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
