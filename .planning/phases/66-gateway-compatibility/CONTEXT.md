# Phase 66: Gateway Compatibility Layer

## Goal
CodePulse correctly ingests, routes, and attributes telemetry events from the multi-provider CLI Gateway without data loss or misattribution.

## Priority
**P0 — breaks on merge.** Without this phase, merging the CLI Gateway into Ástríðr causes: (1) all non-Claude provider events silently attributed to Anthropic, (2) gateway events dumped into generic `events` table instead of proper tables, (3) provider health panel shows nothing for new providers.

## Dependencies
- Phase 59 (Schema Foundation) — complete
- Ástríðr CLI Gateway (PR #4, `feature/cli-gateway` branch) — ready to merge

## Background

Ástríðr's new CLI Gateway sidecar replaces the single `ClaudeCodeTool` (subprocess `claude -p`) with a multi-provider architecture. Four providers:

| Provider | Billing | Gateway Name |
|----------|---------|-------------|
| Claude CLI | Max subscription | `claude-cli` |
| Codex CLI | ChatGPT subscription | `codex` |
| Antigravity CLI | Google AI Pro subscription | `antigravity` |
| Claude SDK | API-billed, $5/day cap | `claude-sdk` |

The gateway produces `TaskEvent` objects with `{task_id, event_type, provider, data}` and exposes REST endpoints for health, quota, and task lifecycle.

## Breaking Changes to Fix

### 1. OTel Provider Default Fallback
**Files**: `convex/otelLogs.ts:182`, `convex/otelMetrics.ts:170,188`
**Problem**: `getAttr(attrs, "provider") ?? "anthropic"` silently attributes all untagged events to Anthropic.
**Fix**: Change default to `"unknown"` and add structured warning log.

### 2. Event Schema Mismatch
**Problem**: Gateway emits `{task_id, event_type, provider, data}`. CodePulse ingest expects `{sessionId, eventType, toolName, payload, hookType}`. Gateway events won't route to correct tables.
**Fix**: Add gateway event routing in OTel logs handler. New event names: `gateway.task_started`, `gateway.task_completed`, `gateway.task_failed`, `gateway.routing_decision`.

### 3. Gateway Event Translation (Ástríðr-side)
**File**: `astridr-repo: astridr/tools/cli_gateway.py`
**Problem**: CLIGatewayTool returns rich data in `ToolResult.data` but doesn't emit CodePulse-compatible telemetry events.
**Fix**: After task completion, emit telemetry event with `provider`, `model`, `duration_seconds`, `cost_usd`, `task_id` mapped to CodePulse field names.

### 4. Missing Provider Field on Tables
**Files**: `convex/schema.ts` — `sessions` (line 39), `toolExecutions` (line 539)
**Problem**: No `provider` field. Can't tell which provider handled a session or tool call.
**Fix**: Add `provider: v.optional(v.string())` with `by_provider` indexes.

### 5. Hardcoded Provider Lists
**Files**: `convex/providerHealth.ts:54`, `src/components/ProviderHealthPanel.tsx:55`
**Problem**: `["anthropic_direct", "openrouter", "ollama"]` hardcoded. New gateway providers invisible.
**Fix**: Central provider registry (`convex/lib/providers.ts`). Dynamic queries instead of hardcoded arrays.

### 6. ProviderHealth Schema Gaps
**File**: `convex/schema.ts:759`
**Problem**: Only stores circuit-breaker state. Missing auth status, billing type, quota remaining.
**Fix**: Add `authenticated`, `billingType`, `quotaRemaining` optional fields.

## Hook System Note
The existing `codepulse-hook.mjs` only captures Claude Code CLI events (normalizes `session_id`, `hook_event_name`). Tasks routed through Codex/Antigravity CLI won't fire hooks. This is by design — gateway events flow through the telemetry API, not hooks. Document this in `hooks/README.md`.

## Cross-Repo Work
This phase touches both repos:
- **CodePulse** (`C:\Users\mandr\codepulse`): Schema, ingest routing, provider registry, UI
- **Ástríðr** (`C:\Users\mandr\astridr-repo`): Telemetry emission from CLIGatewayTool

## Gateway Data Contracts

### TaskEvent (from gateway)
```python
{
    "task_id": str,          # UUID
    "timestamp": datetime,
    "event_type": str,       # "started", "progress", "completed", "error"
    "provider": str,         # "claude-cli", "codex", "antigravity", "claude-sdk"
    "data": dict             # Context-specific payload
}
```

### GET /health → GatewayHealth
```json
{
    "healthy": true,
    "providers": [
        {
            "name": "claude-cli",
            "available": true,
            "authenticated": true,
            "billing_type": "subscription",
            "quota_remaining": 0.995,
            "last_success": null,
            "last_error": null
        }
    ],
    "active_tasks": 0
}
```

### GET /quota → list[QuotaStatus]
```json
[
    {
        "provider": "claude-cli",
        "billing_type": "subscription",
        "used_today": 1,
        "daily_limit": 200,
        "spend_usd": 0.0,
        "spend_cap_usd": null,
        "remaining_pct": 0.995
    }
]
```

## Success Criteria
1. A Codex CLI task routed through the gateway appears in CodePulse with `provider: "codex"`, not `provider: "anthropic"`
2. Gateway task events route to `toolExecutions` and new gateway tables (not generic `events` table)
3. Provider health panel shows all 4 gateway providers with availability and auth status
4. Existing Claude-only telemetry continues working unchanged
