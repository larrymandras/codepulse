# Phase 59: Schema Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 59-schema-foundation
**Areas discussed:** callGraphEdges design, githubTrigger shape, Delivery log schemas, Existing data handling

---

## callGraphEdges design

### Edge type

| Option | Description | Selected |
|--------|-------------|----------|
| Agent-to-tool calls | Edges only represent an agent calling a tool. Source is always an agent, target is always a tool. Simple, directly maps to existing agentCoordination + toolExecutions data. | ✓ |
| Any node-to-node dependency | Edges between agents, tools, or integrations. Source/target can be any type. More flexible for future use but needs nodeType fields. | |
| You decide | Claude picks the approach that best supports Phase 63's call graph visualization | |

**User's choice:** Agent-to-tool calls

### Edge metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight — counts only | callCount, lastCallAt, lastErrorAt. Edges are materialized summaries. Phase 63 queries toolExecutions for details on demand. | |
| Rich — include state | callCount, lastCallAt, lastErrorAt, errorCount, status (healthy/errored). Self-contained for Phase 63 rendering — no secondary lookups needed. | ✓ |
| You decide | Claude picks based on what Phase 63 actually needs for node coloring and error path highlighting | |

**User's choice:** Rich — include state

### Upsert trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Ingest-driven | runtimeIngest.ts sees a tool execution event, upserts the edge (create if new, increment counts if exists). Automatic, real-time. | ✓ |
| Cron materialization | A Convex cron job periodically scans toolExecutions and materializes/refreshes edges. Batch approach, simpler error handling but not real-time. | |
| You decide | Claude picks based on existing ingest patterns and Phase 63's real-time requirement | |

**User's choice:** Ingest-driven

### Session link

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — include sessionId | Allows filtering the call graph to a specific session. Useful for debugging but adds a field. | ✓ |
| No — edges are aggregate | Edges represent the overall dependency graph, not per-session. Phase 63 shows the global topology. Simpler. | |
| You decide | Claude picks based on Phase 63's success criteria | |

**User's choice:** Yes — include sessionId

---

## githubTrigger shape

### Trigger shape

| Option | Description | Selected |
|--------|-------------|----------|
| Boolean + global config | pagerdutyEnabled is a boolean; githubTrigger is also boolean. Repo/workflow/ref/PAT live in a global settings table. Simple but less flexible. | |
| Per-rule config object | githubTrigger is an optional object: { enabled, repo, workflowFile, ref }. PAT stored separately in env/secrets. Each rule can target a different workflow. | ✓ |
| You decide | Claude picks based on Phase 65 requirements | |

**User's choice:** Per-rule config object

### PD shape

| Option | Description | Selected |
|--------|-------------|----------|
| Keep boolean + global key | pagerdutyEnabled stays a boolean flag. Routing key is a single global config. Simpler, matches SCH-03 as written. | |
| Per-rule PD config | pagerdutyConfig: { enabled, routingKey, severity? }. Each rule can route to different PagerDuty services. Phase 64 mentions 'per-rule toggle' + 'routing key configuration'. | ✓ |
| You decide | Claude picks based on Phase 64 success criteria | |

**User's choice:** Per-rule PD config

### Secrets

| Option | Description | Selected |
|--------|-------------|----------|
| Convex env vars | Single PAT / routing key in Convex environment variables. Phase 59 just stores the per-rule config shape; secrets are resolved at dispatch time. | |
| Per-rule encrypted field | Store encrypted PAT/routing key directly on the rule. More flexible for multi-target but adds encryption complexity now. | |
| You decide | Claude picks the simplest approach for a schema-only phase | ✓ |

**User's choice:** You decide
**Notes:** Claude chose Convex env vars — simplest for a schema-only phase. Per-rule config stores non-secret identifiers; secrets resolved at dispatch time in Phases 64/65.

---

## Delivery log schemas

### Log pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror it closely | Same structure as webhookDeliveryLog: alertId/ruleId, attempt number, status, error, timestamp. Channel-specific fields added per table. | ✓ |
| Unified delivery log | One deliveryLog table with a 'channel' discriminator instead of three separate tables. Deviates from SCH-04. | |
| You decide | Claude picks based on SCH-04 requirement and downstream needs | |

**User's choice:** Mirror it closely

### Log linkage

| Option | Description | Selected |
|--------|-------------|----------|
| Link to alert instance | alertId: v.id('alerts') — same as webhookDeliveryLog. | |
| Link to both | alertId + ruleId. Allows querying by rule or by alert instance. | ✓ |
| You decide | Claude picks based on downstream UI needs | |

**User's choice:** Link to both

### Retention

| Option | Description | Selected |
|--------|-------------|----------|
| Add archived field | Include optional 'archived' boolean. Lets existing retention cron handle cleanup. | ✓ |
| No retention yet | Delivery logs are small. Defer archival. Keep schema minimal. | |
| You decide | Claude picks based on existing archival patterns | |

**User's choice:** Add archived field

---

## Existing data handling

### Backfill

| Option | Description | Selected |
|--------|-------------|----------|
| Accept nulls, no backfill | New fields are optional. Old rows show as 'unknown agent' in sunburst. | |
| One-time backfill | Write a migration mutation that cross-references events/toolExecutions. | ✓ |
| You decide | Claude picks based on how much historical data matters | |

**User's choice:** One-time backfill

### Backfill timing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 59 — part of schema work | Write the backfill mutation alongside schema changes. Data ready when Phase 61 starts. | ✓ |
| Phase 61 — when data is needed | Phase 59 only adds fields + index. Phase 61 writes the backfill. | |
| You decide | Claude picks based on phase scope boundaries | |

**User's choice:** Phase 59 — part of schema work

---

## Claude's Discretion

- Secrets storage approach: Convex env vars for PAT/routing keys (chosen by Claude as simplest for schema-only phase)
- Exact backfill mutation implementation details
- Index design for delivery log tables
- Channel-specific fields for each delivery log table

## Deferred Ideas

None
