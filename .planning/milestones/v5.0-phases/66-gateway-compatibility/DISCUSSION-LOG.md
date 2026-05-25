# Phase 66 Discussion Log — Gateway Compatibility Layer

## Context Gathering Method
Deep-dive multi-agent analysis (2026-05-21) with three parallel research agents:
1. **CodePulse telemetry audit** — Full codebase scan of provider assumptions, hardcoded names, telemetry pipeline, dashboard components
2. **Gateway data contract audit** — Mapped all gateway models, events, endpoints vs Ástríðr's current telemetry emission
3. **Codex second opinion** — Independent cross-codebase review for breaking changes, missing telemetry, schema mismatches

## Key Decisions

### Provider Name Strategy
**Decision**: Central provider registry in `convex/lib/providers.ts` replacing all hardcoded arrays.
**Why**: 12 separate hardcoded provider lists found across the codebase (providerHealth.ts, ProviderHealthPanel.tsx, LLMProviderConfig.tsx, briefings.ts, otelLogs.ts, otelMetrics.ts, modelPricing.ts, providerLocations.ts, TokenWaterfall.tsx, AgentProfileEditor.tsx, ingest.ts, seedTeams.ts). Adding providers requires touching all 12. Registry pattern = single source of truth.

### OTel Default Provider
**Decision**: Change `?? "anthropic"` to `?? "unknown"` with warning log.
**Why**: Silent misattribution is worse than visible unknown data. Operators can investigate "unknown" events; they can't detect phantom Anthropic usage.

### Event Translation Layer
**Decision**: Ástríðr's CLIGatewayTool emits CodePulse-compatible events (option 1 from analysis).
**Why**: Simpler, keeps CodePulse's ingest pipeline stable. Translation happens at the source (gateway tool) rather than requiring CodePulse to understand raw gateway events. CodePulse adds routing for new event names but doesn't need to parse TaskEvent format.

### Cross-Repo Scope
**Decision**: Phase touches both CodePulse and Ástríðr repos.
**Why**: The translation layer lives in Ástríðr's CLIGatewayTool. Schema and routing changes live in CodePulse. Both must ship together.

### Backward Compatibility
**Decision**: All new fields are `v.optional()`. Existing Claude-only telemetry paths unchanged.
**Why**: Can't break running system. Old events continue flowing; new events add provider dimension.

## Gray Areas Resolved

| Area | Resolution |
|------|-----------|
| Where does event translation happen? | Ástríðr-side (CLIGatewayTool), not CodePulse ingest |
| Dynamic vs hardcoded provider lists? | Dynamic (central registry) |
| What happens to unattributed events? | Labeled "unknown" with warning, not silently "anthropic" |
| Hook system for non-Claude providers? | Not needed — gateway events flow via telemetry API, not hooks |
| New tables in this phase? | No — table creation deferred to Phase 68. This phase adds fields to existing tables only. |

## Files Identified for Modification

### CodePulse (`C:\Users\mandr\codepulse`)
- `convex/schema.ts` — Add provider fields to sessions, toolExecutions; extend providerHealth
- `convex/otelLogs.ts` — Fix default, add gateway event routing
- `convex/otelMetrics.ts` — Fix default
- `convex/providerHealth.ts` — Dynamic provider query
- `convex/runtimeIngest.ts` — Gateway event routing
- New: `convex/lib/providers.ts` — Provider registry
- `src/components/ProviderHealthPanel.tsx` — Dynamic provider list, auth/billing badges

### Ástríðr (`C:\Users\mandr\astridr-repo`)
- `astridr/tools/cli_gateway.py` — Emit CodePulse-compatible telemetry events
- `astridr/engine/telemetry.py` — Verify event format supports provider field
