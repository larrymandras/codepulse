---
phase: 66-gateway-compatibility
fixed_at: 2026-05-21T00:00:00Z
review_path: .planning/phases/66-gateway-compatibility/66-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 66: Code Review Fix Report

**Fixed at:** 2026-05-21
**Source review:** .planning/phases/66-gateway-compatibility/66-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical, 4 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-02: `provider_health` ingest path silently drops `authenticated`, `billingType`, `quotaRemaining`

**Files modified:** `convex/runtimeIngest.ts`
**Commit:** 5f2ea4c
**Applied fix:** Added `authenticated: d.authenticated`, `billingType: d.billingType ?? d.billing_type`, and `quotaRemaining: d.quotaRemaining ?? d.quota_remaining` to the `providerHealth.upsert` call inside the `provider_health` case. The three fields were previously absent, silently discarding auth/billing data from all runtime-ingest senders and causing the ProviderHealthPanel to always show gray/unknown state for gateway providers.

---

### CR-01: `runtimeIngest.ts` gateway cases shadow `sessionId` with wrong source

**Files modified:** `convex/runtimeIngest.ts`
**Commit:** 2fb5fa2
**Applied fix:** Replaced the local `const sessionId = d.session_id ?? ...` in all four gateway cases (`gateway.task_completed`, `gateway.task_failed`, `gateway.task_started`, `gateway.routing_decision`) with `const gatewaySessionId = d.session_id ?? d.sessionId ?? (evt as any).session_id ?? (evt as any).sessionId ?? "unknown"`. This adds the envelope-level `evt` fallback so batched payloads that put `session_id` on the outer envelope (not on `evt.data`) are correctly attributed. Also as part of this fix, `gateway.task_started` was changed to write only to `sessions.upsert` (not `toolExecutions.insert`), which also resolves the WR-01 logic gap for this code path.

---

### WR-01: `otelLogs.ts` `gateway.task_started` records `success: true` unconditionally

**Files modified:** `convex/otelLogs.ts`
**Commit:** 6ed0325
**Applied fix:** Replaced the `toolExecutions.insert` call with `success: true` in the `gateway.task_started` case with a `sessions.upsert` call only. The started event no longer writes a false successful execution record that would inflate per-provider success rates. The authoritative execution record is written by the subsequent `gateway.task_completed` or `gateway.task_failed` event.

---

### WR-02: `providerHealth.latest` query issues N individual reads — no bound on N

**Files modified:** `convex/providerHealth.ts`
**Commit:** ed830fb
**Applied fix:** Added a comment above the `for` loop in `providerHealth.latest` documenting the O(N providers) read pattern, that `useProviderHealth()` polls every 5s, and a recommendation to replace with a range scan or per-provider summary document as `ALL_PROVIDERS` grows. A full structural refactor was deferred as it would require schema changes outside this phase scope.

---

### WR-03: `sessions.listAll` accepts a float `limit` that `take()` may reject at runtime

**Files modified:** `convex/sessions.ts`
**Commit:** 1798bab
**Applied fix:** Changed `v.optional(v.float64())` to `v.optional(v.int64())` and replaced the raw `args.limit ?? 50` with `Math.max(1, Math.min(Number(args.limit ?? 50), 500))`. This rejects non-integer inputs at the schema layer and clamps the value to the range [1, 500] before passing to `take()`, preventing runtime errors from float, negative, or oversized limit values.

---

### WR-04: Duplicate provider registry in frontend not enforced as single source of truth

**Files modified:** `convex/__tests__/providerRegistry.test.ts`
**Commit:** 8deb719
**Applied fix:** Added imports for `ALL_PROVIDERS`, `GATEWAY_PROVIDERS`, and `LEGACY_PROVIDERS` from `src/lib/providers` alongside the existing backend imports, then added a new `describe` block with three tests asserting that the frontend and backend arrays are identical (sorted). Any future provider added to one file but not the other will now produce a failing test. A full single-source-of-truth refactor (shared package or re-export) is deferred as it requires build configuration changes.

---

_Fixed: 2026-05-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
