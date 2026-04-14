---
phase: 05-data-pipeline
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - convex/_generated/api.d.ts
  - convex/agents.ts
  - convex/aggregates.test.ts
  - convex/aggregates.ts
  - convex/alerts.ts
  - convex/analytics.ts
  - convex/archival.test.ts
  - convex/archival.ts
  - convex/commandExecutions.ts
  - convex/crons.ts
  - convex/events.ts
  - convex/llm.ts
  - convex/schema.ts
  - convex/security.ts
  - convex/sessions.ts
  - src/components/EventFeed.tsx
  - src/components/LlmProviderPanel.tsx
  - src/components/LoadMoreButton.tsx
  - src/hooks/useAgentTopology.ts
  - src/hooks/useAlerts.ts
  - src/hooks/useLlmMetrics.ts
  - src/hooks/useRecentEvents.test.ts
  - src/hooks/useRecentEvents.ts
  - src/hooks/useSecurityEvents.ts
  - src/pages/Agents.tsx
  - src/pages/Alerts.tsx
  - src/pages/Analytics.tsx
  - src/pages/Dashboard.tsx
  - src/pages/Executions.tsx
  - src/pages/Security.tsx
  - src/pages/Settings.tsx
findings:
  critical: 1
  warning: 7
  info: 6
  total: 14
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

This phase implements a data pipeline: hourly/daily aggregation crons, archival, the `commandExecutions` lifecycle tracker, and frontend wiring for paginated queries and aggregate-driven analytics. The overall architecture is solid — aggregation is correctly separated from raw table scans, archival uses a batch limit, and the `evaluate` mutation is comprehensive. One critical issue stands out: hardcoded personal email addresses committed into source code. Seven warnings cover logic correctness issues, unbounded full-table scans in queries, and a deduplication bug in the alert engine. Six info items cover dead code, unused suppressions, and minor inconsistencies.

---

## Critical Issues

### CR-01: Hardcoded Personal Email Addresses in Source Code

**File:** `src/pages/Settings.tsx:129-133`
**Issue:** Personal and work email addresses (`mandrasle@gmail.com`, `lmandras@myprotectall.com`) are hardcoded as literal strings in a source file that is committed to the repository. This means they will appear in git history, any forks, any CI logs that print diffs, and any public repo exposure. Email addresses are PII, and work email in a business context may violate data-handling policies.
**Fix:**
```tsx
// Move to environment variables or a runtime config — never source code.
// Option A: .env file (which is .gitignored)
const PROFILE_DEFAULTS: Record<string, { label: string; email: string }> = {
  personal:    { label: "Personal",    email: import.meta.env.VITE_EMAIL_PERSONAL    ?? "" },
  business:    { label: "Business",   email: import.meta.env.VITE_EMAIL_BUSINESS    ?? "" },
  consulting:  { label: "Consulting", email: import.meta.env.VITE_EMAIL_CONSULTING  ?? "" },
};
// Option B: remove defaults entirely — the user enters them via the UI and they
// are persisted in profileConfigs. On first load, the input is just empty.
```

---

## Warnings

### WR-01: `evaluate` Deduplication Uses Wrong Set — Misses Active Alerts by Source

**File:** `convex/alerts.ts:219`
**Issue:** The dedup guard builds `activeSourceSet` from `a.source`, but `createIfNew` checks `activeSourceSet.has(ruleId)` — where `ruleId` is the alert rule ID (e.g. `"std-high-error-rate"`), not `source`. Because `source` is also set to `ruleId` in the insert (`source: ruleId`), these happen to match — but the initial population uses `a.source` while the check uses `ruleId`, making the dedup semantically fragile. A future rule that uses a different `source` value than its `ruleId` will silently create duplicates.

**Fix:**
```typescript
// Be explicit: key the set on ruleId to match what createIfNew checks.
const activeSourceSet = new Set(activeAlerts.map((a) => a.source));
// This is technically correct today only because source === ruleId in all inserts.
// Add a comment or enforce the invariant in createIfNew:
async function createIfNew(ruleId: string, severity: string, source: string, message: string) {
  if (source !== ruleId) {
    // source and ruleId must match for dedup to work correctly
    console.warn(`Alert dedup mismatch: ruleId=${ruleId} source=${source}`);
  }
  if (disabledRules.has(ruleId)) return;
  if (activeSourceSet.has(ruleId)) return; // relies on source === ruleId
  ...
}
```

### WR-02: `autoAcknowledgeStale` Is a Public Mutation That Duplicates `autoAcknowledgeStaleInternal`

**File:** `convex/alerts.ts:125-148`
**Issue:** `autoAcknowledgeStale` (lines 125-148) is a public `mutation` with identical logic to `autoAcknowledgeStaleInternal` (lines 150-173). The public version allows any unauthenticated client to trigger mass-acknowledgement of all non-critical alerts. The cron at `convex/crons.ts:9` already uses the internal version. The public version is not used anywhere in the reviewed frontend code.
**Fix:** Remove or convert `autoAcknowledgeStale` to internal-only. If UI-triggerable bulk acknowledgement is needed, the existing `dismissAll` mutation (line 106) already serves that purpose.

### WR-03: `listBySource` Performs an Uncapped Full-Table Scan With Client-Side Filter

**File:** `convex/alerts.ts:75-88`
**Issue:** `listBySource` fetches up to 500 rows without using a `by_source` index (which doesn't exist), then filters client-side. For large alert volumes, this wastes read units and may return incorrect results if the relevant source alerts are beyond the 500-row window.
**Fix:** Add a `by_source` index to the `alerts` table in `schema.ts`, then use it:
```typescript
// schema.ts — alerts table
.index("by_source", ["source", "createdAt"])

// alerts.ts — listBySource
return await ctx.db
  .query("alerts")
  .withIndex("by_source", (q) => q.eq("source", args.source))
  .order("desc")
  .take(limit);
```

### WR-04: `detail` Query in `agents.ts` Uses a Hard `.take(500)` to Estimate Event Count

**File:** `convex/agents.ts:111-115`
**Issue:** The `eventCount` returned from `detail` is capped at 500 — if a session has more than 500 events, the count will be silently truncated and reported as 500 (or whatever `.take(500)` returns). This misleads the UI. Additionally, loading up to 500 events to count them is expensive for a scalar value.
**Fix:** Store `eventCount` on the session record (it already is — `sessions.eventCount`) and use that, or add a `by_session` count index. For the `detail` query, use the session's `eventCount` field:
```typescript
// Instead of a separate events query:
const sessionData = await ctx.db
  .query("sessions")
  .withIndex("by_sessionId", (q) => q.eq("sessionId", agent.sessionId))
  .first();

return {
  ...agent,
  coordination: [...outgoing, ...incoming].sort(...).slice(0, 30),
  eventCount: sessionData?.eventCount ?? 0,
};
```

### WR-05: `tokenSunburst` and Several `llm.ts` Queries Perform Full-Table Scans with No Limit

**File:** `convex/analytics.ts:96`, `convex/llm.ts:59`, `convex/llm.ts:72`, `convex/llm.ts:89`, `convex/llm.ts:111`, `convex/llm.ts:129`
**Issue:** `tokenSunburst`, `costByProvider`, `costByModel`, `providerBreakdown`, `costOverTime`, and `latencyOverTime` all call `.collect()` on `llmMetrics` without a limit. As the table grows, these queries will read unbounded rows on every subscription update. `costOverTime` and `latencyOverTime` in particular return every row to the client, which will cause UI performance and memory issues at scale.

**Fix:** For `costOverTime` / `latencyOverTime`, use the pre-computed aggregates from the Phase 05 pipeline rather than raw rows. For the summary queries (`costByProvider`, `costByModel`, `providerBreakdown`), add a lookback cutoff:
```typescript
// Add a time-bounded scan (e.g., last 30 days) to cap reads:
const cutoff = Date.now() / 1000 - 30 * 86400;
const all = await ctx.db
  .query("llmMetrics")
  .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
  .filter((q) => q.neq(q.field("archived"), true))
  .collect();
```

### WR-06: `computeHourly` Has No Idempotency Guard — Re-runs Double-Insert Aggregates

**File:** `convex/aggregates.ts:5-89`
**Issue:** If `computeHourly` runs twice for the same hour (e.g., due to a Convex cron retry after a transient failure, or a manual trigger), it inserts duplicate aggregate rows for the same `(metric_type, period, bucket_start, dimensions)` combination. Downstream queries accumulate duplicate values, inflating all analytics metrics.

**Fix:** Before inserting, check whether an aggregate for this bucket already exists:
```typescript
// In each insert loop, guard with an existence check:
const existing = await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "cost").eq("period", "hourly").eq("bucket_start", hourStart)
  )
  .first();
if (!existing) {
  // proceed with inserts
}
// OR: upsert by patching if a matching record exists.
```
A simpler approach is to add a unique composite key check or use a "mark as computed" flag per bucket.

### WR-07: `hitlStats` Computes `todayStart` Incorrectly — Off By UTC Offset

**File:** `convex/security.ts:107`
**Issue:** `todayStart` is computed as `now - (now % 86400)`, which gives the start of the current UTC day. However, this is only correct if the server uses UTC, and the display label "today" in the UI is local-time relative. If the user is in a timezone west of UTC, events from this morning (local time) may fall before the computed `todayStart`, causing `resolvedToday` to be undercounted. This is a correctness/logic issue for date-bounded metrics.

**Fix:** Either document that all timestamps are UTC and the UI accepts UTC-day boundaries, or compute `todayStart` using a consistent midnight calculation:
```typescript
// Explicit UTC midnight:
const nowDate = new Date(now * 1000);
const todayStart = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()) / 1000;
```
This matches the existing pattern used elsewhere in the codebase (e.g., `aggregates.ts` bucket calculations).

---

## Info

### IN-01: Dead Code — `void errorTrend` Suppression in `Analytics.tsx`

**File:** `src/pages/Analytics.tsx:38`
**Issue:** `errorTrend` is fetched and immediately suppressed with `void errorTrend`. This is a placeholder indicating a planned prop-pass to `ErrorRateTrend` that was never completed. The query runs on every render and returns data that is discarded.
**Fix:** Either wire `errorTrend` into `ErrorRateTrend` as a prop (the intended use per the inline comment), or remove the `useQuery` call and let `ErrorRateTrend` fetch its own data internally (which it already does).

### IN-02: `Agents.tsx` — `isLive` Conditional in `MetricCard` Is a No-op

**File:** `src/pages/Agents.tsx:341`
**Issue:** The ternary `isLive && liveState.agentStatus === "running" ? counts.running : counts.running` always evaluates to `counts.running`. Both branches are identical.
**Fix:**
```tsx
<MetricCard label="Running" value={counts.running} />
```
If the intent was to show a WS-sourced delta when live, implement that delta similar to how `Executions.tsx` handles `wsRunningDelta`.

### IN-03: `countByType` in `events.ts` Performs an Unbounded Full Table Scan

**File:** `convex/events.ts:206-218`
**Issue:** `countByType` on `runtime_events` calls `.collect()` with no limit. This is a legacy function, but it is still exported publicly and could be subscribed to, causing unbounded reads as the table grows.
**Fix:** Add a recency limit or deprecate in favor of the Phase 05 aggregate queries:
```typescript
// Add a recent-only guard or mark as deprecated:
// @deprecated — use aggregates.eventCountsByPeriod instead
```

### IN-04: `listErrors` and `listPrompts` in `events.ts` Do Full Session Scans With Client-Side Filter

**File:** `convex/events.ts:96-128`
**Issue:** Both functions fetch all events for a session via `.collect()` then filter client-side by `eventType`. For sessions with thousands of events, this reads all of them to return a small subset.
**Fix:** Add compound indexes (which already partially exist) and use `by_type` filtering server-side, or add a `by_session_type` index:
```typescript
// schema.ts — add composite index:
.index("by_session_type", ["sessionId", "eventType", "timestamp"])

// events.ts:
return await ctx.db
  .query("events")
  .withIndex("by_session_type", (q) =>
    q.eq("sessionId", args.sessionId).eq("eventType", "Error")
  )
  .order("desc")
  .take(limit);
```

### IN-05: `evaluate` and `evaluateInternal` Are Largely Duplicated (200+ Lines)

**File:** `convex/alerts.ts:204-738`
**Issue:** `evaluate` (public) and `evaluateInternal` (internal) share near-identical logic but are separate functions. The internal version is a trimmed subset of the public version. Any change to alert thresholds, rule IDs, or logic requires editing both. This is a maintenance risk.
**Fix:** Extract shared rule-evaluation logic into a shared helper (an internal action or a plain TypeScript function both mutations call), or consolidate: make `evaluate` a thin wrapper that calls `evaluateInternal` via `ctx.runMutation`.

### IN-06: `settings.tsx` — `RetentionControl` Initializes `days` State Before Server Value Loads

**File:** `src/pages/Settings.tsx:54`
**Issue:** `const [days, setDays] = useState<number>(currentDays ?? 30)` initializes to 30 if `currentDays` is `undefined` (loading). The `useEffect` on line 58 re-syncs once the query resolves. The input will flash "30" while loading even if the server value is different — e.g., 14 days. This is a minor UX inconsistency but not a bug.
**Fix:** Show a loading state or disable the input until `currentDays` is not `undefined`:
```tsx
const [days, setDays] = useState<number | null>(null);
// ...
useEffect(() => {
  if (currentDays != null && days === null) setDays(currentDays);
}, [currentDays]);
// In render: if days === null, show a skeleton or disable the input
```

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
