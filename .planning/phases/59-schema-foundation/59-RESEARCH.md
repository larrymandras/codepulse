# Phase 59: Schema Foundation - Research

**Researched:** 2026-05-17
**Domain:** Convex schema definition, table extensions, upsert mutations, backfill mutations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `callGraphEdges` edges represent agent-to-tool calls only. Source = agentId, target = toolName.
- **D-02:** Rich metadata per edge: callCount, lastCallAt, lastErrorAt, errorCount, status (healthy/errored). Self-contained for Phase 63.
- **D-03:** Edges include sessionId to allow per-session call graph filtering.
- **D-04:** Edges upserted from runtimeIngest.ts on tool execution events — real-time, not batch.
- **D-05:** `githubTrigger` is optional per-rule config object `{ enabled: boolean, repo: string, workflowFile: string, ref: string }`.
- **D-06:** `pagerdutyEnabled` becomes `pagerdutyConfig` — optional per-rule config object `{ enabled: boolean, routingKey: string, severity?: string }`.
- **D-07:** Secrets live in Convex environment variables, not per-rule fields. Per-rule stores non-secret identifiers.
- **D-08:** Three separate delivery log tables (emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog) — not unified.
- **D-09:** Each delivery log links to both alertId and ruleId.
- **D-10:** All three delivery log tables include optional `archived` boolean. Channel-specific fields per table.
- **D-11:** `llmMetrics` gets optional agentId and toolName fields plus `by_agent` index. Fields are `v.optional()`.
- **D-12:** One-time backfill mutation in Phase 59 scope. Cross-references events/toolExecutions to populate agentId/toolName on historical rows.

### Claude's Discretion

- Exact backfill mutation implementation (batch size, error handling)
- Index design for delivery log tables (by_alert, by_ruleId, by_timestamp patterns)
- emailDeliveryLog specific fields (recipient, subject, templateId, etc.)
- pagerdutyDeliveryLog specific fields (dedupKey, incidentKey, action type)
- githubTriggerLog specific fields (runUrl, dispatchId, rateLimited flag)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCH-01 | New `callGraphEdges` table with materialized integration dependency edges upserted on ingest events | Table schema design, upsert pattern from ingest, Convex `patch`+`insert` upsert idiom |
| SCH-02 | `llmMetrics` table extended with optional `agentId` and `toolName` fields and `by_agent` index | Schema patch, `v.optional()` for backward compat, backfill strategy |
| SCH-03 | `alertRuleCustom` table extended with `pagerdutyConfig` and `githubTrigger` fields | Schema patch, extend create/update mutations with optional nested objects |
| SCH-04 | New delivery log tables (emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog) with insert mutations | Table schema design, webhookDeliveryLog reference pattern |
</phase_requirements>

---

## Summary

Phase 59 is a pure backend schema phase — no UI, no rendering. All four requirements are Convex-only: new `defineTable()` entries in `convex/schema.ts`, optional field additions via `v.optional()` on two existing tables, new indexes, and mutations to insert/upsert into the new tables.

The codebase already has 60+ tables in `schema.ts` and well-established patterns for every operation needed here. Every pattern this phase uses already exists: `webhookDeliveryLog` is the exact template for three delivery log tables, `alertRuleCustom` CRUD with Clerk auth is the extension target for D-05/D-06, `llm.ts recordCall` is the extension target for D-11, and `runtimeIngest.ts` switch block is the extension target for D-04 (callGraphEdges upsert).

The only novel element is the backfill mutation (D-12). Because `toolExecutions` does not carry `agentId` in its schema, cross-referencing to populate historical `llmMetrics.agentId` must work through `sessionId` + timestamp proximity against the `events` table — or simply omit agentId on historical rows where the data cannot be reliably inferred. This is Claude's Discretion and must be addressed at plan time.

**Primary recommendation:** Follow existing patterns exactly. Add 4 new tables and extend 2 existing ones in a single schema.ts edit, then create one mutation file per new table. Keep the backfill mutation conservative (batch of 100, skip rows where agentId cannot be determined).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| callGraphEdges table + upsert | Database / Storage | API / Backend | Convex table owns persistence; runtimeIngest.ts mutation owns write path |
| llmMetrics field extension | Database / Storage | — | Schema-only change; existing mutation extended |
| llmMetrics backfill | API / Backend | Database / Storage | internalMutation reads/writes Convex tables; no external calls |
| alertRuleCustom field extension | Database / Storage | API / Backend | Schema change + mutation arg extension |
| Delivery log tables | Database / Storage | API / Backend | New tables + insert mutations only; no delivery logic in this phase |
| Archival extension | API / Backend | — | archival.ts markStaleArchived must include 3 new tables |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | 1.39.1 | Database, mutations, queries, schema | Already in use; all backend code is Convex [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| convex/values `v` | (bundled with 1.39.1) | Schema validators (v.string, v.optional, v.object, v.float64) | All schema and mutation arg definitions |
| convex/server | (bundled) | defineTable, defineSchema, mutation, query, internalMutation | All server-side Convex definitions |

### Alternatives Considered

None — this is a pure Convex backend phase. The existing stack is locked.

**Installation:** No new packages required. All tooling already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
runtimeIngest.ts (httpAction)
  |
  |-- [hive_mind_entry event] ---> callGraphEdges.upsertEdge() (primary path)
  |                                      |
  |-- [tool_execution event] ----> callGraphEdges.upsertEdge() (secondary/future path)
  |                                      |
  |                              callGraphEdges table
  |                            (agentId, toolName, sessionId,
  |                             callCount, errorCount, status)
  |
  +-- [llm_call event] -----> llm.recordCall() (extended args)
                                   |
                            llmMetrics table
                          (+ optional agentId, toolName, by_agent index)

Phase 64/65 dispatch actions
  |
  +-- insert ---> emailDeliveryLog / pagerdutyDeliveryLog / githubTriggerLog
               (alertId, ruleId, status, sentAt, channel-specific fields)

alertRuleCustom CRUD mutations (alertRuleCustom.ts)
  |
  +-- create/update (extended) ---> alertRuleCustom table
                                (+ pagerdutyConfig, githubTrigger objects)

backfillLlmMetrics (internalMutation -- one-time)
  |
  |-- query events table (by_session)
  +-- patch llmMetrics rows (agentId, toolName where derivable)
```

### Recommended Project Structure

No new directories needed. New files go in `convex/`:

```
convex/
├── schema.ts              # All table additions and field extensions here
├── callGraphEdges.ts      # upsertEdge mutation + query exports (NEW)
├── deliveryLogs.ts        # insert mutations for all 3 delivery log tables (NEW)
├── llm.ts                 # extend recordCall args + add backfill internalMutation
├── alertRuleCustom.ts     # extend create/update mutation args
└── archival.ts            # extend markStaleArchived table list
```

### Pattern 1: Convex Upsert (no native upsert — query-then-patch-or-insert)

**What:** Convex has no built-in upsert. The standard pattern is: query by index, then patch if found, insert if not.
**When to use:** callGraphEdges upsertEdge mutation (D-04)

```typescript
// Source: Convex docs — ctx7 /llmstxt/convex_dev_llms_txt
export const upsertEdge = mutation({
  args: {
    agentId: v.string(),
    toolName: v.string(),
    sessionId: v.string(),
    success: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("callGraphEdges")
      .withIndex("by_agent_tool", (q) =>
        q.eq("agentId", args.agentId).eq("toolName", args.toolName)
      )
      .first();

    const now = args.timestamp;

    if (existing) {
      await ctx.db.patch(existing._id, {
        callCount: existing.callCount + 1,
        lastCallAt: now,
        errorCount: args.success ? existing.errorCount : existing.errorCount + 1,
        lastErrorAt: args.success ? existing.lastErrorAt : now,
        status: args.success ? "healthy" : "errored",
      });
    } else {
      await ctx.db.insert("callGraphEdges", {
        agentId: args.agentId,
        toolName: args.toolName,
        sessionId: args.sessionId,
        callCount: 1,
        lastCallAt: now,
        errorCount: args.success ? 0 : 1,
        lastErrorAt: args.success ? undefined : now,
        status: args.success ? "healthy" : "errored",
        archived: undefined,
      });
    }
  },
});
```

### Pattern 2: Optional Field Extension (backward-compatible schema change)

**What:** Adding optional fields to an existing table. Existing rows are automatically valid because `v.optional()` allows undefined.
**When to use:** llmMetrics (D-11), alertRuleCustom (D-05/D-06)

```typescript
// Source: existing schema.ts conventions in this codebase
// BEFORE (existing llmMetrics):
llmMetrics: defineTable({
  provider: v.string(),
  model: v.string(),
  // ... existing fields
  archived: v.optional(v.boolean()),
})

// AFTER (Phase 59 extension):
llmMetrics: defineTable({
  provider: v.string(),
  model: v.string(),
  // ... existing fields
  archived: v.optional(v.boolean()),
  agentId: v.optional(v.string()),    // NEW — Phase 59 SCH-02
  toolName: v.optional(v.string()),   // NEW — Phase 59 SCH-02
})
  .index("by_provider", ["provider", "timestamp"])
  .index("by_model", ["model", "timestamp"])
  .index("by_session", ["sessionId", "timestamp"])
  .index("by_timestamp", ["timestamp"])
  .index("by_agent", ["agentId", "timestamp"])   // NEW — Phase 59 SCH-02
```

### Pattern 3: Delivery Log Table (from webhookDeliveryLog reference)

**What:** The `webhookDeliveryLog` table at schema.ts line ~893 is the exact template. Fields: alertId, channel, attempt, status, statusCode, errorMessage, sentAt.
**When to use:** All three new delivery log tables (D-08/D-09/D-10)

```typescript
// Source: convex/schema.ts line 893 — webhookDeliveryLog (existing)
webhookDeliveryLog: defineTable({
  alertId: v.id("alerts"),
  channel: v.string(),          // "discord" | "slack"
  attempt: v.float64(),
  status: v.string(),           // "success" | "failed"
  statusCode: v.optional(v.float64()),
  errorMessage: v.optional(v.string()),
  sentAt: v.float64(),
}).index("by_alert", ["alertId", "sentAt"]),

// NEW pattern derived from above — emailDeliveryLog:
emailDeliveryLog: defineTable({
  alertId: v.id("alerts"),      // D-09: link to alert
  ruleId: v.string(),           // D-09: link to rule
  attempt: v.float64(),
  status: v.string(),           // "success" | "failed"
  errorMessage: v.optional(v.string()),
  recipient: v.optional(v.string()),   // channel-specific (Claude's Discretion)
  subject: v.optional(v.string()),     // channel-specific
  sentAt: v.float64(),
  archived: v.optional(v.boolean()),   // D-10
})
  .index("by_alert", ["alertId", "sentAt"])
  .index("by_rule", ["ruleId", "sentAt"])
  .index("by_timestamp", ["sentAt"]),
```

### Pattern 4: Nested Object Config in alertRuleCustom

**What:** Adding optional nested config objects to a table. Use `v.optional(v.object({...}))`.
**When to use:** pagerdutyConfig and githubTrigger fields on alertRuleCustom (D-05/D-06)

```typescript
// Source: Convex docs + existing conditionGroupValidator pattern in alertRuleCustom.ts
alertRuleCustom: defineTable({
  // ... existing fields ...
  pagerdutyConfig: v.optional(v.object({    // D-06
    enabled: v.boolean(),
    routingKey: v.string(),
    severity: v.optional(v.string()),
  })),
  githubTrigger: v.optional(v.object({      // D-05
    enabled: v.boolean(),
    repo: v.string(),
    workflowFile: v.string(),
    ref: v.string(),
  })),
})
```

The `create` and `update` mutations in `alertRuleCustom.ts` use the same validator shape for args. Define the validator at the top of the file (following the `conditionValidator` / `conditionGroupValidator` pattern already there) and reference it in both mutation args.

### Pattern 5: internalMutation for Backfill

**What:** One-time backfill as an `internalMutation` (not exposed via API). Can be triggered manually via Convex dashboard or a one-off `npx convex run`.
**When to use:** llmMetrics backfill (D-12)

```typescript
// Source: existing internalMutation pattern in llm.ts (rollupCosts)
import { internalMutation } from "./_generated/server";

export const backfillAgentId = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Process in batches to avoid mutation time limits
    const rows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .filter((q) => q.eq(q.field("agentId"), undefined))
      .take(100);  // Claude's Discretion: batch size

    for (const row of rows) {
      // Attempt to find correlated event by sessionId + timestamp proximity
      // ... (implementation is Claude's Discretion)
      await ctx.db.patch(row._id, { agentId: derivedAgentId, toolName: derivedToolName });
    }
    return { processed: rows.length };
  },
});
```

**Run backfill once deployed:**
```bash
npx convex run llm:backfillAgentId
```

### Anti-Patterns to Avoid

- **Adding required (non-optional) fields to existing tables:** Breaks existing rows. All new fields on `llmMetrics` and `alertRuleCustom` MUST be `v.optional()`.
- **Implementing delivery logic in this phase:** Phase 59 is schema-only. No Resend calls, no PagerDuty API calls.
- **Single-index on agentId alone for by_agent:** The `by_agent` index on `llmMetrics` must be `["agentId", "timestamp"]` (compound), matching the `by_session` compound index pattern used throughout the schema.
- **Forgetting archival.ts:** The `markStaleArchived` function in `archival.ts` currently covers only 4 tables. The three new delivery log tables need `archived` fields (D-10) and the archival function should be extended to include them.
- **Nested object validators not defined at module scope:** Define `pagerdutyConfigValidator` and `githubTriggerValidator` as constants at the top of `alertRuleCustom.ts` — same pattern as `conditionValidator` — so they can be reused in both `create` and `update` mutation args.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upsert | Custom merge function | query-then-patch-or-insert | Convex transactions guarantee atomicity; this is the idiomatic pattern |
| Backfill orchestration | A cron job or scheduled function | One-time `internalMutation` triggered via `npx convex run` | Simpler, auditable, no cleanup needed |
| Config object validation | Raw `v.any()` for pagerdutyConfig/githubTrigger | `v.optional(v.object({...}))` | Type safety at insert/patch time; avoids silent schema drift |

**Key insight:** Convex's schema system gives free runtime validation on every insert and patch — use typed `v.object()` instead of `v.any()` everywhere objects have known structure.

---

## Common Pitfalls

### Pitfall 1: Index Not Queryable Until Schema is Deployed

**What goes wrong:** Adding a new index to an existing table doesn't make it usable until `npx convex deploy` runs. Queries against a non-existent index throw at runtime.
**Why it happens:** Convex indexes are defined in schema.ts but materialized on deploy.
**How to avoid:** Deploy schema before writing queries that use new indexes. In dev, `npx convex dev` auto-deploys on save.
**Warning signs:** `Index 'by_agent' not found` error in Convex function logs.

### Pitfall 2: Forgetting to Extend Mutation Args When Extending Schema

**What goes wrong:** Schema accepts `pagerdutyConfig` but the `create` mutation arg validator doesn't include it, so the field can never be set via the mutation.
**Why it happens:** Schema and mutation args are defined separately. They don't auto-sync.
**How to avoid:** Every schema field addition on an existing table needs a corresponding arg addition in every relevant mutation (create, update). Review all mutations for `alertRuleCustom` — `create` and `update` in `alertRuleCustom.ts`.
**Warning signs:** Field is always undefined in DB despite UI sending it.

### Pitfall 3: callGraphEdges Upsert Race Condition

**What goes wrong:** Two concurrent tool execution events for the same agent+tool arrive simultaneously. Both query the table, both find no row, both insert — creating duplicates.
**Why it happens:** Convex mutations are serialized per document but not per table-query-then-insert. Two concurrent mutations can both read "no row" before either inserts.
**How to avoid:** In practice this is rare for this use case (agent tool calls are sequential within a session). The duplicate row is a cosmetic issue (inflated callCount on the next real upsert will not merge them). Add a `by_agent_tool_session` index (compound on agentId + toolName + sessionId) as a lookup key and document this as a known edge case for Phase 63.
**Warning signs:** Multiple `callGraphEdges` rows with identical agentId + toolName.

### Pitfall 4: Backfill Mutation Exceeding Time Limit

**What goes wrong:** `backfillAgentId` tries to process all historical `llmMetrics` rows in one mutation call. Convex mutations have a ~1-2 second execution limit.
**Why it happens:** Unbounded `.collect()` on a large table.
**How to avoid:** Use `.take(100)` (or similar small batch). The mutation must be called repeatedly until it returns `{ processed: 0 }`. Document this in the plan as a manual multi-run step.
**Warning signs:** `FunctionExecutionTimeout` in Convex dashboard.

### Pitfall 5: toolExecutions Has No agentId — Backfill Data May Be Sparse

**What goes wrong:** The backfill for `llmMetrics.agentId` cannot reliably source `agentId` from `toolExecutions` because that table has no `agentId` column (verified in schema.ts lines 514-528). The `events` table has `sessionId` but not `agentId` directly. The `agents` table has `agentId` keyed by `sessionId`.
**Why it happens:** `toolExecutions` is populated from Claude Code hook events (`PostToolUse`), which carry sessionId but not agentId.
**How to avoid:** The backfill strategy should join `llmMetrics.sessionId` → `agents` table → pick the most-recently-active agentId at the row's timestamp. For many historical rows, agentId will remain undefined, which is acceptable (fields are optional). Do not fabricate agentId values.
**Warning signs:** Artificially low coverage if the join logic is too strict.

---

## Code Examples

### callGraphEdges table definition

```typescript
// convex/schema.ts — add alongside existing runtime tables
callGraphEdges: defineTable({
  agentId: v.string(),
  toolName: v.string(),
  sessionId: v.string(),
  callCount: v.float64(),
  lastCallAt: v.float64(),
  lastErrorAt: v.optional(v.float64()),
  errorCount: v.float64(),
  status: v.string(),           // "healthy" | "errored"
  archived: v.optional(v.boolean()),
})
  .index("by_agent_tool", ["agentId", "toolName"])
  .index("by_session", ["sessionId"])
  .index("by_timestamp", ["lastCallAt"]),
```

### runtimeIngest.ts addition for callGraphEdges upsert

```typescript
// convex/runtimeIngest.ts — PRIMARY: add upsertEdge dispatch inside existing hive_mind_entry case
// The hive_mind_entry case (line 583) already receives agentType/toolName/success/sessionKey
// from Astrid runtime agents. Add upsertEdge call within that handler.
//
// SECONDARY: add standalone tool_execution case for future-proofing
case "tool_execution": {
  const d = data as any;
  await ctx.runMutation(api.callGraphEdges.upsertEdge, {
    agentId: d.agentId ?? d.agent_id ?? "unknown",
    toolName: d.toolName ?? d.tool_name ?? "unknown",
    sessionId: d.sessionId ?? d.session_id ?? "unknown",
    success: d.success ?? true,
    timestamp,
  });
  break;
}
```

### alertRuleCustom.ts validator additions

```typescript
// convex/alertRuleCustom.ts — add at top of file near conditionValidator
const pagerdutyConfigValidator = v.object({
  enabled: v.boolean(),
  routingKey: v.string(),
  severity: v.optional(v.string()),
});

const githubTriggerValidator = v.object({
  enabled: v.boolean(),
  repo: v.string(),
  workflowFile: v.string(),
  ref: v.string(),
});

// Then in create mutation args:
pagerdutyConfig: v.optional(pagerdutyConfigValidator),
githubTrigger: v.optional(githubTriggerValidator),

// And in update mutation args (same additions):
pagerdutyConfig: v.optional(pagerdutyConfigValidator),
githubTrigger: v.optional(githubTriggerValidator),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual pagination in backfills | `.take(N)` batch pattern | Convex 1.x | Prevents mutation timeouts |
| `v.any()` for config objects | `v.optional(v.object({...}))` | Convex schema best practice | Type safety at DB layer |

**Deprecated/outdated:**
- Using `v.any()` for known config shapes: The codebase uses it for legacy fields (`stages: v.optional(v.any())`), but new config objects in this phase should use typed `v.object()` per D-05 and D-06.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `hive_mind_entry` is the primary runtime event carrying agentId (as `agent_type`/`agentType`) and toolName for call graph edges. Verified at runtimeIngest.ts line 583: `hive_mind_entry` case carries `agent_type`, `tool_name`, `success`, `session_key`. A secondary `tool_execution` case is added for future-proofing. (RESOLVED) | Architecture Patterns / runtimeIngest | Low -- dual-case handler covers both current and future event types |
| A2 | Historical backfill coverage for `llmMetrics.agentId` will be low/partial because `toolExecutions` has no agentId | Common Pitfalls | If the events table carries enough data to reconstruct agentId per timestamp, coverage could be higher — investigate during implementation |

---

## Open Questions (RESOLVED)

1. **What event type does Astrid use for tool executions in the runtime ingest path?** (RESOLVED)
   - What we know: `runtimeIngest.ts` already handles many event types. The build-time ingest handles `PostToolUse`. For runtime agents (not Claude Code hooks), there is `hive_mind_entry` which carries `toolName` and `agentType`.
   - Resolution: Verified at runtimeIngest.ts line 583 -- the `hive_mind_entry` case already carries `agent_type`/`agentType`, `tool_name`/`toolName`, `success`, and `session_key`/`sessionKey`. The plan adds upsertEdge dispatch to the existing `hive_mind_entry` handler (primary path) AND adds a standalone `tool_execution` case as a secondary handler for future-proofing. This dual approach ensures callGraphEdges is populated from existing Astrid events immediately, while also supporting any future dedicated tool_execution event type.

2. **Backfill: should it run as a one-shot manual run or as a cron that self-terminates?** (RESOLVED)
   - What we know: D-12 says "one-time backfill mutation." `internalMutation` with `.take(100)` is idiomatic.
   - Resolution: Plan uses manual multi-run via `npx convex run llm:backfillAgentId`. Historical coverage is best-effort. Phase 61 (Token Sunburst) will primarily use forward-only data from Phase 59 deployment; backfill provides bonus coverage for historical rows where agentId can be derived.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex CLI | Schema deploy, test run | ✓ | 1.39.1 | — |
| Node.js | Convex dev server | ✓ | 22.17.0 | — |
| Vitest | Unit tests | ✓ | (in package.json) | — |

No missing dependencies. All tooling is available.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (or via package.json) |
| Quick run command | `npx vitest run convex/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCH-01 | callGraphEdges upsert creates row on first call | unit (logic) | `npx vitest run convex/callGraphEdges.test.ts -x` | ❌ Wave 0 |
| SCH-01 | callGraphEdges upsert increments callCount on subsequent calls | unit (logic) | `npx vitest run convex/callGraphEdges.test.ts -x` | ❌ Wave 0 |
| SCH-01 | callGraphEdges upsert sets status=errored on failure | unit (logic) | `npx vitest run convex/callGraphEdges.test.ts -x` | ❌ Wave 0 |
| SCH-02 | recordCall mutation accepts optional agentId and toolName | unit (logic) | `npx vitest run convex/llm.test.ts -x` | ❌ Wave 0 |
| SCH-02 | by_agent index query expression is correct | unit (logic) | `npx vitest run convex/llm.test.ts -x` | ❌ Wave 0 |
| SCH-03 | create mutation accepts pagerdutyConfig and githubTrigger | unit (logic) | `npx vitest run convex/alertRuleCustom.test.ts -x` | ❌ Wave 0 |
| SCH-03 | update mutation accepts pagerdutyConfig and githubTrigger | unit (logic) | `npx vitest run convex/alertRuleCustom.test.ts -x` | ❌ Wave 0 |
| SCH-04 | emailDeliveryLog insert mutation stores alertId and ruleId | unit (logic) | `npx vitest run convex/deliveryLogs.test.ts -x` | ❌ Wave 0 |
| SCH-04 | pagerdutyDeliveryLog insert mutation stores dedupKey | unit (logic) | `npx vitest run convex/deliveryLogs.test.ts -x` | ❌ Wave 0 |
| SCH-04 | githubTriggerLog insert mutation stores dispatchId and runUrl | unit (logic) | `npx vitest run convex/deliveryLogs.test.ts -x` | ❌ Wave 0 |

**Note on test style:** Existing Convex tests in this codebase (see `archival.test.ts`, `agentMetrics.test.ts`) do NOT use a live Convex test environment — they test pure TypeScript logic (validator shapes, computation formulas, array contents). Mutation handler tests use `it.todo()` for DB-dependent paths. Follow the same pattern for Phase 59 tests: test the upsert logic (increment formulas, status derivation, batch size limits) as pure functions; mark DB-round-trip paths as `.todo`.

### Sampling Rate
- **Per task commit:** `npx vitest run convex/callGraphEdges.test.ts convex/deliveryLogs.test.ts convex/llm.test.ts convex/alertRuleCustom.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `convex/callGraphEdges.test.ts` — covers SCH-01 upsert logic
- [ ] `convex/deliveryLogs.test.ts` — covers SCH-04 insert arg shapes
- [ ] `convex/llm.test.ts` — covers SCH-02 optional field + backfill batch logic
- [ ] `convex/alertRuleCustom.test.ts` — covers SCH-03 new validator args

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk identity check — already in alertRuleCustom.ts create/update; extend to new fields automatically |
| V3 Session Management | no | No session changes in this phase |
| V4 Access Control | yes | All schema mutations that modify alert rules require authenticated Clerk identity (existing CPHLTH-01 pattern) |
| V5 Input Validation | yes | `v.object({...})` validators for pagerdutyConfig/githubTrigger; delivery log insert args are typed |
| V6 Cryptography | no | Secrets (PAT, routing key) are Convex env vars — not stored in schema in this phase (D-07) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated schema mutation | Spoofing | Clerk auth check on all alertRuleCustom mutations (CPHLTH-01) |
| Routing key stored in DB | Information Disclosure | D-07 explicitly defers routing key storage — per-rule field stores non-secret identifier only |
| Unclamped batch in backfill | Denial of Service | `.take(100)` batch limit on backfill mutation |

---

## Sources

### Primary (HIGH confidence)
- `convex/schema.ts` — full table inventory, webhookDeliveryLog reference pattern (lines 893-901), alertRuleCustom schema (lines 859-882), llmMetrics schema (lines 269-284) [VERIFIED: read directly]
- `convex/alertRuleCustom.ts` — CRUD mutation pattern, conditionValidator reuse, Clerk auth check [VERIFIED: read directly]
- `convex/llm.ts` — recordCall mutation pattern, internalMutation backfill reference (rollupCosts) [VERIFIED: read directly]
- `convex/runtimeIngest.ts` — ingest switch block, mutation dispatch pattern, hive_mind_entry case at line 583 carrying agentType/toolName/success/sessionKey [VERIFIED: read directly]
- `convex/archival.ts` — table list in markStaleArchived [VERIFIED: read directly]
- Context7 `/llmstxt/convex_dev_llms_txt` — upsert pattern (query-then-patch-or-insert), defineTable, v.optional [CITED: ctx7 docs]

### Secondary (MEDIUM confidence)
- npm registry: convex@1.39.1 current [VERIFIED: npm view]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Convex 1.39.1 confirmed, all patterns verified in codebase
- Architecture: HIGH — every pattern has an exact existing example in the repo
- Pitfalls: HIGH — all pitfalls derived from direct inspection of the codebase; toolExecutions lack of agentId is a verified fact

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (Convex schema API is stable; patterns are unlikely to change)
