---
phase: 66-gateway-compatibility
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - convex/lib/providers.ts
  - src/lib/providers.ts
  - convex/__tests__/providerRegistry.test.ts
  - convex/__tests__/otelLogs.test.ts
  - convex/schema.ts
  - convex/toolExecutions.ts
  - convex/sessions.ts
  - convex/providerHealth.ts
  - convex/otelLogs.ts
  - convex/otelMetrics.ts
  - convex/runtimeIngest.ts
  - src/components/ProviderHealthPanel.tsx
  - hooks/README.md
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 66: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 66 adds a central provider registry (7 providers), extends schema fields for `sessions`, `toolExecutions`, and `providerHealth`, fixes the OTel default-to-"unknown" bug, routes gateway events through both `otelLogs` and `runtimeIngest`, and upgrades the `ProviderHealthPanel` UI. The architecture is sound and the primary objectives are met.

Two blockers were found: a silent data loss path where the legacy `provider_health` ingest route drops the three new fields (`authenticated`, `billingType`, `quotaRemaining`) that the UI depends on; and a variable-shadowing bug in `runtimeIngest.ts` where the gateway cases re-declare `sessionId` using `data` instead of `evt.data`, producing "unknown" whenever a caller sends a bare event body. Four warnings cover logic gaps, type safety, and a test suite that tests its own inline logic rather than the real implementation.

---

## Critical Issues

### CR-01: `runtimeIngest.ts` gateway cases shadow `sessionId` with wrong source

**File:** `convex/runtimeIngest.ts:780`

The four gateway event cases (`gateway.task_completed`, `gateway.task_failed`, `gateway.task_started`, `gateway.routing_decision`, lines 778-832) each declare:

```ts
const sessionId = d.session_id ?? d.sessionId ?? "unknown";
```

where `d = data` and `data = evt.data ?? evt` (line 40). When a caller sends a single-event body like `{ "eventType": "gateway.task_completed", "provider": "codex", "session_id": "abc123" }`, `evt.data` is `undefined`, so `data` falls back to the whole `evt` object — meaning `d.session_id` works. But when the caller sends the batched format `{ "events": [{ "eventType": "...", "data": { "provider": "codex" }, "session_id": "abc123" }] }`, the `session_id` lives on `evt`, not on `evt.data`. In that case `d` is the inner `data` object, which has no `session_id`, so `sessionId` silently becomes `"unknown"`.

Every other batched event type in this file reads its identifiers from `data` (`d`), so senders that put `session_id` in the envelope will get wrong session attribution for all gateway events in batched payloads.

**Fix:** Carry the session context through from the envelope level, consistent with how `otelLogs.ts` extracts `sessionId` from resource attributes at a higher scope:

```ts
case "gateway.task_completed": {
  const d = data as any;
  const provider = d.provider ?? "unknown";
  // Prefer session_id from the data payload, then fall back to the
  // envelope-level evt (for batch callers that put it there).
  const gatewaySessionId =
    d.session_id ?? d.sessionId ?? (evt as any).session_id ?? (evt as any).sessionId ?? "unknown";
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId: gatewaySessionId,
    toolName: `gateway:${provider}`,
    provider,
    success: true,
    durationMs: d.duration_ms ?? d.durationMs,
    timestamp,
  });
  await ctx.runMutation(api.sessions.upsert, {
    sessionId: gatewaySessionId,
    provider,
  });
  break;
}
```

Apply the same fix to `gateway.task_failed`, `gateway.task_started`, and `gateway.routing_decision`.

---

### CR-02: `provider_health` ingest path silently drops `authenticated`, `billingType`, `quotaRemaining`

**File:** `convex/runtimeIngest.ts:669-681`

The `provider_health` case (the legacy runtime-ingest path) calls `api.providerHealth.upsert` but does not forward the three new Phase 66 fields:

```ts
case "provider_health": {
  const d = data as any;
  await ctx.runMutation(api.providerHealth.upsert, {
    providerName: d.providerName ?? d.provider_name ?? d.name ?? "unknown",
    state: d.state ?? "unknown",
    latencyEmaMs: d.latencyEmaMs ?? d.latency_ema_ms ?? 0,
    successRate: d.successRate ?? d.success_rate ?? 0,
    consecutiveFailures: d.consecutiveFailures ?? d.consecutive_failures ?? 0,
    lastSuccessAt: d.lastSuccessAt ?? d.last_success_at ?? 0,
    timestamp,
    // authenticated, billingType, quotaRemaining are MISSING
  });
  break;
}
```

The `providerHealth.upsert` mutation signature accepts these three fields as optional (lines 14-16 of `providerHealth.ts`), so no TypeScript error surfaces. However, any sender using `/runtime-ingest` with a `provider_health` event that includes these fields will have the data silently discarded. Worse, if a record was previously written via `/runtime-ingest` (without the fields) and later updated via `providerHealth.upsert` directly (with the fields), the next `/runtime-ingest` update will patch the record and leave those fields `undefined`, erasing previously stored auth/billing data.

The `ProviderHealthPanel` auth dot logic (lines 29-35 of `ProviderHealthPanel.tsx`) and quota bar (lines 45-51) both depend on these fields. Any gateway provider emitting health data through the runtime-ingest path will always appear as gray/unknown in the UI.

**Fix:**

```ts
case "provider_health": {
  const d = data as any;
  await ctx.runMutation(api.providerHealth.upsert, {
    providerName: d.providerName ?? d.provider_name ?? d.name ?? "unknown",
    state: d.state ?? "unknown",
    latencyEmaMs: d.latencyEmaMs ?? d.latency_ema_ms ?? 0,
    successRate: d.successRate ?? d.success_rate ?? 0,
    consecutiveFailures: d.consecutiveFailures ?? d.consecutive_failures ?? 0,
    lastSuccessAt: d.lastSuccessAt ?? d.last_success_at ?? 0,
    timestamp,
    authenticated: d.authenticated,
    billingType: d.billingType ?? d.billing_type,
    quotaRemaining: d.quotaRemaining ?? d.quota_remaining,
  });
  break;
}
```

---

## Warnings

### WR-01: `otelLogs.ts` `gateway.task_started` records `success: true` unconditionally

**File:** `convex/otelLogs.ts:267-276`

The `gateway.task_started` case inserts a `toolExecution` with `success: true` hardcoded. A task-started event is not a result — it has no success/failure semantics yet. Recording it as a successful execution will inflate `successRate` query results (`toolExecutions.successRate`) and skew the per-provider success-rate display, especially for long-running gateway tasks that may ultimately fail.

The same pattern exists in `runtimeIngest.ts` at lines 809-820.

**Fix:** Either omit the `success` field by making it optional (would require a schema change), or use a sentinel value that marks the record as an in-progress execution:

```ts
case "gateway.task_started": {
  const provider = getAttr(attrs, "provider") ?? "unknown";
  // Do not write a toolExecution for started events — write to sessions only.
  // The completed/failed events will write the authoritative execution record.
  await ctx.runMutation(api.sessions.upsert, {
    sessionId,
    provider,
  });
  break;
}
```

If the started event must be recorded, add a `decision` field such as `"in_progress"` so the `successRate` query can exclude incomplete records.

---

### WR-02: `providerHealth.latest` query issues N individual reads — no bound on N

**File:** `convex/providerHealth.ts:62-79`

```ts
for (const p of providers) {
  const record = await ctx.db
    .query("providerHealth")
    .withIndex("by_provider", (q) => q.eq("providerName", p))
    .order("desc")
    .first();
  ...
}
```

This issues 7 sequential Convex database queries in a loop. Convex queries run inside a transaction snapshot, so this is not a correctness issue today, but the `ALL_PROVIDERS` list is the authoritative source and will grow as new providers are added. There is no guard preventing this from expanding to, say, 20+ queries per `useProviderHealth()` poll (which runs every 5 seconds from the UI). As the provider list grows, this will silently degrade.

**Fix:** Use a single range scan on `by_timestamp` filtered by `providerName` membership, or maintain a single "latest-per-provider" summary document keyed by provider name. At minimum, add a comment noting this is O(N providers) reads.

---

### WR-03: `sessions.listAll` accepts a float `limit` that Convex `take()` may reject at runtime

**File:** `convex/sessions.ts:87-95`

```ts
args: { limit: v.optional(v.float64()) },
handler: async (ctx, args) => {
  const limit = args.limit ?? 50;
  return await ctx.db.query("sessions").order("desc").take(limit);
}
```

`take()` in the Convex SDK requires a positive integer. `v.float64()` admits `1.5`, `NaN`, `Infinity`, and negative values. Passing `limit: 1.5` from a caller produces a runtime error inside `take()` rather than a schema validation error. This was a pre-existing pattern, but Phase 66 adds `sessions.listAll` as the primary query used for the session-provider attribution feature and its callers may pass computed float values.

**Fix:**

```ts
args: { limit: v.optional(v.int64()) },
handler: async (ctx, args) => {
  const limit = Math.max(1, Math.min(Number(args.limit ?? 50), 500));
  ...
}
```

---

### WR-04: Duplicate provider registry in frontend not enforced as single source of truth

**File:** `src/lib/providers.ts:1`

The file comment says "keep in sync" manually. The `GATEWAY_PROVIDERS` and `LEGACY_PROVIDERS` arrays are fully duplicated between `convex/lib/providers.ts` and `src/lib/providers.ts` with no build-time check. A provider added to the Convex copy but not the frontend copy (or vice versa) will cause silent discrepancies: the backend `providerHealth.latest` query will return data for providers the UI never renders, or the UI will render cards for providers the backend doesn't query.

**Fix:** Establish a single canonical source. Since both Convex functions and the Vite frontend are TypeScript, a shared package or a re-export from a location accessible to both would eliminate the duplication. At minimum, add a test that imports both modules and asserts they are identical:

```ts
import { ALL_PROVIDERS as BACKEND } from "../../convex/lib/providers";
import { ALL_PROVIDERS as FRONTEND } from "../../src/lib/providers";

it("frontend and backend provider lists are identical", () => {
  expect([...FRONTEND].sort()).toEqual([...BACKEND].sort());
});
```

---

## Info

### IN-01: Test suite tests its own inline logic, not the real implementation

**File:** `convex/__tests__/otelLogs.test.ts:1-111`

Every test in this file replicates the `getAttr` helper inline and then tests that local copy. The actual `otelLogs.ts` implementation is never imported or exercised. If `otelLogs.ts` changes its `getAttr` logic or adds a new code path, these tests remain green while the production code drifts. The tests for `gateway.task_failed`, `gateway.routing_decision`, and backward-compat cases (lines 46-63) test only literal string assignments (`const success = false; expect(success).toBe(false)`) — they have no relationship to the actual mutation calls.

**Fix:** Import and call the actual HTTP action handler, or at minimum mark these as documentation tests with a comment explaining they are illustrative, not behavioral verification.

---

### IN-02: `providerHealth.upsert` patches `authenticated`, `billingType`, `quotaRemaining` to `undefined` when not supplied

**File:** `convex/providerHealth.ts:25-40`

```ts
await ctx.db.patch(existing._id, {
  ...
  authenticated: args.authenticated,
  billingType: args.billingType,
  quotaRemaining: args.quotaRemaining,
});
```

When a caller calls `upsert` without these optional fields, `args.authenticated` is `undefined`. Convex's `patch()` with an `undefined` value removes that field from the document (equivalent to `$unset`). This means a record that was previously written with `authenticated: true` will have that field removed on the next health ping that doesn't include auth state. The UI will then show the gray/unknown dot instead of the previously known state.

**Fix:** Only include the field in the patch object if it was explicitly provided:

```ts
await ctx.db.patch(existing._id, {
  state: args.state,
  latencyEmaMs: args.latencyEmaMs,
  successRate: args.successRate,
  consecutiveFailures: args.consecutiveFailures,
  lastSuccessAt: args.lastSuccessAt,
  timestamp: args.timestamp,
  ...(args.authenticated !== undefined ? { authenticated: args.authenticated } : {}),
  ...(args.billingType !== undefined ? { billingType: args.billingType } : {}),
  ...(args.quotaRemaining !== undefined ? { quotaRemaining: args.quotaRemaining } : {}),
});
```

---

### IN-03: `providerRegistry.test.ts` has 4 `.todo` tests covering core GW-01 and GW-03 behaviors

**File:** `convex/__tests__/providerRegistry.test.ts:35-43`

The mutation-level tests for `toolExecutions.insert` backward compatibility and `providerHealth.upsert` with the new fields are all `.todo`. These are the exact behaviors that Phase 66 introduced and that CR-02 / IN-02 identify as having subtle bugs. The test gaps mean those bugs shipped without a failing test to catch them.

**Fix:** Implement the pending tests using Convex's test utilities or integration test setup before the next release.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
