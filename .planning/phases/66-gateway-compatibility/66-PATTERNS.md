# Phase 66: Gateway Compatibility Layer - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 9 (7 CodePulse, 1 Ástríðr, 1 new Convex lib module)
**Analogs found:** 8 / 9 (`convex/lib/providers.ts` is genuinely new — no analog exists)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/otelLogs.ts` | middleware/router | event-driven | self (existing switch) | exact — extend in-place |
| `convex/otelMetrics.ts` | middleware/router | event-driven | self (existing switch) | exact — fix in-place |
| `convex/schema.ts` | model/config | CRUD | self (existing table defs) | exact — additive fields |
| `convex/lib/providers.ts` | utility/config | N/A (constant module) | none | no analog |
| `convex/providerHealth.ts` | service/query | CRUD | self + `convex/sessions.ts` | exact |
| `convex/toolExecutions.ts` | service/mutation | CRUD | self (existing mutation) | exact — add optional arg |
| `convex/sessions.ts` | service/mutation | CRUD | self (existing upsert) | exact — add optional arg |
| `src/components/ProviderHealthPanel.tsx` | component | request-response | self (existing component) | exact — dynamic list |
| `src/hooks/useProviderHealth.ts` | hook | request-response | self (existing hook) | exact — no change needed |
| `astridr-repo: astridr/tools/cli_gateway.py` | tool/service | request-response | `astridr/tools/schedule_wakeup.py` | role-match |

---

## Pattern Assignments

### `convex/otelLogs.ts` — Fix default + add gateway cases

**Analog:** self (`convex/otelLogs.ts`)

**Imports pattern** (lines 1-3, unchanged):
```typescript
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { corsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";
```

**Helper functions already present** (lines 6-51): `getAttr`, `getNumAttr`, `nanoToSec`, `attrsToObj` — use these exactly, do not re-implement.

**Fix 1 — OTel default** (line 182):
```typescript
// BEFORE:
const provider = getAttr(attrs, "provider") ?? "anthropic";

// AFTER (GW-01):
const provider = getAttr(attrs, "provider") ?? "unknown";
if (!getAttr(attrs, "provider")) {
  console.warn("otelLogs: api_request missing provider attribute — defaulting to unknown", { sessionId });
}
```

**Core pattern — existing switch case for reference** (lines 164-178, `tool_result` case):
```typescript
case "tool_result": {
  const toolName = getAttr(attrs, "tool_name") ?? "unknown";
  const success = getAttr(attrs, "success") !== "false";
  const durationMs = getNumAttr(attrs, "duration_ms");
  const errorMessage = getAttr(attrs, "error");
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId,
    toolName,
    success,
    durationMs,
    errorMessage,
    timestamp,
  });
  break;
}
```

**New gateway cases to add** — insert BEFORE the `default:` case (after `tool_decision` case, line ~230):
```typescript
case "gateway.task_completed": {
  const provider = getAttr(attrs, "provider") ?? "unknown";
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId,
    toolName: `gateway:${provider}`,
    provider,
    success: true,
    durationMs: getNumAttr(attrs, "duration_ms"),
    timestamp,
  });
  await ctx.runMutation(api.sessions.upsert, {
    sessionId,
    provider,
  });
  break;
}

case "gateway.task_failed": {
  const provider = getAttr(attrs, "provider") ?? "unknown";
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId,
    toolName: `gateway:${provider}`,
    provider,
    success: false,
    errorMessage: getAttr(attrs, "error") ?? "Task failed",
    timestamp,
  });
  break;
}

case "gateway.task_started": {
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
  // Falls to generic events table — Phase 68 adds routingDecisions table
  await ctx.runMutation(api.events.ingest, {
    sessionId,
    eventType: "gateway.routing_decision",
    payload: attrsToObj(attrs),
    timestamp,
  });
  break;
}
```

**Note on normalization:** Gateway event names use `"gateway."` namespace, NOT `"claude_code."`. The normalize strip at line 148 only strips `"claude_code."` prefix — gateway events pass through unchanged. No changes needed to the normalization logic.

**Default case pattern** (lines 233-240, unchanged):
```typescript
default: {
  await ctx.runMutation(api.events.ingest, {
    sessionId,
    eventType: `otel_log:${eventName}`,
    payload: attrsToObj(attrs),
    timestamp,
  });
  break;
}
```

---

### `convex/otelMetrics.ts` — Fix 2 provider defaults

**Analog:** self (`convex/otelMetrics.ts`)

**Fix 1 — cost default** (line 170):
```typescript
// BEFORE:
const provider = getAttr(attrs, "provider") ?? "anthropic";

// AFTER:
const provider = getAttr(attrs, "provider") ?? "unknown";
if (!getAttr(attrs, "provider")) {
  console.warn("otelMetrics: claude_code.cost.usage missing provider attribute", { sessionId });
}
```

**Fix 2 — token default** (line 188):
```typescript
// BEFORE:
const provider = getAttr(attrs, "provider") ?? "anthropic";

// AFTER:
const provider = getAttr(attrs, "provider") ?? "unknown";
if (!getAttr(attrs, "provider")) {
  console.warn("otelMetrics: claude_code.token.usage missing provider attribute", { sessionId });
}
```

No other changes to `otelMetrics.ts`.

---

### `convex/schema.ts` — Add provider fields

**Analog:** self (existing optional field patterns throughout `schema.ts`)

**Pattern for optional field with index** (existing example — `model` on `sessions`, lines 46-49):
```typescript
sessions: defineTable({
  sessionId: v.string(),
  startedAt: v.float64(),
  lastEventAt: v.float64(),
  status: v.string(),
  cwd: v.optional(v.string()),
  model: v.optional(v.string()),     // ← this is the pattern to copy
  eventCount: v.float64(),
})
  .index("by_sessionId", ["sessionId"])
  .index("by_status", ["status", "lastEventAt"])
  // add: .index("by_provider", ["provider"])
```

**sessions table change** (after line 46, before closing brace):
```typescript
// Add field after model:
provider: v.optional(v.string()),

// Add index after by_status:
.index("by_provider", ["provider"])
```

**toolExecutions table change** (after line 548, current end of field list):
```typescript
// Current table ends at line 552 with .index("by_timestamp", ["timestamp"])
// Add field (between archived and timestamp, or after archived):
provider: v.optional(v.string()),

// Add index after by_timestamp:
.index("by_provider", ["provider"])
```

**providerHealth table change** (lines 759-769, add optional fields):
```typescript
providerHealth: defineTable({
  providerName: v.string(),
  state: v.string(),
  latencyEmaMs: v.float64(),
  successRate: v.float64(),
  consecutiveFailures: v.float64(),
  lastSuccessAt: v.float64(),
  timestamp: v.float64(),
  // NEW — add these three:
  authenticated: v.optional(v.boolean()),
  billingType: v.optional(v.string()),
  quotaRemaining: v.optional(v.float64()),
})
  .index("by_provider", ["providerName"])  // existing
  .index("by_timestamp", ["timestamp"])    // existing
```

---

### `convex/lib/providers.ts` — NEW: Central provider registry

**Analog:** None. This directory (`convex/lib/`) does not yet exist.

**Pattern to follow:** TypeScript const-assertion module pattern. No imports needed — pure constants and type exports.

**Full file to create:**
```typescript
/**
 * Central provider registry for CodePulse.
 *
 * Single source of truth for all known provider names.
 * Any file that needs a provider list must import from here —
 * never hardcode provider arrays elsewhere.
 */

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

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];
export type LegacyProvider = (typeof LEGACY_PROVIDERS)[number];
export type AnyProvider = (typeof ALL_PROVIDERS)[number];
```

**Provider string values are authoritative from the gateway sidecar** (`astridr-repo/gateway/gateway/models.py` `Provider` enum): `"claude-cli"`, `"codex"`, `"antigravity"`, `"claude-sdk"`. Do not normalize or rename these.

---

### `convex/providerHealth.ts` — Dynamic provider list

**Analog:** self (existing `latest` query at lines 51-70)

**Imports pattern** (lines 1-2, add lib import):
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ALL_PROVIDERS } from "./lib/providers";  // NEW
```

**Current hardcoded list** (line 54):
```typescript
const providers = ["anthropic_direct", "openrouter", "ollama"];  // REPLACE
```

**Replacement pattern** (copy the loop structure exactly, just replace the list):
```typescript
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const providers = ALL_PROVIDERS;  // replaces hardcoded array
    const results: Record<string, any> = {};

    for (const p of providers) {
      const record = await ctx.db
        .query("providerHealth")
        .withIndex("by_provider", (q) => q.eq("providerName", p))
        .order("desc")
        .first();
      if (record) {
        results[p] = record;
      }
    }

    return results;
  },
});
```

**upsert mutation** (lines 4-34) — extend args to accept new optional fields after schema migration:
```typescript
export const upsert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // patch existing or insert — same logic as current lines 14-33
  },
});
```

---

### `convex/toolExecutions.ts` — Add optional provider arg

**Analog:** self (existing `insert` mutation, lines 4-18)

**Current insert mutation** (lines 4-18):
```typescript
export const insert = mutation({
  args: {
    sessionId: v.string(),
    toolName: v.string(),
    durationMs: v.optional(v.float64()),
    success: v.boolean(),
    decision: v.optional(v.string()),
    decisionSource: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolExecutions", args);
  },
});
```

**Change:** Add one optional arg — all existing callers continue to work unchanged:
```typescript
// Add after errorMessage:
provider: v.optional(v.string()),
```

No change to the handler body — `ctx.db.insert("toolExecutions", args)` passes through all args including the new optional field.

---

### `convex/sessions.ts` — Add optional provider arg

**Analog:** self (existing `upsert` mutation, lines 5-38)

**Current upsert args** (lines 6-10):
```typescript
args: {
  sessionId: v.string(),
  cwd: v.optional(v.string()),
  model: v.optional(v.string()),
},
```

**Change:** Add one optional arg:
```typescript
args: {
  sessionId: v.string(),
  cwd: v.optional(v.string()),
  model: v.optional(v.string()),
  provider: v.optional(v.string()),  // NEW
},
```

**Handler patch** (lines 19-24) — add provider to the conditional patch block, following the existing `cwd`/`model` pattern:
```typescript
// Current pattern for optional fields in patch:
...(args.cwd !== undefined ? { cwd: args.cwd } : {}),
...(args.model !== undefined ? { model: args.model } : {}),

// Add:
...(args.provider !== undefined ? { provider: args.provider } : {}),
```

**Handler insert block** (lines 27-36) — add provider to the new session creation:
```typescript
await ctx.db.insert("sessions", {
  sessionId: args.sessionId,
  startedAt: now,
  lastEventAt: now,
  status: "active",
  cwd: args.cwd,
  model: args.model,
  provider: args.provider,  // NEW
  eventCount: 1,
});
```

---

### `src/components/ProviderHealthPanel.tsx` — Dynamic provider list

**Analog:** self (existing component, lines 53-72)

**Imports pattern** (lines 1-6, add registry import):
```typescript
import { memo } from "react";
import { useProviderHealth } from "../hooks/useProviderHealth";
import Sparkline from "./Sparkline";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
// Note: ALL_PROVIDERS is a Convex backend module — cannot be imported directly in frontend.
// The provider list must come from the query result or be duplicated in a src/lib/ constant.
```

**Critical note on cross-boundary import:** `convex/lib/providers.ts` is a Convex backend module. React components cannot import from `convex/` directly (Convex codegen boundary). Two options:
1. Duplicate the constant in `src/lib/providers.ts` and import from there (preferred — keeps frontend/backend in sync via copy-paste contract)
2. Return `ALL_PROVIDERS` from the `providerHealth.latest` query alongside the health data, then read it in the component

**Recommended approach** — frontend mirror constant in `src/lib/providers.ts`:
```typescript
// src/lib/providers.ts (NEW — mirror of convex/lib/providers.ts)
export const GATEWAY_PROVIDERS = ["claude-cli", "codex", "antigravity", "claude-sdk"] as const;
export const LEGACY_PROVIDERS = ["anthropic_direct", "openrouter", "ollama"] as const;
export const ALL_PROVIDERS = [...LEGACY_PROVIDERS, ...GATEWAY_PROVIDERS] as const;
```

**Current hardcoded list** (line 55):
```typescript
const providers = ["anthropic_direct", "openrouter", "ollama"];  // REPLACE
```

**Replacement in ProviderHealthPanelInner**:
```typescript
import { ALL_PROVIDERS } from "../lib/providers";

function ProviderHealthPanelInner() {
  const healthData = useProviderHealth();
  // providers now comes from registry instead of hardcoded array
  const providers = ALL_PROVIDERS;
  // ...rest unchanged
```

**Grid column count** (line 62) — currently `sm:grid-cols-3` for 3 providers. With 7 providers, change to `sm:grid-cols-3 lg:grid-cols-4` or similar to accommodate expansion.

**ProviderCard extension** — add new fields to the card body (lines 33-50), following existing data display pattern:
```typescript
{data ? (
  <div className="space-y-1.5">
    <div className="text-xs text-gray-400">{state?.label}</div>
    <div className="text-xs text-gray-400">{Math.round(data.successRate)}% success</div>
    <div className="text-xs text-gray-400">{(data.latencyEmaMs / 1000).toFixed(1)}s latency</div>
    {/* NEW fields — only render if present (optional schema fields) */}
    {data.authenticated !== undefined && (
      <div className="text-xs text-gray-400">
        {data.authenticated ? "authenticated" : "not authenticated"}
      </div>
    )}
    {data.billingType !== undefined && (
      <div className="text-xs text-gray-400">{data.billingType}</div>
    )}
    {data.quotaRemaining !== undefined && (
      <div className="text-xs text-gray-400">
        {Math.round(data.quotaRemaining * 100)}% quota
      </div>
    )}
    {latencyData.length >= 2 && <Sparkline data={latencyData} width={100} height={20} />}
  </div>
) : (
  <p className="text-xs text-gray-600">No data</p>
)}
```

---

### `src/hooks/useProviderHealth.ts` — No changes required

**Analog:** self (current file, lines 1-6)

The hook wraps `api.providerHealth.latest` with `useThrottledQuery`. The query already returns `Record<string, any>` — adding new providers to the query result is transparent. **No changes needed to this file.**

```typescript
// Current implementation is correct as-is:
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useProviderHealth() {
  return useThrottledQuery(api.providerHealth.latest, {}, 5000) ?? {};
}
```

---

### `astridr-repo: astridr/tools/cli_gateway.py` — Emit telemetry after task completion

**Analog:** `astridr/tools/schedule_wakeup.py` (lines 146-159)

**Telemetry client access pattern** (from `schedule_wakeup.py` lines 147-159):
```python
# Local import avoids circular dependency — use this pattern exactly:
from astridr.engine.telemetry import get_telemetry  # local import avoids circular
t = get_telemetry()
if t:
    await t.send(
        "event_type",
        {
            "key": value,
        },
    )
```

**Session context access pattern** — `cli_gateway.py` does not receive a session ID in kwargs. Use `get_session_context()` to read it from the context var set by the agent loop:
```python
from astridr.engine.telemetry import get_telemetry, get_session_context
```

**Emission point:** In `_poll_until_complete()`, BEFORE the `return ToolResult(...)` statements in the completed and failed branches (lines 171-182).

**completed branch emission** (insert before line 172 `return ToolResult(...)`):
```python
if status == "completed":
    # Emit CodePulse telemetry — fire-and-forget
    _t = get_telemetry()
    if _t:
        session_id = get_session_context()
        await _t.send_to(
            "v1/logs",
            "gateway.task_completed",
            {
                "session.id": session_id or task_id,
                "event.name": "gateway.task_completed",
                "provider": data.get("provider", "unknown"),
                "task_id": task_id,
                "duration_ms": data.get("duration_seconds", 0) * 1000,
            },
        )
    return ToolResult(
        success=True,
        output=data.get("output", ""),
        data={"task_id": task_id, "provider": data.get("provider", ""), **data},
    )
```

**failed branch emission** (insert before line 179 `return ToolResult(...)` in the failed branch):
```python
elif status in ("failed", "cancelled", "timed_out"):
    _t = get_telemetry()
    if _t:
        session_id = get_session_context()
        await _t.send_to(
            "v1/logs",
            "gateway.task_failed",
            {
                "session.id": session_id or task_id,
                "event.name": "gateway.task_failed",
                "provider": data.get("provider", "unknown"),
                "task_id": task_id,
                "error": data.get("error", f"Task {status}"),
            },
        )
    return ToolResult(
        success=False,
        output=data.get("output", ""),
        error=data.get("error", f"Task {status}"),
        data={"task_id": task_id, **data},
    )
```

**Note on `send_to` OTel format:** `send_to("v1/logs", ...)` posts to CodePulse's `/v1/logs` OTel endpoint. The `ConvexHandler.send_to()` method (telemetry.py lines 285-313) wraps the data as `{"type": event_type, **data}`. However, `otelLogsIngest` expects OTLP JSON format with `resourceLogs[].scopeLogs[].logRecords[]`. This is a format mismatch — `send_to` targets `/runtime-ingest` format, not OTel format.

**Corrected approach:** Use `t.send("gateway.task_completed", {...})` (the regular batch send to `/runtime-ingest`) and route it through `runtimeIngest.ts` instead, OR make a raw httpx POST to `/v1/logs` with proper OTLP JSON wrapper. Check `runtimeIngest.ts` to confirm which approach handles gateway events — this is the key implementation decision for the planner.

---

## Shared Patterns

### Auth on Convex HTTP Actions
**Source:** `convex/ingestAuth.ts` (imported in all OTel handlers)
**Apply to:** `otelLogs.ts`, `otelMetrics.ts` (already present — preserve unchanged)
```typescript
// Pattern: check at top of httpAction handler, before any processing
if (!validateIngestAuth(request)) {
  return unauthorizedResponse();
}
```

### Convex Mutation — Optional Arg Pattern
**Source:** `convex/sessions.ts` lines 8-9, 22-24
**Apply to:** `toolExecutions.ts` insert, `sessions.ts` upsert, `providerHealth.ts` upsert
```typescript
// All new fields are optional — existing callers pass nothing, new callers pass value
provider: v.optional(v.string()),

// In patch: spread only if defined
...(args.provider !== undefined ? { provider: args.provider } : {}),
```

### Convex Query — Index with Optional Field
**Source:** `convex/providerHealth.ts` lines 56-64 (`by_provider` index on string field)
**Apply to:** `sessions.ts` `by_provider` index, `toolExecutions.ts` `by_provider` index
```typescript
// Index usage pattern — only use for filtering by known value, not absence
.withIndex("by_provider", (q) => q.eq("providerName", p))
.order("desc")
.first();
```

### Ástríðr Tool Telemetry Emission
**Source:** `astridr-repo/astridr/tools/schedule_wakeup.py` lines 147-159
**Apply to:** `astridr/tools/cli_gateway.py`
```python
# Pattern: local import + guard + fire-and-forget
from astridr.engine.telemetry import get_telemetry, get_session_context
t = get_telemetry()
if t:
    await t.send("event_type", {"key": value})
```

### React Component — Conditional Field Rendering
**Source:** `src/components/ProviderHealthPanel.tsx` lines 33-50 (existing `data ? ... : <p>No data</p>` pattern)
**Apply to:** ProviderCard new fields
```tsx
// Pattern: render optional fields only if present
{data.fieldName !== undefined && (
  <div className="text-xs text-gray-400">{data.fieldName}</div>
)}
```

### Vitest Unit Test Structure
**Source:** `convex/__tests__/ingestAuth.test.ts` lines 1-62
**Apply to:** `convex/__tests__/otelLogs.test.ts`, `convex/__tests__/providerRegistry.test.ts`
```typescript
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

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `convex/lib/providers.ts` | utility/config | N/A | Pure constant module. `convex/lib/` directory does not yet exist. No existing TypeScript constant module in the project to copy from — use the pattern from `66-RESEARCH.md` Pattern 2 directly. |

---

## Open Question for Planner

**CLIGatewayTool emission endpoint mismatch** (from Research open question A1):

The `ConvexHandler.send_to()` method posts to Convex HTTP endpoints in `/runtime-ingest` batch format (`{"type": event_type, **data}`). The OTel gateway cases in `otelLogs.ts` expect OTLP JSON format (`resourceLogs[].scopeLogs[].logRecords[]`). These formats are incompatible.

Before implementing the emission, the planner must check `convex/runtimeIngest.ts` to determine if a `gateway.task_completed` event type is handled there. If yes, use `t.send("gateway.task_completed", {...})` targeting `/runtime-ingest`. If no, either:
- Add `gateway.*` cases to `runtimeIngest.ts` (simpler — same format as existing runtime events), OR
- Make a raw `httpx.AsyncClient` POST to `/v1/logs` with OTLP JSON wrapper

Recommendation: add gateway cases to `runtimeIngest.ts` dispatch and use `t.send()` — avoids raw HTTP and matches all other tool telemetry patterns.

---

## Metadata

**Analog search scope:**
- `C:\Users\mandr\codepulse\convex\` — all modules read
- `C:\Users\mandr\codepulse\src\components\`, `src/hooks/`
- `C:\Users\mandr\astridr-repo\astridr\engine\telemetry.py`
- `C:\Users\mandr\astridr-repo\astridr\tools\` — pattern analogs for tool telemetry

**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-21
