---
phase: 59-schema-foundation
verified: 2026-05-18T09:00:00Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm that pagerdutyConfig (nested object) satisfies SCH-03 intent, which REQUIREMENTS.md calls pagerdutyEnabled"
    expected: "The object field pagerdutyConfig with enabled boolean inside is accepted as equivalent to the flat pagerdutyEnabled field named in REQUIREMENTS.md — or REQUIREMENTS.md is updated to reflect the actual schema"
    why_human: "REQUIREMENTS.md SCH-03 says 'pagerdutyEnabled' (flat boolean field). The schema implements pagerdutyConfig (nested object with enabled, routingKey, severity). These are different shapes. The richer object is the better design and matches Phase 64 needs, but the requirement text does not match the implementation. A human must decide whether to update REQUIREMENTS.md or treat this as a requirement deviation."
---

# Phase 59: Schema Foundation Verification Report

**Phase Goal:** All new Convex tables and field extensions required by v5.0 are in place so that visualization and integration phases have a stable backend to build against
**Verified:** 2026-05-18
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | callGraphEdges table exists with agentId, toolName, sessionId, callCount, errorCount, status fields and by_agent_tool, by_session, by_timestamp indexes; upsertEdge mutation dispatched from runtimeIngest hive_mind_entry | ✓ VERIFIED | schema.ts lines 921-935: table defined with all required fields. callGraphEdges.ts exports upsertEdge, listEdges, getBySession. runtimeIngest.ts line 606: api.callGraphEdges.upsertEdge called in hive_mind_entry case (guarded by toolName presence) and line 715: tool_execution case also dispatches. |
| 2 | llmMetrics table has optional agentId and toolName fields plus a by_agent compound index; recordCall persists them; backfillAgentId internalMutation exists | ✓ VERIFIED | schema.ts lines 280-287: agentId, toolName optional fields and by_agent index confirmed. llm.ts lines 16-17, 30-31: recordCall args and insert include both fields. llm.ts line 195: backfillAgentId internalMutation with .take(100) batch at line 203. |
| 3 | alertRuleCustom table has optional pagerdutyConfig and githubTrigger nested object fields; create and update mutations accept them | ? UNCERTAIN | Schema and implementation use pagerdutyConfig (nested object: enabled, routingKey, severity?). REQUIREMENTS.md SCH-03 specifies "pagerdutyEnabled and githubTrigger fields." The githubTrigger field matches. pagerdutyConfig diverges from pagerdutyEnabled by name and shape. The implementation is functionally superior (object vs. flat boolean) and aligns with Phase 64 needs, but is a named deviation from the written requirement. Human decision required. |
| 4 | Three delivery log tables exist (emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog) with alertId, ruleId, status, sentAt base fields plus channel-specific fields and archived boolean; insert mutations exist; archival covers all three | ✓ VERIFIED | schema.ts lines 936-985: all three tables defined with correct fields and indexes. deliveryLogs.ts: insertEmailLog, insertPagerdutyLog, insertGithubLog mutations confirmed with db.insert calls at lines 20, 46, 75. archival.ts line 17: tables array includes all three delivery log table names. |

**Score:** 3/4 truths verified (1 uncertain pending human decision on SCH-03 naming)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | 4 new table definitions + 2 existing table extensions | ✓ VERIFIED | callGraphEdges (line 921), emailDeliveryLog (line 936), pagerdutyDeliveryLog (line 951), githubTriggerLog (line 967). llmMetrics extended (lines 280-287). alertRuleCustom extended (lines 883-895). |
| `convex/callGraphEdges.ts` | upsertEdge mutation + listEdges/getBySession queries | ✓ VERIFIED | All three exports present. upsertEdge uses by_agent_tool index lookup with patch-or-insert pattern. |
| `convex/deliveryLogs.ts` | insert mutations for all 3 delivery log tables | ✓ VERIFIED | insertEmailLog, insertPagerdutyLog, insertGithubLog all export and call ctx.db.insert on the correct tables. Three list queries also present. |
| `convex/alertRuleCustom.ts` | extended create/update with pagerdutyConfig + githubTrigger | ✓ VERIFIED | pagerdutyConfigValidator and githubTriggerValidator defined at module scope. Both create (args line 42-43, insert lines 58-59) and update (args lines 77-78) accept the new optional fields. |
| `convex/llm.ts` | extended recordCall + backfillAgentId internalMutation | ✓ VERIFIED | agentId and toolName in recordCall args (lines 16-17) and insert (lines 30-31). backfillAgentId internalMutation at line 195, batch size 100 at line 203. |
| `convex/archival.ts` | extended table list covering delivery log tables | ✓ VERIFIED | Line 17: tables array includes emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog. |
| `convex/runtimeIngest.ts` | hive_mind_entry dispatches to callGraphEdges.upsertEdge + tool_execution case | ✓ VERIFIED | hive_mind_entry case line 606: api.callGraphEdges.upsertEdge called when toolName present. tool_execution case line 713-722: standalone handler dispatches to same mutation. llm_call case lines 65-66: agentId and toolName forwarded to recordCall. |
| `convex/callGraphEdges.test.ts` | SCH-01 upsert logic tests | ✓ VERIFIED | describe("callGraphEdges") present. 6 passing tests covering upsert arithmetic, 2 todos for DB round-trips. |
| `convex/deliveryLogs.test.ts` | SCH-04 delivery log insert shape tests | ✓ VERIFIED | describe("deliveryLogs") present. 5 passing tests covering required fields and optional fields for all 3 tables, 3 todos. |
| `convex/llm.test.ts` | SCH-02 optional field + backfill batch tests | ✓ VERIFIED | describe("llm") present. 5 passing tests covering agentId/toolName optionality and backfill batch logic, 5 todos. |
| `convex/alertRuleCustom.test.ts` | SCH-03 validator shape tests | ✓ VERIFIED | describe("alertRuleCustom") present. 5 passing tests covering pagerdutyConfig shape, githubTrigger required fields, optional disposition, 3 todos. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| convex/runtimeIngest.ts | convex/callGraphEdges.ts | ctx.runMutation(api.callGraphEdges.upsertEdge) in hive_mind_entry case | ✓ WIRED | Line 606: dispatch confirmed. Guarded by toolName presence (correct — not all hive_mind_entry events are tool calls). |
| convex/runtimeIngest.ts | convex/callGraphEdges.ts | ctx.runMutation(api.callGraphEdges.upsertEdge) in tool_execution case | ✓ WIRED | Line 715: standalone case confirmed. |
| convex/callGraphEdges.ts | convex/schema.ts | ctx.db.insert/query/patch on callGraphEdges table | ✓ WIRED | query at line 18, insert at line 33, patch implied by upsert path. |
| convex/llm.ts | convex/schema.ts | recordCall inserts agentId/toolName into llmMetrics | ✓ WIRED | args lines 16-17, insert lines 30-31. |
| convex/archival.ts | convex/schema.ts | markStaleArchived iterates delivery log tables | ✓ WIRED | Line 17 tables array confirmed. Note: WR-01 from code review — by_timestamp index on delivery log tables maps to sentAt field, not a field named timestamp. Archival will function correctly at runtime but is misleading. |
| convex/runtimeIngest.ts | convex/llm.ts | llm_call case passes agentId/toolName to api.llm.recordCall | ✓ WIRED | Lines 65-66 confirmed. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| convex/callGraphEdges.ts | callCount, errorCount, status | ctx.db.patch/insert on callGraphEdges table | Yes — increments from DB read then writes back | ✓ FLOWING |
| convex/deliveryLogs.ts | alertId, ruleId, sentAt etc. | ctx.db.insert on delivery log tables — args passed from caller | Yes — direct insert, no static stubs | ✓ FLOWING |
| convex/llm.ts (recordCall) | agentId, toolName | args from caller (runtimeIngest llm_call case) | Yes — passed through from ingest event | ✓ FLOWING |
| convex/llm.ts (backfillAgentId) | agentId (derived) | ctx.db.query("agents").withIndex("by_session") | Yes — DB join, with caveat: CR-02 infinite-loop risk when rows exist but no agent match found | ⚠ FLOWING with defect |

### Behavioral Spot-Checks

Tests run with vitest — no server required for these pure-logic tests.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 4 test files pass | npx vitest run convex/callGraphEdges.test.ts convex/deliveryLogs.test.ts convex/llm.test.ts convex/alertRuleCustom.test.ts | 4 files, 21 passed, 11 todo | ✓ PASS |
| callGraphEdges table in schema | grep callGraphEdges convex/schema.ts | line 921: callGraphEdges: defineTable({ | ✓ PASS |
| delivery log tables in schema | grep emailDeliveryLog convex/schema.ts | line 936 confirmed | ✓ PASS |
| runtimeIngest dispatches upsertEdge | grep -c api.callGraphEdges.upsertEdge runtimeIngest.ts | 2 occurrences (hive_mind_entry + tool_execution) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCH-01 | 59-01-PLAN, 59-02-PLAN | New callGraphEdges table upserted from ingest events | ✓ SATISFIED | Table defined in schema.ts, upsertEdge mutation in callGraphEdges.ts, runtimeIngest.ts dispatches on hive_mind_entry. |
| SCH-02 | 59-01-PLAN, 59-02-PLAN | llmMetrics extended with agentId, toolName, by_agent index | ✓ SATISFIED | schema.ts lines 280-287, llm.ts recordCall extended, backfillAgentId internalMutation present. |
| SCH-03 | 59-01-PLAN, 59-02-PLAN | alertRuleCustom extended with pagerdutyEnabled and githubTrigger | ? NEEDS HUMAN | REQUIREMENTS.md names the field pagerdutyEnabled (flat boolean). Implementation uses pagerdutyConfig (nested object: {enabled, routingKey, severity?}). githubTrigger matches. The object shape is functionally richer and correct for Phase 64, but the field name and shape diverge from the written requirement. |
| SCH-04 | 59-01-PLAN, 59-02-PLAN | Three delivery log tables with insert mutations | ✓ SATISFIED | All three tables in schema.ts, insert mutations in deliveryLogs.ts, archival extended. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| convex/callGraphEdges.ts | 19-22 | upsertEdge uses only (agentId, toolName) index — sessionId ignored in lookup, stale after any cross-session call | ⚠ Warning | sessionId on edge record becomes meaningless after first cross-session upsert. Does not prevent schema foundation goal but is a correctness defect flagged in code review CR-01. |
| convex/llm.ts | 228 | backfillAgentId returns processed: rows.length as completion signal — infinite loop if rows exist that can never resolve to an agentId | ⚠ Warning | Documented in code review CR-02. Does not affect schema foundation goal but will cause operational problems when backfill is run. |
| convex/runtimeIngest.ts | 713-722 | tool_execution case dispatches to callGraphEdges only, never inserts to toolExecutions table | ⚠ Warning | Callers sending tool_execution events expecting per-execution audit trail in toolExecutions table will get no record. Flagged in code review WR-04. |
| convex/alertRuleCustom.ts | 85-89 | update uses spread of all args including undefined — ctx.db.patch with undefined value removes the field | ⚠ Warning | Flagged in code review WR-02. A caller passing pagerdutyConfig: undefined to update will silently clear the field. |

### Human Verification Required

#### 1. SCH-03 Requirement Name Mismatch: pagerdutyEnabled vs pagerdutyConfig

**Test:** Review REQUIREMENTS.md SCH-03 against the actual schema.ts implementation.

**REQUIREMENTS.md says:** `alertRuleCustom table extended with pagerdutyEnabled and githubTrigger fields`

**Implementation delivers:** `pagerdutyConfig: v.optional(v.object({ enabled: v.boolean(), routingKey: v.string(), severity: v.optional(v.string()) }))` — a nested object, not a flat boolean named `pagerdutyEnabled`.

**Expected:** One of two resolutions:
- Update REQUIREMENTS.md SCH-03 to say `pagerdutyConfig` (object) instead of `pagerdutyEnabled` (boolean), acknowledging the implementation is intentionally richer
- OR declare this a deviation and create a follow-up to add the flat `pagerdutyEnabled` field as an alias

**Why human:** The implementation is clearly deliberate and better-designed for Phase 64 (PagerDuty) — it stores routingKey alongside the enabled toggle, which Phase 64 needs. But the requirement text is a written contract. Only Larry can decide whether to update the requirement text or flag this as a gap. The ROADMAP success criterion also says `pagerdutyEnabled` (Phase 59 SC-3), which reinforces this needs resolution.

---

## Gaps Summary

No hard blockers on the phase goal. All four tables exist, all mutations are implemented and wired, tests pass. The single human-needed item is a requirement naming discrepancy on SCH-03 — the implementation chose a nested object (`pagerdutyConfig`) over the flat boolean (`pagerdutyEnabled`) named in REQUIREMENTS.md and the ROADMAP success criterion. This is almost certainly the right call for Phase 64, but requires human sign-off to close the traceability gap.

The code review findings (CR-01: cross-session upsert collision, CR-02: backfill infinite-loop risk, WR-02 through WR-05) are correctness defects that do not block the schema foundation goal but should be addressed before Phase 64 (PagerDuty) and any production backfill run.

---

_Verified: 2026-05-18_
_Verifier: Claude (gsd-verifier)_
