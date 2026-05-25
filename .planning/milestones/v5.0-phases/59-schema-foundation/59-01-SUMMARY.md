---
phase: 59-schema-foundation
plan: "01"
subsystem: convex-schema
tags: [schema, convex, database, visualization, integrations]
dependency_graph:
  requires: []
  provides: [callGraphEdges-table, emailDeliveryLog-table, pagerdutyDeliveryLog-table, githubTriggerLog-table, llmMetrics-agentId-extension, alertRuleCustom-integration-extension]
  affects: [convex/callGraphEdges.ts, convex/deliveryLogs.ts, convex/llm.ts, convex/alerts.ts]
tech_stack:
  added: []
  patterns: [convex-defineTable, v.optional-backward-compat, pure-logic-vitest]
key_files:
  created:
    - convex/callGraphEdges.test.ts
    - convex/deliveryLogs.test.ts
    - convex/llm.test.ts
    - convex/alertRuleCustom.test.ts
  modified:
    - convex/schema.ts
decisions:
  - "All new fields on existing tables use v.optional() for backward compatibility"
  - "callGraphEdges uses lastCallAt as the timestamp field (by_timestamp index) rather than adding a separate timestamp field"
  - "pagerdutyConfig.routingKey stored as plain string per D-07 — actual secrets live in Convex env vars"
metrics:
  duration: "143 seconds"
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 59 Plan 01: Schema Foundation Summary

## One-Liner

Convex schema extended with 4 new tables (callGraphEdges, emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog) and 2 existing table extensions (llmMetrics agentId/toolName, alertRuleCustom pagerdutyConfig/githubTrigger), with 21 pure-logic tests covering all four Wave 0 requirements.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema definitions — new tables and field extensions | 1e82640 | convex/schema.ts |
| 2 | Wave 0 test stubs for all four requirements | 20cdd63 | convex/callGraphEdges.test.ts, convex/deliveryLogs.test.ts, convex/llm.test.ts, convex/alertRuleCustom.test.ts |

## What Was Built

### Schema Changes (convex/schema.ts)

**New tables added:**
- `callGraphEdges` — Tracks per-agent, per-tool call graph edges with callCount, errorCount, status, lastCallAt. Indexes: by_agent_tool, by_session, by_timestamp. Consumed by Plan 02 upsertEdge mutations.
- `emailDeliveryLog` — Email delivery audit trail with alertId, ruleId, recipient, subject, status. Indexes: by_alert, by_rule, by_timestamp.
- `pagerdutyDeliveryLog` — PagerDuty delivery audit with dedupKey, incidentKey, action fields. Indexes: by_alert, by_rule, by_timestamp.
- `githubTriggerLog` — GitHub Actions dispatch audit with dispatchId, runUrl, rateLimited, repo, workflowFile. Indexes: by_alert, by_rule, by_timestamp.

**Existing table extensions:**
- `llmMetrics` — Added optional `agentId` and `toolName` fields plus `by_agent` compound index (SCH-02).
- `alertRuleCustom` — Added optional `pagerdutyConfig` nested object (enabled, routingKey, severity?) and `githubTrigger` nested object (enabled, repo, workflowFile, ref) (SCH-03).

### Test Files (Wave 0 pure-logic)

- `callGraphEdges.test.ts` — 6 tests covering upsert arithmetic: callCount increment, status derivation, errorCount conditional increment, lastErrorAt preservation, initial state. 2 todos for DB round-trips.
- `deliveryLogs.test.ts` — 5 tests covering required field shapes for all 3 delivery log tables, optional field acceptance, rate_limited status logic. 3 todos for DB round-trips.
- `llm.test.ts` — 5 tests covering agentId/toolName optional field acceptance, backfill batch size constant, processed count signaling. 5 todos for DB round-trips.
- `alertRuleCustom.test.ts` — 5 tests covering pagerdutyConfig shape (required/optional fields), githubTrigger required fields, optional disposition in create args. 3 todos for DB round-trips.

**Test results:** 21 passing, 11 todos (DB round-trips deferred to Plan 02), 0 failures.

## Verification

- `npx tsc --noEmit` — exits 0 (no type errors)
- `npx vitest run convex/callGraphEdges.test.ts convex/deliveryLogs.test.ts convex/llm.test.ts convex/alertRuleCustom.test.ts` — 4 files, 21 tests passing, 11 todos

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan defines schema structure and pure-logic tests only. No UI components, no data rendering.

## Threat Flags

No new trust boundaries introduced. All new tables are server-side only (Convex mutations). The `pagerdutyConfig.routingKey` field stores a non-secret service identifier per T-59-02 disposition; actual API secrets remain in Convex environment variables.

## Self-Check: PASSED

- convex/schema.ts contains `callGraphEdges: defineTable({` — FOUND
- convex/schema.ts contains `emailDeliveryLog: defineTable({` — FOUND
- convex/schema.ts contains `pagerdutyDeliveryLog: defineTable({` — FOUND
- convex/schema.ts contains `githubTriggerLog: defineTable({` — FOUND
- convex/schema.ts contains `agentId: v.optional(v.string())` in llmMetrics block — FOUND
- convex/schema.ts contains `.index("by_agent", ["agentId", "timestamp"])` — FOUND
- convex/schema.ts contains `pagerdutyConfig: v.optional(v.object({` — FOUND
- convex/schema.ts contains `githubTrigger: v.optional(v.object({` — FOUND
- Commit 1e82640 (Task 1) — FOUND
- Commit 20cdd63 (Task 2) — FOUND
