---
phase: 66-gateway-compatibility
plan: "01"
subsystem: schema-foundation
tags: [schema, registry, migrations, convex, gateway-compatibility]
dependency_graph:
  requires: []
  provides:
    - convex/lib/providers.ts (central provider registry)
    - src/lib/providers.ts (frontend mirror)
    - sessions.provider field + by_provider index
    - toolExecutions.provider field + by_provider index
    - providerHealth authenticated/billingType/quotaRemaining fields
    - Wave 0 test stubs for Plans 02+
  affects:
    - convex/schema.ts
    - convex/providerHealth.ts
    - convex/toolExecutions.ts
    - convex/sessions.ts
tech_stack:
  added: []
  patterns:
    - Central registry pattern (single source of truth for provider names)
    - Frontend mirror pattern (Convex backend modules cannot be imported in React)
key_files:
  created:
    - convex/lib/providers.ts
    - src/lib/providers.ts
    - convex/__tests__/providerRegistry.test.ts
    - convex/__tests__/otelLogs.test.ts
  modified:
    - convex/schema.ts
    - convex/toolExecutions.ts
    - convex/sessions.ts
    - convex/providerHealth.ts
decisions:
  - Provider registry lives in convex/lib/providers.ts as single source of truth; frontend gets a mirrored copy in src/lib/providers.ts because Convex backend modules cannot be imported in React components
  - recordStateChange mutation also updated with new optional fields to keep it schema-consistent with upsert
metrics:
  duration: "140s"
  completed_date: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 4
---

# Phase 66 Plan 01: Schema Foundation + Provider Registry Summary

Schema migration + central provider registry with 7 providers + Wave 0 test stubs that unblock all subsequent Phase 66 plans.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema migration + provider registry + mutation upgrades | a33adb9 | convex/schema.ts, convex/lib/providers.ts, src/lib/providers.ts, convex/toolExecutions.ts, convex/sessions.ts, convex/providerHealth.ts |
| 2 | Wave 0 test stubs | e425a54 | convex/__tests__/providerRegistry.test.ts, convex/__tests__/otelLogs.test.ts |

## What Was Built

**Provider Registry (convex/lib/providers.ts):** Central source of truth defining 3 legacy providers (anthropic_direct, openrouter, ollama) and 4 gateway providers (claude-cli, codex, antigravity, claude-sdk). Exports GATEWAY_PROVIDERS, LEGACY_PROVIDERS, ALL_PROVIDERS typed const arrays plus GatewayProvider, LegacyProvider, AnyProvider union types.

**Frontend Mirror (src/lib/providers.ts):** Identical registry for React components, extended with PROVIDER_DISPLAY_NAMES mapping for UI rendering. Cannot share the Convex module due to Convex runtime isolation.

**Schema Migration (convex/schema.ts):**
- sessions table: added `provider: v.optional(v.string())` + `.index("by_provider", ["provider"])`
- toolExecutions table: added `provider: v.optional(v.string())` + `.index("by_provider", ["provider"])`
- providerHealth table: added `authenticated: v.optional(v.boolean())`, `billingType: v.optional(v.string())`, `quotaRemaining: v.optional(v.float64())`

**Mutation Upgrades:**
- toolExecutions.insert: accepts optional `provider` arg, passed through to db.insert
- sessions.upsert: accepts optional `provider` arg, persisted on both insert and patch paths
- providerHealth.upsert + recordStateChange: accept optional authenticated, billingType, quotaRemaining args
- providerHealth.latest: replaced hardcoded 3-provider array with ALL_PROVIDERS registry

**Wave 0 Test Stubs:**
- providerRegistry.test.ts: 4 active passing tests validating ALL_PROVIDERS has 7 members, GATEWAY_PROVIDERS has 4, LEGACY_PROVIDERS has 3, and ALL_PROVIDERS is their union; plus 4 todo stubs for mutation/query tests in Plan 02
- otelLogs.test.ts: 12 todo stubs covering GW-01 OTel default fix, GW-02 gateway event routing, GW-04 backward compatibility, and otelMetrics default fix

## Verification Results

- `npx tsc --noEmit`: exits 0 (clean)
- `npx vitest run convex/__tests__/`: 101 passed, 31 todo, 0 failed (12 test files)
- 4 active providerRegistry tests pass
- 12 otelLogs todo stubs skip without error
- No regressions in existing 97 tests

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Updated recordStateChange with new optional fields**
- **Found during:** Task 1
- **Issue:** providerHealth.recordStateChange inserts directly into the table but its args didn't include the new authenticated/billingType/quotaRemaining fields, creating a schema mismatch if callers pass those fields
- **Fix:** Added the three optional fields to recordStateChange args to match the extended schema
- **Files modified:** convex/providerHealth.ts
- **Commit:** a33adb9

## Known Stubs

None — all implemented functionality is complete. Test stubs in providerRegistry.test.ts and otelLogs.test.ts are intentional Wave 0 scaffolds per plan design; they will be filled in by Plan 02.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary surface introduced. Provider registry is read-only module; schema additions are additive/optional fields only.

## Self-Check: PASSED

Files exist:
- convex/lib/providers.ts: FOUND
- src/lib/providers.ts: FOUND
- convex/__tests__/providerRegistry.test.ts: FOUND
- convex/__tests__/otelLogs.test.ts: FOUND

Commits exist:
- a33adb9 (Task 1): FOUND
- e425a54 (Task 2): FOUND
