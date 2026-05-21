# Phase 66: Gateway Compatibility Layer - Research

**Researched:** 2026-05-21
**Domain:** Convex schema migration, OTel ingest routing, cross-repo telemetry emission, provider registry pattern
**Confidence:** HIGH — all findings verified directly against source files in both repos

---

## Summary

Phase 66 is a compatibility shim that bridges the new multi-provider CLI Gateway sidecar into the existing CodePulse telemetry pipeline. The gateway is fully built on `feature/cli-gateway` in the Ástríðr repo — the code is real, verified, and ready to merge. The problem is entirely on the CodePulse side: the ingest pipeline, schema, and UI were built when only one provider (Anthropic) existed, and they hardcode that assumption in six distinct places.

The six fixes divide cleanly into three tiers: (1) two-line OTel default fixes, (2) schema additions with index updates, and (3) a new provider registry module that drives dynamic queries and UI rendering. The Ástríðr-side work is a single method addition to `CLIGatewayTool.execute()` — after task completion, emit a CodePulse-compatible telemetry event via the existing ingest API.

No new Convex HTTP routes are needed — gateway events are emitted by Ástríðr's `CLIGatewayTool` through the existing `/v1/logs` OTel endpoint. The gateway REST endpoints (`/health`, `/quota`) are polled from the CodePulse frontend via the existing `authHeaders()` Ástríðr API pattern. This phase does NOT introduce a `gatewayTasks` table — that belongs to Phase 68 (Gateway Observability).

**Primary recommendation:** Fix in dependency order: schema first (unblocks everything), OTel defaults second (stops misattribution immediately), provider registry third (unblocks UI), gateway event routing fourth, CLIGatewayTool emission fifth, ProviderHealthPanel dynamic rendering last.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **OTel default fix:** `getAttr(attrs, "provider") ?? "anthropic"` → `?? "unknown"` with structured warning log. Files: `convex/otelLogs.ts:182`, `convex/otelMetrics.ts:170,188`.
2. **Gateway event routing in OTel logs handler:** New event names `gateway.task_started`, `gateway.task_completed`, `gateway.task_failed`, `gateway.routing_decision` route to `toolExecutions` (and future `gatewayTasks` in Phase 68).
3. **CLIGatewayTool telemetry emission** (`astridr-repo: astridr/tools/cli_gateway.py`): after task completion, emit OTel log event with `provider`, `model`, `duration_seconds`, `cost_usd`, `task_id` mapped to CodePulse field names. Sent via existing Ástríðr codepulse telemetry client.
4. **Schema additions:** `provider: v.optional(v.string())` on `sessions` (line 39) and `toolExecutions` (line 539) with `by_provider` indexes.
5. **Central provider registry:** `convex/lib/providers.ts` — replaces hardcoded `["anthropic_direct", "openrouter", "ollama"]` arrays in `providerHealth.ts:54` and `ProviderHealthPanel.tsx:55`.
6. **ProviderHealth schema extension:** Add `authenticated: v.optional(v.boolean())`, `billingType: v.optional(v.string())`, `quotaRemaining: v.optional(v.float64())` to `providerHealth` table (currently line 759).
7. **Dynamic ProviderHealthPanel:** Read provider list from registry, show `authenticated`, `billingType`, `quotaRemaining` from new schema fields.

### Claude's Discretion

- How the CLIGatewayTool emits telemetry: whether it calls the CodePulse ingest API directly or uses an existing Ástríðr telemetry client — use whatever pattern already exists in Ástríðr.
- Exact shape of the `gateway.task_*` OTel log record attributes — design for minimal friction with gateway's `TaskResponse` fields.
- Whether `gateway.task_started` / `gateway.task_failed` route to `toolExecutions` or only `gateway.task_completed` does — use judgment based on what's useful for Phase 68.
- Provider registry file location and export shape — `convex/lib/providers.ts` specified, internal structure is discretion.
- Whether to add `by_provider` index to `sessions` only or also to `toolExecutions` — CONTEXT specifies both.

### Deferred Ideas (OUT OF SCOPE)

- `gatewayTasks` table (Phase 68)
- `gatewayQuotaSnapshots` table (Phase 68)
- `routingDecisions` table (Phase 68)
- GatewayQuotaPanel, ProviderComparisonChart, GatewayTasksPanel (Phase 68)
- Multi-provider pricing (`modelPricing.ts` GPT/Gemini rates) (Phase 67)
- `billingType` on `llmMetrics` (Phase 67)
- SDK spend guard (Phase 69)
- Provider enable/disable controls (Phase 69)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GW-01 | A Codex CLI task routed through the gateway appears in CodePulse with `provider: "codex"`, not `provider: "anthropic"` | Fix OTel defaults + add `provider` field to sessions/toolExecutions + CLIGatewayTool telemetry emission |
| GW-02 | Gateway task events route to `toolExecutions` and proper tables (not generic `events` table) | New `gateway.*` event routing cases in `otelLogs.ts` routeLogRecord switch |
| GW-03 | Provider health panel shows all 4 gateway providers with availability and auth status | Provider registry + schema extension + dynamic ProviderHealthPanel |
| GW-04 | Existing Claude-only telemetry continues working unchanged | OTel default fix is backward-safe; schema additions are optional fields; registry includes legacy provider names |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider attribution (fix misattribution) | API / Backend (Convex OTel handlers) | Ástríðr (emission side) | Convex owns routing; Ástríðr owns what it emits |
| Gateway event ingestion | API / Backend (`otelLogs.ts`) | — | Extends existing OTel log routing switch |
| Schema migration (`provider` field, new providerHealth fields) | Database / Storage (Convex schema) | — | Pure schema change, no frontend impact until queries updated |
| Provider registry | API / Backend (`convex/lib/providers.ts`) | Frontend (reads from registry via query) | Registry lives in backend; UI consumes via `useQuery` |
| ProviderHealthPanel dynamic rendering | Browser / Client | Frontend Server (Convex query) | Panel already uses `useQuery`; change is reading from registry not hardcoded array |
| CLIGatewayTool telemetry emission | API / Backend (Ástríðr Python) | — | Ástríðr emits to CodePulse `/v1/logs` — cross-repo backend change |

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Convex | Existing | Schema, mutations, queries, HTTP actions | Project database layer |
| TypeScript | 5.9 | All Convex and React code | Project standard |
| httpx | Existing in Ástríðr | HTTP client for CLIGatewayTool → CodePulse emission | Already used in `cli_gateway.py` |
| Vitest | Existing | Test framework for Convex `__tests__/` | Project test standard |

**No new npm or pip packages required.** All work uses existing dependencies. [VERIFIED: read package.json and astridr-repo dependencies in this session]

---

## Architecture Patterns

### System Architecture Diagram

```
Ástríðr CLIGatewayTool.execute()
    │
    ├── POST /tasks → Gateway sidecar (http://cli-gateway:8200)
    │       │
    │       └── polls GET /tasks/{task_id} until completed/failed
    │
    └── [NEW] after task completion:
        emit OTel log event → POST /v1/logs (CodePulse Convex)
            │
            └── otelLogsIngest → routeLogRecord()
                    │
                    ├── "gateway.task_completed" → toolExecutions.insert (with provider)
                    ├── "gateway.task_failed"    → toolExecutions.insert (with provider, error)
                    ├── "gateway.task_started"   → toolExecutions.insert (with provider)
                    └── "gateway.routing_decision" → events.ingest (for Phase 68)

CodePulse Frontend (ProviderHealthPanel)
    │
    └── useProviderHealth() → useThrottledQuery(api.providerHealth.latest)
            │
            └── providerHealth.latest query
                    │
                    └── [NEW] reads provider list from convex/lib/providers.ts registry
                        instead of hardcoded ["anthropic_direct", "openrouter", "ollama"]
                        → queries providerHealth table for all 4 gateway providers
```

### Recommended Project Structure

No new directories needed. New file locations:

```
convex/
├── lib/
│   └── providers.ts         [NEW] Central provider registry
├── schema.ts                [MODIFY] Add provider fields + providerHealth extensions
├── providerHealth.ts        [MODIFY] Dynamic query using registry
├── toolExecutions.ts        [MODIFY] Add provider arg to insert mutation
├── sessions.ts              [MODIFY] Add provider arg to upsert mutation
├── otelLogs.ts              [MODIFY] Fix default + add gateway.* cases
└── otelMetrics.ts           [MODIFY] Fix 2 provider defaults

src/components/
└── ProviderHealthPanel.tsx  [MODIFY] Dynamic provider list + new fields

astridr-repo/astridr/tools/
└── cli_gateway.py           [MODIFY] Emit telemetry after task completion
```

### Pattern 1: Convex Schema Migration (optional field addition)

**What:** Adding optional fields to existing tables — safe, no backfill required.
**When to use:** Extending a table without breaking existing rows that lack the new field.

```typescript
// Source: verified against convex/schema.ts in this session

// sessions table addition
sessions: defineTable({
  sessionId: v.string(),
  // ... existing fields ...
  provider: v.optional(v.string()),  // NEW
})
  .index("by_sessionId", ["sessionId"])
  .index("by_status", ["status", "lastEventAt"])
  .index("by_provider", ["provider"]),  // NEW index

// toolExecutions table addition
toolExecutions: defineTable({
  sessionId: v.string(),
  toolName: v.string(),
  // ... existing fields ...
  provider: v.optional(v.string()),  // NEW
})
  .index("by_session", ["sessionId"])
  .index("by_tool", ["toolName", "timestamp"])
  .index("by_timestamp", ["timestamp"])
  .index("by_provider", ["provider"]),  // NEW index

// providerHealth table extension
providerHealth: defineTable({
  providerName: v.string(),
  state: v.string(),
  latencyEmaMs: v.float64(),
  successRate: v.float64(),
  consecutiveFailures: v.float64(),
  lastSuccessAt: v.float64(),
  timestamp: v.float64(),
  // NEW optional fields:
  authenticated: v.optional(v.boolean()),
  billingType: v.optional(v.string()),
  quotaRemaining: v.optional(v.float64()),
})
```

[VERIFIED: read schema.ts lines 39-52, 539-552, 759-769 in this session]

### Pattern 2: Provider Registry Module

**What:** Single source of truth for all provider names, replacing duplicated hardcoded arrays.
**When to use:** Any time provider list is needed — queries, UI, ingest routing.

```typescript
// Source: new file, pattern derived from existing hardcoded arrays

// convex/lib/providers.ts
export const GATEWAY_PROVIDERS = [
  "claude-cli",
  "codex",
  "antigravity",
  "claude-sdk",
] as const;

export const LEGACY_PROVIDERS = [
  "anthropic_direct",
  "openrouter",
  "ollama",
] as const;

export const ALL_PROVIDERS = [...LEGACY_PROVIDERS, ...GATEWAY_PROVIDERS] as const;

export type GatewayProvider = typeof GATEWAY_PROVIDERS[number];
export type LegacyProvider = typeof LEGACY_PROVIDERS[number];
export type AnyProvider = typeof ALL_PROVIDERS[number];
```

### Pattern 3: OTel Log Routing — Adding Gateway Cases

**What:** Extend the `routeLogRecord` switch in `otelLogs.ts` with gateway event names.
**When to use:** When Ástríðr CLIGatewayTool emits `event.name = "gateway.task_completed"` etc.

The normalized event name logic strips `"claude_code."` prefix. Gateway events use a `"gateway."` namespace — no stripping needed, they pass through as-is.

```typescript
// Source: verified against convex/otelLogs.ts in this session

// Add to routeLogRecord() switch after existing cases:

case "gateway.task_completed": {
  const provider = getAttr(attrs, "provider") ?? "unknown";
  const toolName = `gateway:${provider}`;
  const durationMs = getNumAttr(attrs, "duration_ms");
  const taskId = getAttr(attrs, "task_id");
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId,
    toolName,
    provider,
    success: true,
    durationMs,
    timestamp,
  });
  // Also upsert session with provider
  await ctx.runMutation(api.sessions.upsert, {
    sessionId,
    provider,
  });
  break;
}

case "gateway.task_failed": {
  const provider = getAttr(attrs, "provider") ?? "unknown";
  const errorMessage = getAttr(attrs, "error") ?? "Task failed";
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId,
    toolName: `gateway:${provider}`,
    provider,
    success: false,
    errorMessage,
    timestamp,
  });
  break;
}

case "gateway.task_started": {
  // Record start — use success: true (started != failed)
  const provider = getAttr(attrs, "provider") ?? "unknown";
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId,
    toolName: `gateway:${provider}`,
    provider,
    success: true,
    timestamp,
  });
  break;
}

case "gateway.routing_decision": {
  // Fall to generic events table — Phase 68 will add routingDecisions table
  await ctx.runMutation(api.events.ingest, {
    sessionId,
    eventType: "gateway.routing_decision",
    payload: attrsToObj(attrs),
    timestamp,
  });
  break;
}
```

### Pattern 4: CLIGatewayTool Telemetry Emission (Ástríðr Python)

**What:** After task poll returns completed/failed, emit a CodePulse OTel log event.
**When to use:** At the end of `_poll_until_complete()` before returning `ToolResult`.

The CLIGatewayTool currently has no telemetry emission — it just returns a `ToolResult`. The fix adds emission using whatever telemetry client pattern Ástríðr already uses. The OTel log event must match what `routeLogRecord` expects.

```python
# Source: verified against astridr-repo/astridr/tools/cli_gateway.py in this session
# Pattern: emit after status == "completed" branch in _poll_until_complete

# The event must carry these OTel attributes:
# - event.name = "gateway.task_completed" | "gateway.task_failed"
# - provider = data.get("provider", "unknown")
# - task_id = task_id
# - duration_ms = data.get("duration_seconds", 0) * 1000
# - error = data.get("error")  (for failed only)

# The session.id resource attribute must be set to a stable session identifier
# (use task_id as sessionId if no session concept exists in gateway tasks)
```

**Key finding:** `CLIGatewayTool` has NO existing telemetry emission today — need to discover what Ástríðr telemetry client exists before finalizing this pattern. See Open Questions.

### Anti-Patterns to Avoid

- **Hardcoding gateway provider names anywhere:** Any new code that lists providers must import from `convex/lib/providers.ts`. The entire point of this phase is eliminating hardcoded arrays.
- **Adding `provider` as a required field on `toolExecutions.insert`:** It must stay optional — existing callers from OTel `tool_result` routing don't pass `provider` and must continue to work unchanged.
- **Creating a new HTTP route for gateway events:** Gateway events flow through the existing `/v1/logs` OTel endpoint. Do not add `/gateway-ingest`.
- **Patching `providerHealth.upsert` mutation args without adding the new schema fields first:** Convex will reject mutations that write fields not defined in schema. Schema migration must land before mutation updates.
- **Normalizing gateway provider names to legacy names:** `"claude-cli"` must remain `"claude-cli"` in the database — do not map it to `"anthropic_direct"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider list as config | JSON config file, env var, Convex table | `convex/lib/providers.ts` constant | Static list, never runtime-dynamic in this phase; table adds unnecessary query overhead |
| OTel attribute parsing | New attribute extraction utilities | Existing `getAttr()` / `getNumAttr()` in `otelLogs.ts` | Already handles stringValue/intValue/doubleValue; copy pattern exactly |
| Telemetry HTTP client in CLIGatewayTool | New httpx client for CodePulse | Existing Ástríðr telemetry client (to verify in Open Questions) | Avoid a second auth-token-holding HTTP client if one already exists |

**Key insight:** The ingest infrastructure is completely mature. This phase adds cases to existing switch statements and fields to existing tables — it does not build new pipelines.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing `providerHealth` rows in production have no `authenticated`, `billingType`, `quotaRemaining` fields — Convex optional fields backfill cleanly as `undefined` | None — optional fields require no data migration |
| Stored data | Existing `sessions` rows have no `provider` field — will read as `undefined` | None — `by_provider` index will simply be sparse for legacy rows |
| Stored data | Existing `toolExecutions` rows have no `provider` field — will read as `undefined` | None — same as sessions |
| Live service config | Gateway sidecar on `feature/cli-gateway` is NOT yet merged to Ástríðr main — Phase 66 must ship before or with gateway merge | Plan must note merge order dependency |
| OS-registered state | None — no task scheduler, pm2, or systemd entries reference provider names | None |
| Secrets/env vars | No new env vars required — CLIGatewayTool will use existing `CODEPULSE_INGEST_URL` and `ASTRIDR_INGEST_API_KEY` (or equivalent) already present in Ástríðr | Verify actual env var names in Ástríðr config (see Open Questions) |
| Build artifacts | None — no compiled binaries, Docker image tags, or egg-info directories reference provider names | None |

---

## Common Pitfalls

### Pitfall 1: OTel Default Fix Breaks Existing API Requests
**What goes wrong:** Changing `?? "anthropic"` to `?? "unknown"` causes existing Claude API request rows to show `provider: "unknown"` if `provider` attribute is absent from the OTel payload.
**Why it happens:** Claude Code CLI OTel emissions might not always include a `provider` attribute on `api_request` events.
**How to avoid:** The fix is correct behavior — Claude Code CLI OTel emissions DO include `"provider": "anthropic"` (it is a standard Claude Code telemetry attribute). The `?? "unknown"` only fires when the attribute is genuinely absent. Add a `console.warn` on the fallback path so production logs surface the gap.
**Warning signs:** If `api_request` rows suddenly show `provider: "unknown"` in Convex after the fix, the Claude OTel emitter is not setting the attribute — investigate the Ástríðr OTel configuration, not the CodePulse code.

### Pitfall 2: Convex Schema Index on Optional Field
**What goes wrong:** Querying `by_provider` index with `.eq("provider", "codex")` works correctly, but querying rows where `provider` is undefined requires `.eq("provider", undefined)` which Convex handles differently from a missing index.
**Why it happens:** Optional fields in Convex indexes are supported but querying for absence (undefined) vs. presence requires specific patterns.
**How to avoid:** The `by_provider` index is used for filtering by a known provider value (e.g., "codex"). Queries that want ALL rows regardless of provider should use `by_timestamp` or `by_session` indexes as they do today. The `by_provider` index is additive, not a replacement.
**Warning signs:** TypeScript type errors from Convex code-gen if the index is added but the query validator isn't updated to accept `v.optional(v.string())`.

### Pitfall 3: providerHealth.latest Returns No Gateway Providers
**What goes wrong:** After adding gateway providers to the registry, `providerHealth.latest` returns empty records for all gateway providers because no one has written a `providerHealth` row for `"claude-cli"` yet.
**Why it happens:** The `providerHealth` table is written by Ástríðr's circuit-breaker system. The gateway sidecar has its own health checker (`gateway/gateway/health.py`) but doesn't write to CodePulse's `providerHealth` table.
**How to avoid:** The `ProviderHealthPanel` must handle the "No data" case gracefully (it already does — see the `data ? ... : <p>No data</p>` branch). Phase 66's scope for provider health is: show the providers in the panel with "No data" initially, and add the new schema fields so that WHEN data arrives (Phase 67/68 will wire the polling), it can be displayed. Do not block GW-03 on live data flowing — the panel showing 4 providers (even with "No data") satisfies GW-03.
**Warning signs:** Treating GW-03 as requiring live health data — that's Phase 68. GW-03 requires the panel renders the 4 providers.

### Pitfall 4: CLIGatewayTool session_id Mismatch
**What goes wrong:** The gateway emits OTel events with a `session.id` resource attribute that doesn't match the `sessionId` in Ástríðr's active session, causing gateway task records to appear in CodePulse under an orphaned session.
**Why it happens:** `CLIGatewayTool` is called from within an Ástríðr session, but the gateway's `task_id` is a UUID unrelated to Ástríðr's session ID.
**How to avoid:** The telemetry emission from `CLIGatewayTool` must pass the parent Ástríðr session ID as the `session.id` resource attribute, not the gateway `task_id`. The `task_id` goes into an OTel attribute. The session context is available in Ástríðr's tool execution environment — verify the exact access pattern (see Open Questions).
**Warning signs:** Gateway task records appearing under session ID `"unknown"` or a raw UUID in the Sessions page.

### Pitfall 5: Pre-existing Test Failures
**What goes wrong:** CI appears broken when Phase 66 tests are added.
**Why it happens:** 3 test files are already failing before Phase 66 begins: `CategoryGrid.test.tsx`, `SkillsInCategory.test.tsx`, `Skills.test.tsx` (12 failures total in skills components). These are pre-existing and unrelated to this phase.
**How to avoid:** Note the baseline failure count (12 failures, 56 pass, 17 skip across 76 test files). Wave 0 stubs must not introduce additional failures. Fix pre-existing failures if encountered during work per project policy. [VERIFIED: ran `npx vitest run` in this session]

---

## Code Examples

### Verified: Current OTel Default Locations (to fix)

```typescript
// Source: verified reading convex/otelLogs.ts line 182
case "api_request": {
  const provider = getAttr(attrs, "provider") ?? "anthropic";  // FIX: → "unknown" + warn
  // ...
}

// Source: verified reading convex/otelMetrics.ts lines 170, 188
case "claude_code.cost.usage": {
  const provider = getAttr(attrs, "provider") ?? "anthropic";  // FIX: → "unknown" + warn
  // ...
}
case "claude_code.token.usage": {
  const provider = getAttr(attrs, "provider") ?? "anthropic";  // FIX: → "unknown" + warn
  // ...
}
```

### Verified: Current providerHealth.latest Hardcoded List (to replace)

```typescript
// Source: verified reading convex/providerHealth.ts line 54
const providers = ["anthropic_direct", "openrouter", "ollama"];  // REPLACE with registry import
```

### Verified: Current ProviderHealthPanel Hardcoded List (to replace)

```typescript
// Source: verified reading src/components/ProviderHealthPanel.tsx line 55
const providers = ["anthropic_direct", "openrouter", "ollama"];  // REPLACE with dynamic list
```

### Verified: Gateway Provider Enum (from gateway sidecar models.py)

```python
# Source: verified reading astridr-repo/gateway/gateway/models.py
class Provider(str, Enum):
    AUTO = "auto"
    CLAUDE_CLI = "claude-cli"
    CLAUDE_SDK = "claude-sdk"
    CODEX = "codex"
    ANTIGRAVITY = "antigravity"
```

The CodePulse registry must use these exact string values (`"claude-cli"`, `"codex"`, `"antigravity"`, `"claude-sdk"`) — they come from the gateway's authoritative enum. [VERIFIED]

### Verified: TaskResponse Shape (what CLIGatewayTool has when it completes)

```python
# Source: verified reading astridr-repo/gateway/gateway/models.py
class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus          # "completed" | "failed" | ...
    provider: str               # "claude-cli" | "codex" | "antigravity" | "claude-sdk"
    output: str
    error: str | None
    data: dict[str, Any]
    duration_seconds: float
    events: list[TaskEvent]
```

This is what `data = resp.json()` returns in `_poll_until_complete()` — all fields are available for telemetry emission. [VERIFIED]

### Verified: Test Pattern for Convex Modules

```typescript
// Source: verified reading convex/__tests__/ingestAuth.test.ts
import { describe, it, expect, vi } from "vitest";

describe("module description (requirement-id)", () => {
  it("specific behavior assertion", () => {
    vi.stubEnv("ENV_VAR", "value");
    // test body
    vi.unstubAllEnvs();
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single ClaudeCodeTool (subprocess `claude -p`) | CLIGatewayTool routing to 4 providers | Phase 66 (this phase) | Provider field needed everywhere |
| Static 3-provider list in health panel | Dynamic registry-driven list | Phase 66 | New providers auto-appear |
| `?? "anthropic"` default | `?? "unknown"` with warning | Phase 66 | Stops silent misattribution |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ástríðr has an existing telemetry/OTel client that CLIGatewayTool can call — rather than requiring a fresh httpx POST to `/v1/logs` | Architecture Patterns (Pattern 4), Open Questions | If no client exists, need to add httpx POST in cli_gateway.py directly — small scope addition, not a blocker |
| A2 | The parent Ástríðr session ID is accessible within CLIGatewayTool.execute() context for use as the `session.id` OTel resource attribute | Pitfall 4 | If not available, gateway events land under a synthetic or task-scoped session ID — still functional but less useful for Phase 68 correlation |
| A3 | The gateway sidecar health checker (`health.py`) does NOT write to CodePulse `providerHealth` today, and Phase 66 scope is only showing providers in the panel (not live data) | Pitfall 3 | If health data IS flowing somehow, the panel just works better — no negative impact |

---

## Open Questions

1. **Ástríðr telemetry client pattern**
   - What we know: `cli_gateway.py` uses `httpx.AsyncClient` for gateway communication. Ástríðr has some telemetry mechanism since CodePulse already receives OTel events from it.
   - What's unclear: Is there a `TelemetryClient` or similar class in Ástríðr that `CLIGatewayTool` can import, or must it make a raw `httpx.AsyncClient` POST to `/v1/logs` directly?
   - Recommendation: Before implementing the emission, grep Ástríðr `feature/cli-gateway` for `CODEPULSE_INGEST` or `otel` or `telemetry` to find the existing pattern. Match it exactly.

2. **Session ID availability in CLIGatewayTool**
   - What we know: Ástríðr's session system assigns session IDs. `BaseTool.execute()` signature is `async def execute(self, **kwargs)`.
   - What's unclear: Is a session context object injected into tool execution, or is the session ID passed in kwargs, or must it be read from elsewhere?
   - Recommendation: Check `BaseTool` definition and how existing tools access session context before implementing emission.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex dev backend | Schema migration testing | Assumed available (project infra) | Existing | — |
| Node.js / npm | `npx vitest run` | Available | Verified via test run | — |
| Python / astridr-repo | CLIGatewayTool changes | Available | Python 3.x (astridr-repo) | — |
| `feature/cli-gateway` branch | CLIGatewayTool source | Available | HEAD `9f8d95a2` | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vite.config.ts` (vitest block) |
| Quick run command | `npx vitest run convex/__tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GW-01 | OTel `api_request` without provider attr uses `"unknown"` not `"anthropic"` | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ Wave 0 |
| GW-01 | `toolExecutions.insert` accepts optional `provider` field | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ❌ Wave 0 |
| GW-02 | `gateway.task_completed` event routes to `toolExecutions`, not `events` | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ Wave 0 |
| GW-02 | `gateway.task_failed` event routes to `toolExecutions` with success=false | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ Wave 0 |
| GW-03 | `providerHealth.latest` returns records for all 4 gateway providers | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ❌ Wave 0 |
| GW-04 | Existing `tool_result` and `api_request` routes continue routing correctly | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/__tests__/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (minus the 12 pre-existing skills failures) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `convex/__tests__/otelLogs.test.ts` — covers GW-01 default fix, GW-02 gateway routing, GW-04 regression
- [ ] `convex/__tests__/providerRegistry.test.ts` — covers provider registry shape, GW-01 provider field on toolExecutions, GW-03 dynamic query

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | Existing `validateIngestAuth()` on all ingest endpoints; gateway event attributes validated via `getAttr()` null-safe helpers |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fake `provider` field injection (attacker sets `provider: "anthropic"` in spoofed OTel event) | Spoofing | Existing `validateIngestAuth()` Bearer token on `/v1/logs` — only Ástríðr can post |
| Gateway event routing to wrong table (data confusion) | Tampering | Strict `switch` cases; unrecognized gateway events fall to `events.ingest` with `otel_log:` prefix |

---

## Sources

### Primary (HIGH confidence)

- `convex/otelLogs.ts` — read directly, verified all 3 `?? "anthropic"` locations
- `convex/otelMetrics.ts` — read directly, verified 2 locations
- `convex/schema.ts` — read directly, verified `sessions` (line 39), `toolExecutions` (line 539), `providerHealth` (line 759) table definitions
- `convex/providerHealth.ts` — read directly, verified hardcoded provider list at line 54
- `src/components/ProviderHealthPanel.tsx` — read directly, verified hardcoded list at line 55
- `convex/toolExecutions.ts` — read directly, verified insert mutation signature
- `convex/sessions.ts` — read directly, verified upsert mutation signature
- `convex/http.ts` — read directly, verified existing routes (no `/gateway` route exists)
- `convex/ingest.ts` — read directly, verified routing logic
- `astridr-repo/astridr/tools/cli_gateway.py` — read directly, verified no telemetry emission today
- `astridr-repo/gateway/gateway/models.py` — read directly, verified Provider enum and TaskResponse shape
- `astridr-repo/gateway/gateway/app.py` — read directly, verified REST endpoints
- `convex/__tests__/ingestAuth.test.ts` — read directly, verified test pattern

### Secondary (MEDIUM confidence)

- Vitest baseline run: 12 pre-existing failures (3 test files, skills components), 56 pass, 17 skip — verified by running `npx vitest run` in this session

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies, all existing
- Architecture: HIGH — verified from source files in both repos
- Schema changes: HIGH — verified exact current schema, additions are additive/optional
- Gateway data contracts: HIGH — read from gateway models.py directly
- CLIGatewayTool emission pattern: MEDIUM — no existing telemetry client pattern confirmed (A1 assumption)
- Pitfalls: HIGH — derived from reading actual code paths

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable codebase — longer window appropriate)
