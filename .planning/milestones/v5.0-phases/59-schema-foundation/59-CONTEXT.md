# Phase 59: Schema Foundation - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

All new Convex tables and field extensions required by v5.0 are in place so that visualization and integration phases (60-65) have a stable backend to build against. This phase is schema-only: define tables, add fields, create indexes, write insert/upsert mutations, and backfill existing data. No UI, no delivery logic, no visualization rendering.

</domain>

<decisions>
## Implementation Decisions

### callGraphEdges schema
- **D-01:** Edges represent agent-to-tool calls only. Source is always an agent (agentId), target is always a tool (toolName).
- **D-02:** Rich metadata per edge: callCount, lastCallAt, lastErrorAt, errorCount, status (healthy/errored). Self-contained for Phase 63 rendering without secondary lookups.
- **D-03:** Edges include sessionId to allow filtering the call graph to a specific session.
- **D-04:** Edges are upserted via the ingest pipeline (runtimeIngest.ts) — when a tool execution event arrives, upsert the corresponding edge (create if new, increment counts if exists). Real-time, not batch.

### alertRuleCustom extensions
- **D-05:** githubTrigger is an optional per-rule config object: `{ enabled: boolean, repo: string, workflowFile: string, ref: string }`. Each rule can target a different workflow.
- **D-06:** pagerdutyEnabled becomes pagerdutyConfig — an optional per-rule config object: `{ enabled: boolean, routingKey: string, severity?: string }`. Each rule can route to different PagerDuty services.
- **D-07:** Secrets (GitHub PAT, PagerDuty routing keys) live in Convex environment variables, not per-rule fields. Per-rule config objects store non-secret identifiers; secrets are resolved at dispatch time in Phases 64/65.

### Delivery log schemas
- **D-08:** Three separate tables (emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog) — not a unified table. Mirrors the existing webhookDeliveryLog pattern.
- **D-09:** Each delivery log links to both the alert instance (alertId) and the rule (ruleId). Supports both "all deliveries for this alert" and "all deliveries for this rule" queries.
- **D-10:** All three delivery log tables include an optional `archived` boolean field for retention consistency with existing tables. Channel-specific fields added per table (e.g., pagerdutyDeliveryLog gets dedupKey, githubTriggerLog gets runUrl/dispatchId).

### Existing data handling
- **D-11:** llmMetrics gets optional agentId and toolName fields plus a by_agent index. Fields are optional (v.optional) so existing rows remain valid.
- **D-12:** One-time backfill mutation included in Phase 59 scope. Cross-references events/toolExecutions tables to populate agentId/toolName on historical llmMetrics rows. Data is ready when Phase 61 (Token Sunburst) starts.

### Claude's Discretion
- Exact backfill mutation implementation (batch size, error handling)
- Index design for delivery log tables (by_alert, by_ruleId, by_timestamp patterns)
- emailDeliveryLog specific fields (recipient, subject, templateId, etc.)
- pagerdutyDeliveryLog specific fields (dedupKey, incidentKey, action type)
- githubTriggerLog specific fields (runUrl, dispatchId, rateLimited flag)

</decisions>

<specifics>
## Specific Ideas

- webhookDeliveryLog (Phase 6) is the reference pattern for all three new delivery log tables — same structure with channel-specific additions
- githubWorkflowRuns already exists for recording workflow runs from external sources; githubTriggerLog is distinct — it tracks alert-triggered dispatches from CodePulse
- alertRuleCustom CRUD mutations already have Clerk auth checks — extend the same create/update mutations for new fields

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema and requirements
- `.planning/REQUIREMENTS.md` — SCH-01 through SCH-04 define the four schema requirements
- `.planning/ROADMAP.md` §Phase 59-65 — Success criteria and dependency chain

### Existing patterns to follow
- `convex/schema.ts` — Current schema (60+ tables). New tables and field extensions go here
- `convex/alertRuleCustom.ts` — Existing CRUD mutations for custom alert rules (extend for D-05/D-06)
- `convex/llm.ts` — recordCall mutation and query patterns (extend for D-11/D-12)
- `convex/githubActions.ts` — Existing GitHub workflow run recording pattern
- `convex/runtimeIngest.ts` — Ingest pipeline that dispatches to tables by event type (add callGraphEdges upsert here per D-04)

### Delivery log reference
- `convex/schema.ts` §webhookDeliveryLog (line ~893) — Pattern for new delivery log tables

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webhookDeliveryLog` table schema: alertId, channel, attempt, status, statusCode, errorMessage, sentAt — template for new delivery logs
- `alertRuleCustom` CRUD mutations with Clerk auth pattern: create, update, delete, list, getById
- `llm.ts` recordCall mutation: direct insert pattern, extend with optional fields

### Established Patterns
- All tables use `v.float64()` for timestamps (epoch seconds)
- Optional fields use `v.optional()` wrapper
- Indexes follow `by_{fieldName}` naming convention
- Archival uses optional `archived: v.boolean()` field filtered in queries

### Integration Points
- `convex/runtimeIngest.ts` — Main ingest dispatcher; add callGraphEdges upsert handler for tool execution events
- `convex/alertRuleCustom.ts` — Extend create/update mutations to accept pagerdutyConfig and githubTrigger
- `convex/llm.ts` — Extend recordCall mutation args to include optional agentId/toolName
- `convex/archival.ts` — Extend retention logic to cover new delivery log tables

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 59-schema-foundation*
*Context gathered: 2026-05-17*
