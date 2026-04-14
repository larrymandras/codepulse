---
phase: 07-intelligence-layer
plan: "03"
subsystem: intelligence
tags:
  - briefings
  - llm
  - daily-digest
  - session-briefings
  - settings
dependency_graph:
  requires:
    - 07-01 (schema: briefings, anomalyEvents tables)
    - 07-02 (forecasts module, Settings Intelligence section base)
  provides:
    - briefings backend: session briefings, daily digest, LLM failover, config
    - Briefings page: dynamic paginated feed
    - LLMProviderConfig: dual-provider settings UI
    - Settings: LLM Providers subsection
  affects:
    - convex/crons.ts (triggerDailyDigest now resolved)
    - convex/ingest.ts (session_end and Stop events now trigger briefings)
tech_stack:
  added:
    - callLLMWithFallback: dual-provider (openai/anthropic) LLM call pattern with failover
    - usePaginatedQuery for briefings feed pagination
  patterns:
    - internalQuery/internalMutation/internalAction for Convex backend isolation
    - T-07-05: public getLLMConfig strips apiKey before returning
    - T-07-07: structured event counts passed to LLM (not raw payloads)
    - T-07-08: slot + provider validation in setLLMConfig mutation
key_files:
  created:
    - convex/briefings.ts
    - src/components/BriefingFeedItem.tsx
    - src/components/LLMProviderConfig.tsx
  modified:
    - convex/briefings.test.ts
    - convex/ingest.ts
    - src/pages/Briefings.tsx
    - src/pages/Settings.tsx
    - convex/_generated/api.d.ts
decisions:
  - Used self-contained internal queries in briefings.ts rather than calling non-existent public API endpoints (listCompletedSince, getDailyTotal, etc.) — cleaner and avoids cross-module coupling
  - groupActivityEvents is a pure exported function tested without Convex mocking
  - Briefings page uses full replacement (all static AGENT_MAP, SCHEDULE, BRIEFING_TEMPLATES, BRIEFING_SECTIONS deleted)
  - api.d.ts manually updated with briefings module since Convex codegen requires live server
metrics:
  duration: ~25 minutes
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 8
---

# Phase 7 Plan 03: Session Briefings, Daily Digest, LLM Provider Config Summary

LLM-powered session briefings and daily digests with dual-provider failover (openai/anthropic), dynamic Briefings page feed replacing 100% static content, and LLM provider configuration UI in Settings.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Briefings backend | c7dea20 | convex/briefings.ts, convex/briefings.test.ts, convex/ingest.ts |
| 2 | Briefings page + LLMProviderConfig + Settings | d6be6d9 | src/pages/Briefings.tsx, src/components/BriefingFeedItem.tsx, src/components/LLMProviderConfig.tsx, src/pages/Settings.tsx, convex/_generated/api.d.ts |

## What Was Built

**Task 1 — Briefings backend (convex/briefings.ts):**
- `groupActivityEvents` pure helper: groups events by toolName/eventType, returns sorted counts (T-07-07: structured counts, not raw payloads)
- `callLLMWithFallback`: reads primary/backup config from agentConfigs, tries primary, falls back to backup on any error
- `getLLMConfigInternal` internalQuery: returns full config including apiKey for action use
- `getLLMConfig` public query: returns provider + model only, never apiKey (T-07-05)
- `setLLMConfig` mutation: validates slot ∈ {primary, backup}, provider ∈ {openai, anthropic} (T-07-08), upserts agentConfigs
- `onSessionCompleted` internalMutation: idempotency guard via by_session index, schedules generateSessionBriefingAction
- `getSessionDataInternal` internalQuery: reads session + events for briefing generation
- `getDailyDigestDataInternal` internalQuery: gathers completed sessions, cost aggregates, anomaly count, undismissed ideation findings (INT-06)
- `generateSessionBriefingAction` internalAction: builds structured summary, calls LLM, stores briefing
- `generateDailyDigestAction` internalAction: gathers daily data, calls LLM, stores daily_digest briefing
- `triggerDailyDigest` internalMutation: cron target scheduling generateDailyDigestAction
- `storeBriefing` internalMutation: inserts into briefings table
- `listBriefings` query: paginated with optional dateFrom/dateTo filter

**ingest.ts wiring:**
- `onSessionCompleted` triggered after `markCompleted` for both `session_end`/`session_stop` events and `Stop` Claude Code hook events

**Task 2 — Frontend:**
- `Briefings.tsx`: complete rewrite — all static data deleted, dynamic feed via `usePaginatedQuery(api.briefings.listBriefings)`, date range filter, empty state, LoadMoreButton, SectionErrorBoundary
- `BriefingFeedItem.tsx`: expand/collapse with ChevronDown, type pill (DIGEST/SESSION), session indent (ml-4), cost display
- `LLMProviderConfig.tsx`: primary + backup provider rows, provider select + model + apiKey inputs, Save Provider Config with optimistic states, Remove Provider with confirmation dialog
- `Settings.tsx`: LLMProviderConfig imported, LLM Providers subsection added within Intelligence section

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing API endpoints for daily digest data gathering**
- **Found during:** Task 1 implementation
- **Issue:** `generateDailyDigestAction` referenced `api.sessions.listCompletedSince`, `api.aggregates.getDailyTotal`, `api.anomalyEvents.countSince`, `api.ideationFindings.listUndismissed` — none existed
- **Fix:** Replaced with self-contained `getDailyDigestDataInternal` internalQuery that directly queries all needed tables (sessions, aggregates, anomalyEvents, ideationFindings)
- **Files modified:** convex/briefings.ts
- **Commit:** c7dea20

**2. [Rule 3 - Blocking] Generated API types missing briefings module**
- **Found during:** Task 2 TypeScript check
- **Issue:** `api.d.ts` and `internal.briefings.*` not recognized because Convex codegen requires a live server connection
- **Fix:** Manually added `briefings` import and `fullApi` entry to `convex/_generated/api.d.ts`
- **Files modified:** convex/_generated/api.d.ts
- **Commit:** d6be6d9

**3. [Rule 1 - Bug] anomalyEvents index incompatible with detectedAt-only filter**
- **Found during:** Task 1 TypeScript check
- **Issue:** `by_metric_detected` index keys are `["metric", "detectedAt"]` — cannot use without providing the `metric` prefix
- **Fix:** Switched to `by_severity` index (no prefix constraint) with `.filter()` on detectedAt range
- **Files modified:** convex/briefings.ts
- **Commit:** c7dea20 (fixed before commit)

## Pre-existing Out-of-Scope Issues (deferred)

- `convex/crons.ts`: `internal.anomalyDetection.evaluateInternal` and `internal.memoryQuality.evaluateInternal` reference modules not yet created (implemented by other plans in wave 2)
- `convex/runtimeIngest.ts`: redeclared `now` variable (pre-existing bug, unrelated to this plan)

## Known Stubs

None — all plan goals achieved. LLM calls gracefully degrade to rule-based fallback narrative if no provider is configured.

## Threat Flags

All threats from plan's threat_model were mitigated:
- T-07-05: `getLLMConfig` never returns apiKey
- T-07-06: LLM prompts receive structured summaries (counts, totals) not raw event payloads
- T-07-07: Event data passed as structured JSON counts; toolName/eventType are system-controlled strings
- T-07-08: `setLLMConfig` validates slot and provider values before upsert

## Self-Check: PASSED

All key files exist on disk and both task commits are present in git history:
- FOUND: convex/briefings.ts
- FOUND: src/pages/Briefings.tsx
- FOUND: src/components/BriefingFeedItem.tsx
- FOUND: src/components/LLMProviderConfig.tsx
- FOUND: c7dea20 (Task 1 commit)
- FOUND: d6be6d9 (Task 2 commit)
