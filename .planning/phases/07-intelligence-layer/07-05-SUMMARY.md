---
phase: 07-intelligence-layer
plan: 05
subsystem: memory-quality
tags:
  - memory
  - quality-metrics
  - deduplication
  - staleness
  - contradiction-detection
  - llm
dependency_graph:
  requires:
    - 07-01 (memoryQuality schema table)
    - 07-03 (getLLMConfigInternal + callLLMWithFallback pattern)
  provides:
    - convex/memoryQuality.ts (evaluation cron + queries)
    - src/components/MemoryQualityTab.tsx (quality tab UI)
    - Memory page Quality tab with StatCards
  affects:
    - src/pages/Memory.tsx (new tab + quality stats)
    - convex/_generated/api.d.ts (memoryQuality module registered)
tech_stack:
  added: []
  patterns:
    - TDD red/green for pure helper functions
    - internalMutation + internalAction separation (cron writes preliminary, action patches after LLM)
    - Accordion UI pattern with open/close state per section
    - SectionErrorBoundary wrapping new tab content
key_files:
  created:
    - convex/memoryQuality.ts
    - src/components/MemoryQualityTab.tsx
  modified:
    - convex/memoryQuality.test.ts
    - src/pages/Memory.tsx
    - convex/_generated/api.d.ts
decisions:
  - Split preliminary row insert (internalMutation) from LLM contradiction patch (internalAction) so cron result is immediately visible even if LLM is slow or unavailable
  - Capped contradiction detection at 20 memory IDs (~10 pairs) per batch per RESEARCH.md Pitfall 5 to control LLM cost
  - Duplicate Flags accordion shows dedup rate summary text (no per-item list) since dedup is a ratio metric, not a per-ID list
metrics:
  duration: ~8 minutes
  completed: 2026-04-14
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 7 Plan 05: Memory Quality Metrics Summary

Memory quality evaluation cron with LLM contradiction detection (capped 20 IDs/10 pairs), plus Quality tab on Memory page showing dedup rate, stale count, and contradiction count with accordion detail sections.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Memory quality evaluation backend | d4c63e7 | convex/memoryQuality.ts, convex/memoryQuality.test.ts, convex/_generated/api.d.ts |
| 2 | MemoryQualityTab component and Memory page integration | 63a9257 | src/components/MemoryQualityTab.tsx, src/pages/Memory.tsx |

## What Was Built

**convex/memoryQuality.ts** — Full memory quality evaluation backend:
- `computeDeduplicationRate(totalStored, prunedCount)` — pure helper, exported for testing
- `identifyStaleMemories(events, thresholdDays, nowEpoch)` — pure helper, uses most-recent-access per memory ID
- `evaluateInternal` — internalMutation (cron target at 03:00 UTC): reads `intelligence.staleness_days` from agentConfigs (default 30), queries all episodicEvents, computes dedup rate and stale IDs, inserts preliminary memoryQuality row, schedules `detectContradictionsAction` for recent 24h memories (capped at 20)
- `detectContradictionsAction` — internalAction: reads LLM config via `getLLMConfigInternal`, sends memory ID pairs to primary LLM (Anthropic or OpenAI-compatible), parses JSON response, patches quality row via `updateContradictions`
- `updateContradictions` — internalMutation that patches the quality row with contradiction results
- `getLatestQuality` — public query returning most recent memoryQuality row
- `getQualityHistory` — public query returning last 10 rows for trend display

**src/components/MemoryQualityTab.tsx** — Quality tab component:
- Stats row: Dedup Rate (%), Stale Memories (count), Contradictions (count) using `text-2xl font-semibold tabular-nums` MetricCard pattern
- Three accordion sections (toggle open/close): Duplicate Flags, Stale Memories, Contradictions
- Each section shows per-item rows with icons (Copy, Clock, AlertTriangle) or empty state "No issues detected"
- Overall empty state when no quality data: "No quality issues detected" heading

**src/pages/Memory.tsx** — Memory page additions:
- TabId expanded to include `"quality"`
- "Quality" tab button added to navigation row
- Quality StatCards (Dedup Rate, Stale Memories, Contradictions) added to page-level stats grid
- Quality tab content renders `<MemoryQualityTab />` wrapped in `<SectionErrorBoundary name="Memory Quality">`

## Verification

- `npx vitest run convex/memoryQuality.test.ts` — 7 tests pass
- `npx tsc --noEmit` — 0 errors in new files (2 pre-existing errors in convex/runtimeIngest.ts, unrelated)
- All acceptance criteria met for both tasks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The quality data flows from real episodicEvents table queries. Empty state displays correctly when no data exists (before first cron run).

## Threat Flags

No new security surface introduced beyond what was in the plan's threat model. LLM call in `detectContradictionsAction` is scoped to the batch cap (20 IDs, ~10 pairs) per T-07-12 mitigation.

## Self-Check: PASSED

- convex/memoryQuality.ts: FOUND
- src/components/MemoryQualityTab.tsx: FOUND
- convex/memoryQuality.test.ts (7 tests): FOUND
- src/pages/Memory.tsx (quality tab): FOUND
- Commit d4c63e7: FOUND
- Commit 63a9257: FOUND
