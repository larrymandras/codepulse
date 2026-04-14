---
phase: 05-data-pipeline
generated: 2026-04-14
asvs_level: 1
threats_total: 7
threats_closed: 7
threats_open: 0
block_on: open
status: SECURED
---

# Phase 05 — Data Pipeline: Security Audit

**Result: SECURED**
**Threats Closed:** 7/7
**Threats Open:** 0/7
**ASVS Level:** 1

---

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-05-01 | Tampering | mitigate | convex/archival.ts:35 — `Math.max(1, Math.min(365, Math.round(args.days)))` |
| T-05-02 | Tampering | mitigate | convex/archival.ts:35 — `Math.min(365, ...)` present in same expression as T-05-01 |
| T-05-03 | Denial of Service | mitigate | convex/archival.ts:22 — `.take(500)` per table per cron run inside `markStaleArchived` |
| T-05-04 | Information Disclosure | mitigate | archived filter `q.neq(q.field("archived"), true)` verified on all read queries across convex/llm.ts (7 functions), convex/analytics.ts (6 functions, sessionDurations correctly excluded per D-06), convex/events.ts (11 functions including paginated variants) |
| T-05-05 | Tampering | mitigate | src/pages/Settings.tsx:62 — `isValid = days >= 1 && days <= 365`; input min={1} max={365} at lines 87-88; button disabled on !isValid at line 98; server-side clamping at convex/archival.ts:35 (defense in depth) |
| T-05-06 | Denial of Service | accept | Convex .paginate() enforces server-side page boundaries; no user-controlled limit parameter exposed; verified in convex/events.ts:131-140, convex/llm.ts:44-53, convex/sessions.ts:95-104 |
| T-05-07 | Denial of Service | accept | Convex .paginate() enforces server-side page boundaries; verified in convex/agents.ts:79-87, convex/alerts.ts:65-73, convex/commandExecutions.ts:98-107, convex/security.ts:47-55 |

---

## Accepted Risks Log

| Threat ID | Category | Rationale |
|-----------|----------|-----------|
| T-05-06 | Denial of Service | Convex's built-in pagination mechanism prevents unbounded result sets at the platform level. The `.paginate()` call enforces server-side page boundaries regardless of client input. No user-controlled limit parameter is exposed on the paginated query. Accepted in Plan 03. |
| T-05-07 | Denial of Service | Same rationale as T-05-06, applied to agents, alerts, executions, and security events domains. Accepted in Plan 04. |

---

## Unregistered Threat Flags

None. All four SUMMARY.md files (05-01 through 05-04) reported no new threat surface beyond the registered threat model.

---

## Coverage Notes

**T-05-04 full scope verification:**

The archived filter (`q.neq(q.field("archived"), true)`) was verified present on every read function touching the four high-volume archival tables:

- `convex/llm.ts`: recentCalls, recentCallsPaginated, costByProvider, costByModel, providerBreakdown, costOverTime, latencyOverTime, rollupCosts (7 reads + 1 internal mutation = 8 filter instances). `recordCall` mutation correctly excluded (write only).
- `convex/analytics.ts`: activityHeatmap, toolFlowSankey, tokenSunburst, errorRateTrend (2 chains), tokenWaterfall (6 filter instances). `sessionDurations` correctly excluded — queries `sessions` table which is not an archival target per D-06.
- `convex/events.ts`: listRecent, listBySession, listByTool, listBashCommands (compound filter), listErrors, listPrompts, listRecentPaginated, listByType (runtime_events), listCritical (runtime_events), listRecentRuntimePaginated, countByType (11 filter instances). `ingest` and `insertEvent` mutations correctly excluded (writes only).
- `convex/aggregates.ts`: queries read only from the `aggregates` table which is not one of the four high-volume archival targets (events, runtime_events, llmMetrics, toolExecutions). No filter required.
