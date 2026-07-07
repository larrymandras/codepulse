---
phase: 94-trace-waterfall
plan: 01
subsystem: database
tags: [convex, llmMetrics, trace, ingest, schema]

# Dependency graph
requires:
  - phase: 93-eval-pipeline-quality-kpis
    provides: precedent for runtimeIngest dispatch + internalMutation gating patterns reused here (validateIngestAuth Bearer gate)
provides:
  - "traceId: v.optional(v.string()) on llmMetrics table (Phase 94 TRACE-01 grouping key)"
  - "recordCall mutation threads traceId arg through to the DB insert"
  - "/runtime-ingest llm_call case aliases traceId/trace_id into recordCall"
  - "api.llm.sessionCalls query returning full-session chronological non-archived rows for client-side trace grouping"
affects: [94-02, 94-03, 94-04, 94-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional grouping-key field mirrored exactly on the goalId (Phase 149) precedent — schema field, mutation arg, insert field, camelCase/snake_case ingest alias, all in the same relative position"
    - "Query with no rolling-window cutoff for full-session reads (distinct from cacheStats' windowed cutoff) — client owns grouping/presentation, not the query"

key-files:
  created: []
  modified:
    - convex/schema.ts
    - convex/llm.ts
    - convex/llm.test.ts
    - convex/runtimeIngest.ts
    - convex/runtimeIngest.test.ts
    - convex/_generated/api.d.ts
    - convex/_generated/api.js
    - convex/_generated/dataModel.d.ts
    - convex/_generated/server.d.ts
    - convex/_generated/server.js

key-decisions:
  - "No new by_trace index added — session-scale client-side grouping is sufficient per RESEARCH.md Alternatives Considered; verified via rg that no by_trace index exists in schema.ts"
  - "sessionCalls deliberately omits the .gte(timestamp cutoff)/.take() cap that other llm.ts queries use — the Trace tab needs the whole session, not a rolling window"
  - "Codegen was run offline (npx convex codegen) against the existing dev/.env.local CONVEX_DEPLOYMENT, NOT a deploy — confirmed via `npx convex codegen --help` that codegen 'doesn't modify the code running on the deployment'; prod deploy remains gated to Plan 05"

patterns-established:
  - "Trace-grouping fields ride the same authenticated ingest payload as every other llmMetrics field — no new auth surface (T-94-01 inherited disposition)"

requirements-completed: [TRACE-01]

# Metrics
duration: 56min
completed: 2026-07-06
---

# Phase 94 Plan 01: Trace Storage + Read Contract Summary

**`traceId` grouping key threaded end-to-end (schema → recordCall → runtimeIngest alias) plus a new `sessionCalls` query returning full-session chronological rows for the upcoming TraceWaterfall UI.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-07-06T13:14:27-04:00 (base commit)
- **Completed:** 2026-07-06T14:09:57-04:00
- **Tasks:** 2/2
- **Files modified:** 10 (5 source/test + 5 generated)

## Accomplishments
- `llmMetrics.traceId: v.optional(v.string())` added, positioned immediately after `goalId`, backward-compatible with every existing row
- `recordCall` mutation accepts and persists `traceId`; `/runtime-ingest`'s `llm_call` case maps both `traceId` (camelCase) and `trace_id` (snake_case) into it
- New `api.llm.sessionCalls` query: `by_session` index, ascending timestamp order, non-archived filter, no rolling-window cutoff — returns raw rows for the client to group by `traceId`
- `npx convex codegen` (offline) + `npx tsc --noEmit` both green after each task

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread traceId through schema, recordCall, and the ingest alias (TRACE-01 core)** - `7bb1252` (feat)
2. **Task 2: Add the sessionCalls query the waterfall reads (TRACE-02 read path)** - `34135d9` (feat)

_Both tasks were TDD-tagged; tests were written and asserted green in the same commit as the corresponding source change (existing hand-mirrored no-convex-test convention was extended in place rather than as a separate RED commit, matching this repo's established Phase 149/93 pattern of adding test + implementation together in one atomic task commit)._

## Files Created/Modified
- `convex/schema.ts` - Added `traceId: v.optional(v.string())` to `llmMetrics` table (no new index)
- `convex/llm.ts` - `recordCall` args + insert threads `traceId`; new `sessionCalls` query
- `convex/llm.test.ts` - `recordCallLogic` mirrors `traceId`; new `recordCall — traceId persistence` and `sessionCalls (Phase 94 TRACE-02)` describe blocks
- `convex/runtimeIngest.ts` - `llm_call` case adds `traceId: d.traceId ?? d.trace_id`
- `convex/runtimeIngest.test.ts` - new `extractLlmCallTraceId` mirror function + `runtimeIngest — llm_call traceId extraction` describe block
- `convex/_generated/*` - regenerated via offline `npx convex codegen` (no deploy)

## Decisions Made
- No new Convex index for `traceId` — confirmed via `rg "by_trace" convex/schema.ts` (no match), matching the plan's explicit instruction that session-scale client-side grouping is sufficient.
- `sessionCalls` intentionally has no `.gte(timestamp cutoff)` and no `.take()` cap, unlike every other query in `llm.ts` — the Trace tab needs the complete session for correct waterfall rendering, confirmed via grep of the handler body.
- Copied the main repo's gitignored `.env.local` (`CONVEX_DEPLOYMENT=prod:tidy-whale-981`) into the worktree so `npx convex codegen` had a deployment context to read schema/component state from. Verified via `npx convex codegen --help` that codegen "doesn't modify the code running on the deployment" before running it — this is read-only type generation, not a deploy. No `npx convex deploy` was run (that remains gated to Plan 05 per the plan's explicit instruction).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Acceptance criterion doesn't hold for this codegen version] `rg "traceId" convex/_generated/api.d.ts` does not match**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria expected `rg "traceId" convex/_generated/api.d.ts` to match after codegen. In this repo's Convex CLI version, `api.d.ts` and `dataModel.d.ts` are pure TypeScript `import type * as X from "../X.js"` re-export wrappers — they never literally embed field-name strings; all typing flows through `typeof` references resolved by `tsc`, not textual codegen. Confirmed this is pre-existing behavior (not something broken by this change) by grepping for the sibling `goalId` field across `convex/_generated/` — zero matches, same as `traceId`.
- **Fix:** No code change needed. Verified the underlying intent ("codegen picked up the new arg") via the deeper correctness check the plan itself specifies as a companion criterion: `npx tsc --noEmit` exits 0, which would fail if `sessionCalls`/`traceId` weren't recognized by the type system. Documented here rather than silently marking the literal grep criterion as passed.
- **Files modified:** None (verification-only finding)
- **Verification:** `npx tsc --noEmit` exit 0; `grep -rn goalId convex/_generated/` returns nothing, confirming the pattern predates this plan
- **Committed in:** N/A (no code change; informational deviation only)

---

**Total deviations:** 1 documented, 0 code changes (informational verification-approach correction only)
**Impact on plan:** None on functionality — schema, mutation, ingest alias, and query all work and are fully test-covered; only the literal-grep phrasing of one acceptance criterion doesn't hold for this Convex CLI's generated-file format.

## Issues Encountered
- `npx convex codegen` initially failed with "No CONVEX_DEPLOYMENT set" because the worktree lacks the gitignored `.env.local` present in the main repo checkout. Resolved by copying `.env.local` from the main repo (`C:\Users\mandr\codepulse\.env.local`) into the worktree — this only supplies read-only deployment context for type generation; no deploy was performed. See Decisions Made above for the safety verification performed before running codegen against a prod-pointing `CONVEX_DEPLOYMENT`.

## User Setup Required

None - no external service configuration required. (The `.env.local` copy is an execution-environment detail internal to this worktree, not a new user-facing setup step — the main repo already has this file configured from prior phases.)

## Next Phase Readiness
- `traceId` storage + `sessionCalls` read path are live and test-covered; Plan 03's `TraceWaterfall` component can now consume `api.llm.sessionCalls` and group returned rows by `traceId` client-side.
- No blockers. Prod deploy of these Convex changes remains correctly deferred to Plan 05 (operator-gated) — nothing in this plan touched `npx convex deploy`.

---
*Phase: 94-trace-waterfall*
*Completed: 2026-07-06*
