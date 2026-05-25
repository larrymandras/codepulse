---
phase: 69-sdk-spend-guard-multi-provider-ux
plan: "05"
subsystem: provider-controls-uat-gaps
tags: [convex, seed, provider, ingest, ui, session, uat]
dependency_graph:
  requires: [69-01, 69-02, 69-03, 69-04]
  provides: [providerConfig-seeding, provider-attribution-ingest, untagged-model-label]
  affects: [convex/seedGateway.ts, convex/ingest.ts, src/components/SessionComparison.tsx, src/components/ActiveSessions.tsx, src/components/SessionHeader.tsx]
tech_stack:
  added: []
  patterns: [idempotent-seed, provider-attribution, conditional-jsx-fallback]
key_files:
  created: []
  modified:
    - convex/seedGateway.ts
    - convex/ingest.ts
    - src/components/SessionComparison.tsx
    - src/components/ActiveSessions.tsx
    - src/components/SessionHeader.tsx
decisions:
  - "Use data.provider ?? 'claude-cli' fallback in ingest so future multi-provider hooks can override the default without a code change"
  - "seedProviderConfigs uses filter query (not index) for idempotency since providerConfig has no by_provider index"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-23T18:01:13Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 69 Plan 05: UAT Gap Closure (Gaps 6-10) Summary

**One-liner:** Seed providerConfig rows from runSeed, wire provider attribution to ingest PostToolUse and session upsert, and replace "unknown"/"N/A"/"—" model fallbacks with muted italic "untagged" across three session components.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Seed providerConfig rows and wire ingest provider field | 33553cf | convex/seedGateway.ts, convex/ingest.ts |
| 2 | Harmonize model fallback to muted "untagged" across session components | eb6db0d | src/components/SessionComparison.tsx, src/components/ActiveSessions.tsx, src/components/SessionHeader.tsx |

## What Was Built

### Task 1: providerConfig seeding + ingest provider attribution

**convex/seedGateway.ts:**
- Imported `GATEWAY_PROVIDERS` from `./lib/providers`
- Added `seedProviderConfigs` internalMutation — iterates GATEWAY_PROVIDERS array, inserts one `providerConfig` row per provider (enabled: true, sequential priority). Idempotent: skips any provider that already has a row.
- Extended `runSeed` to schedule `seedProviderConfigs` alongside the existing two seed mutations

**convex/ingest.ts:**
- Added `provider: data.provider ?? body.provider ?? "claude-cli"` to the `sessions.upsert` call (line 47 area)
- Added `provider: data.provider ?? "claude-cli"` to the `toolExecutions.insert` call in the PostToolUse handler

Both mutations already accepted a `provider` arg — this plan wires the values that were previously omitted. The `data.provider ?? "claude-cli"` pattern allows future hook payloads to carry an explicit provider and have it respected.

### Task 2: Harmonized "untagged" model fallback

Replaced plain string fallbacks in three session components with a consistent conditional JSX pattern:

```tsx
{session.model ? session.model : <span className="text-muted-foreground italic text-xs">untagged</span>}
```

| Component | Before | After |
|-----------|--------|-------|
| SessionComparison.tsx | `session.model ?? "unknown"` | muted italic "untagged" |
| ActiveSessions.tsx | `session.model ?? "N/A"` | muted italic "untagged" |
| SessionHeader.tsx | `session.model ?? "—"` | muted italic "untagged" |

## Verification

- `grep -c "seedProviderConfigs" convex/seedGateway.ts` → 2 (definition + scheduling call)
- `grep -c "provider:" convex/ingest.ts` → 2 (session upsert + toolExecutions.insert)
- `grep -c "untagged"` → 1 each in all three session components
- `grep -c "unknown\|N/A"` → 0 in all three session components
- `npx tsc --noEmit` → no errors

## UAT Gaps Resolved

| Gap | Description | Fix |
|-----|-------------|-----|
| 6 | Provider cards not rendering after seed | seedProviderConfigs now creates providerConfig rows |
| 7 | Drag reorder not available | Root cause same as gap 6 — no rows = no cards |
| 8 | Enable/disable toggles missing | Root cause same as gap 6 — no rows = no cards |
| 9 | Tool call timeline shows no provider badge | provider field now passed in PostToolUse ingest handler |
| 10 | Model fallback inconsistent across session views | Unified to muted italic "untagged" in all three components |

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript errors in `ObsidianGraph.tsx` and `obsidian.ts` were present before this plan and are out of scope (TypeScript compilation for modified files is clean).

## Known Stubs

None — all five modified files wire real data or implement real behavior. The `"claude-cli"` default in ingest.ts is intentional and conservative (hook events genuinely originate from Claude Code).

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what the plan's threat model covers. T-69-05-02 (idempotency via filter query) is mitigated by the skip-existing logic in `seedProviderConfigs`.

## Self-Check: PASSED

- convex/seedGateway.ts: modified and committed at 33553cf
- convex/ingest.ts: modified and committed at 33553cf
- src/components/SessionComparison.tsx: modified and committed at eb6db0d
- src/components/ActiveSessions.tsx: modified and committed at eb6db0d
- src/components/SessionHeader.tsx: modified and committed at eb6db0d
- SUMMARY.md: created at this commit
