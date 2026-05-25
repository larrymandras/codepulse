---
phase: 59-schema-foundation
plan: "02"
subsystem: convex-mutations
tags: [convex, mutations, queries, ingest, call-graph, delivery-logs, archival, backfill]
dependency_graph:
  requires: [59-01]
  provides: [callGraphEdges-mutations, deliveryLogs-mutations, alertRuleCustom-extended, llm-extended, archival-extended, runtimeIngest-wired]
  affects: [60-context-window-viz, 62-email-delivery, 63-call-graph-viz, 64-pagerduty, 65-github-actions]
tech_stack:
  added: []
  patterns: [upsert-via-index, internalMutation-batch-backfill, switch-case-ingest-dispatch]
key_files:
  created:
    - convex/callGraphEdges.ts
    - convex/deliveryLogs.ts
  modified:
    - convex/alertRuleCustom.ts
    - convex/llm.ts
    - convex/archival.ts
    - convex/runtimeIngest.ts
    - convex/_generated/api.d.ts
decisions:
  - "Updated convex/_generated/api.d.ts manually to register callGraphEdges and deliveryLogs — Convex dev server not running in worktree, anyApi in api.js handles runtime, types needed for TypeScript"
  - "backfillAgentId only derives agentId (not toolName) via sessionId -> agents join — toolName has no reliable historical join path in existing schema"
  - "hive_mind_entry callGraphEdges dispatch guarded by toolName presence — some entries are non-tool actions and should not create graph edges"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-17"
  tasks_completed: 2
  files_created: 2
  files_modified: 5
---

# Phase 59 Plan 02: Mutations + Ingest Wiring Summary

**One-liner:** callGraphEdges upsert mutations, delivery log inserts, pagerduty/github config validators, agentId backfill internalMutation, archival extension, and hive_mind_entry ingest dispatch wired in ~3 minutes with zero type errors.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | New mutation files | 36782c9 | convex/callGraphEdges.ts, convex/deliveryLogs.ts |
| 2 | Extend existing mutations + ingest + archival | f716131 | convex/alertRuleCustom.ts, convex/llm.ts, convex/archival.ts, convex/runtimeIngest.ts, convex/_generated/api.d.ts |

## What Was Built

**convex/callGraphEdges.ts (NEW)**
- `upsertEdge`: query-then-patch-or-insert pattern using `by_agent_tool` index; increments callCount, errorCount, lastErrorAt, and status on each call
- `listEdges`: returns up to 500 non-archived edges ordered by timestamp desc
- `getBySession`: returns all non-archived edges for a sessionId via `by_session` index

**convex/deliveryLogs.ts (NEW)**
- `insertEmailLog`, `insertPagerdutyLog`, `insertGithubLog`: insert mutations for the three Phase 59 delivery log tables (no auth guard — called internally from Phase 62/64/65 actions)
- `listEmailLogs`, `listPagerdutyLogs`, `listGithubLogs`: read queries with optional ruleId filter; return up to 100 non-archived rows

**convex/alertRuleCustom.ts (EXTENDED)**
- Added `pagerdutyConfigValidator` and `githubTriggerValidator` module-scope constants
- Both `create` and `update` mutations now accept `pagerdutyConfig` and `githubTrigger` optional args
- `create` handler explicitly inserts both fields; `update` handler uses spread (`...rest`) which forwards them automatically

**convex/llm.ts (EXTENDED)**
- `recordCall` now accepts optional `agentId` and `toolName`, persisted to `llmMetrics`
- Added `backfillAgentId` internalMutation: processes rows in batches of 100 where `agentId` is undefined, attempts sessionId -> agents table join to derive agentId; returns `{ processed, patched }` so caller loops until processed === 0

**convex/archival.ts (EXTENDED)**
- `markStaleArchived` tables array now includes `emailDeliveryLog`, `pagerdutyDeliveryLog`, `githubTriggerLog`
- All three tables have `archived: v.optional(v.boolean())` and `by_timestamp` indexes from Plan 01 schema; existing loop logic applies without modification

**convex/runtimeIngest.ts (EXTENDED)**
- `llm_call` case: passes `agentId: d.agentId ?? d.agent_id` and `toolName: d.toolName ?? d.tool_name` to `api.llm.recordCall`
- `hive_mind_entry` case: after existing `api.hiveMind.recordEntry` call, dispatches to `api.callGraphEdges.upsertEdge` when toolName is present (maps `agent_type`/`agentType` to agentId, `session_key`/`sessionKey` to sessionId)
- New `tool_execution` case: standalone handler for future dedicated tool execution events, dispatches to `api.callGraphEdges.upsertEdge`

## Verification Results

- `npx tsc --noEmit`: 0 errors
- `npx vitest run convex/`: 148 passed, 39 todo (all existing + new tests pass)
- `grep -c "upsertEdge" convex/callGraphEdges.ts`: 1
- `grep -c "insertEmailLog" convex/deliveryLogs.ts`: 1
- `grep -c "pagerdutyConfigValidator" convex/alertRuleCustom.ts`: 3 (definition + 2 usages)
- `grep -c "backfillAgentId" convex/llm.ts`: 1
- `grep -c "emailDeliveryLog" convex/archival.ts`: 1
- `grep -c "api.callGraphEdges.upsertEdge" convex/runtimeIngest.ts`: 2 (hive_mind_entry + tool_execution)
- `grep -c "tool_execution" convex/runtimeIngest.ts`: 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated convex/_generated/api.d.ts to register new modules**
- **Found during:** Task 2
- **Issue:** `runtimeIngest.ts` references `api.callGraphEdges.upsertEdge` but the generated type file didn't include the new `callGraphEdges` module, causing 2 TypeScript errors
- **Fix:** Added `import type * as callGraphEdges from "../callGraphEdges.js"` and `import type * as deliveryLogs from "../deliveryLogs.js"` entries to both the imports section and the `fullApi` object in `api.d.ts`. The runtime `api.js` uses `anyApi` so no runtime change was needed.
- **Files modified:** convex/_generated/api.d.ts
- **Commit:** f716131

## Known Stubs

None — all mutations wire directly to schema tables with no placeholder values.

## Threat Flags

No new threat surface beyond what was planned in the threat model. All new mutations are either:
1. Ingest-facing (no auth, protected by CPHLTH-02 bearer token at httpAction boundary)
2. Clerk-gated (alertRuleCustom create/update, existing CPHLTH-01 gate)

T-59-08 mitigation confirmed: `pagerdutyConfig.routingKey` stores only the non-secret service routing key identifier, not the PagerDuty Integration Key / API token.

## Self-Check: PASSED

- convex/callGraphEdges.ts: FOUND
- convex/deliveryLogs.ts: FOUND
- .planning/phases/59-schema-foundation/59-02-SUMMARY.md: FOUND
- commit 36782c9: FOUND
- commit f716131: FOUND
