---
phase: 94-trace-waterfall
plan: 03
subsystem: frontend
tags: [react, convex, trace, waterfall, collapsible, tooltip, metric-card]

# Dependency graph
requires:
  - phase: 94-trace-waterfall (plan 01)
    provides: "traceId on llmMetrics + api.llm.sessionCalls query (full-session chronological rows for client-side grouping)"
provides:
  - "TraceWaterfall component: Gantt-styled per-turn LLM call-chain visualization for a single session"
  - "groupByTrace/barMetrics/cacheBadge/costLabel pure helpers, unit-tested independent of rendering"
affects: [94-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side Map + orphan-bucket grouping (mirrors GanttTimeline's agentEventMap/orphanEvents structure, not imported per D-09)"
    - "Theme-token-only inline styles (var(--chart-1)/var(--status-*)/var(--muted)) — zero hardcoded hex"
    - "Radix Collapsible.Trigger wraps the whole header row to satisfy chevron aria-labeling without a separate aria-label"

key-files:
  created:
    - src/components/TraceWaterfall.tsx
    - src/components/TraceWaterfall.test.tsx
  modified: []

key-decisions:
  - "No error/tool-error bar coloring implemented — llmMetrics rows returned by api.llm.sessionCalls carry no error/status field (confirmed via convex/schema.ts); fabricating an error signal from unrelated fields would violate this same plan's own D-13/D-14 no-fabrication principle. All call bars render with the normal var(--chart-1) fill. Deferred until an error field is added to llmMetrics or a joined events lookup is introduced."
  - "Group-level cost aggregate: 'n/a' shown only when every row in a turn group is missing cost (partial-cost groups sum the defined subset), consistent with the per-row costLabel D-14 contract."
  - "Turn numbering is 1-based and counts only traced groups (the untraced bucket is not a 'turn')."

patterns-established:
  - "Cache-ratio / cost-footnote summary math uses only real measured fields (cacheReadInputTokens, promptTokens, cost) with explicit undefined-vs-zero handling — no estimated numbers anywhere in the component."

requirements-completed: [TRACE-02]

# Metrics
duration: 8min
completed: 2026-07-06
---

# Phase 94 Plan 03: TraceWaterfall Component Summary

**Gantt-styled, per-turn LLM call-chain visualization: `llmMetrics` rows grouped by `traceId` into collapsible turn groups (untraced legacy rows in one flat group last), each call rendered as a positioned timing bar with inline model/cost/cache label and a hover detail tooltip, plus a 4-`MetricCard` summary strip — all reading `api.llm.sessionCalls` via live Convex reactivity.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-06T14:14:26-04:00 (base commit)
- **Completed:** 2026-07-06T14:21:59-04:00
- **Tasks:** 2/2
- **Files created:** 2 (`TraceWaterfall.tsx`, `TraceWaterfall.test.tsx`)

## Accomplishments

- Four exported pure helpers (`groupByTrace`, `barMetrics`, `cacheBadge`, `costLabel`) fully unit-tested: traced/untraced grouping + ordering, the seconds/milliseconds bar-math unit conversion (Pitfall 1), the three-state cache badge (never conflating `undefined` with `0`, D-13), and the cost dash (never estimating, D-14)
- `TraceWaterfall({ sessionId })` renders: a 4-card summary strip (total cost with a "N calls without cost" footnote, call count, total tokens, cache-read ratio), collapsible `Turn N · calls · duration · cost` groups in chronological order, a flat un-collapsible "Untraced calls" group always last, 36px call bars positioned on the shared session time axis, inline `{model} · {cost/n-a} · {cache badge}` bar labels, and a Radix `Tooltip` hover detail panel (tokens in/out, cache read/creation, latency, provider, toolName, billingType)
- Honest empty state ("No LLM calls yet" / reactive-refresh copy) when a session has zero calls; `null` render while the query is loading (`useQuery` returns `undefined`)
- Zero hardcoded hex, zero `GanttTimeline` import, zero `dangerouslySetInnerHTML`, zero weight-500 in new elements — all confirmed via `rg`
- `npx vitest run src/components/TraceWaterfall.test.tsx` — 17/17 green; `npx tsc --noEmit` — exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — write TraceWaterfall.test.tsx + export the pure-logic helpers** - `ac4b66c` (test)
2. **Task 2: GREEN — implement the TraceWaterfall rendering component** - `7237462` (feat)

_Per this repo's established Phase 149/93/94-01 convention, both tasks' tests were written and asserted green in the same commit as the corresponding source change — Task 1's helpers were implemented directly (not stubbed) alongside their tests since the plan's own acceptance criteria required the four helpers to be real and correctly tested from the first commit; only the render path was a stub until Task 2._

## Files Created

- `src/components/TraceWaterfall.tsx` — the component + four exported pure helpers + render-only aggregation helpers (`computeTimeRange`, `computeSummary`, `groupCostLabel`, `rowCachePercent`) + a `TraceCallRow` sub-component for the bar+tooltip
- `src/components/TraceWaterfall.test.tsx` — 17 tests: 13 pure-helper unit tests (grouping, bar math, cache badge, cost dash) + 4 mount-based component tests (empty state, loading state, mixed-fixture group rendering, summary strip)

## Decisions Made

- **No error/tool-error bar coloring** — the plan's action text calls for `var(--status-error)` "when the call is an error/tool-error", but `api.llm.sessionCalls`' `llmMetrics` rows (confirmed via `convex/schema.ts` lines 297-315) carry no error/status field at all — that signal lives only in the separate `events` table, which this component does not join. Inventing a heuristic (e.g., guessing from model name) would fabricate a signal this same plan's D-13/D-14 explicitly forbid for cost/cache. All call bars render with the normal `var(--chart-1)` fill; documented here rather than silently dropped.
- **Group-level cost/duration aggregates** — `groupCostLabel()` sums only rows with a defined `cost`, returning `"n/a"` only when every row in the group lacks cost (mirrors the per-row D-14 contract at group scale). Group duration is the sum of `latencyMs` across the group's rows (total call-time within the turn), not a wall-clock span.
- **Turn numbering** — 1-based, incremented only for traced groups; the untraced bucket is labeled "Untraced calls · N" and is never assigned a turn number.
- **Time axis right edge** — `computeTimeRange` extends `maxTs` to `Date.now()/1000` (mirroring the sibling swimlane component's live-session behavior) so an in-progress session's axis keeps growing without a manual refresh, consistent with D-12's no-polling/no-manual-refresh contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - literal-grep false trigger] Removed "GanttTimeline" from a code comment**
- **Found during:** Task 2 acceptance-criteria verification
- **Issue:** The acceptance criterion `rg "GanttTimeline" src/components/TraceWaterfall.tsx` returns NOTHING was tripped by an explanatory comment (`// inherited verbatim from GanttTimeline's ROW_HEIGHT...`) that named the analog component in prose, not as an import.
- **Fix:** Reworded the comment to describe the pattern without naming the file (`"the sibling swimlane component's row-height constant"`). No behavior change.
- **Files modified:** `src/components/TraceWaterfall.tsx`
- **Commit:** `7237462`

**2. [Rule 2 — informational, no code change] No error/tool-error data field available**
- See "Decisions Made" above — documented as a deviation rather than a silent gap, since the plan's action text explicitly describes an error-coloring behavior that the current `LlmCallRow` data contract cannot support without fabricating a signal.

---

**Total deviations:** 2 documented (1 trivial comment wording fix, 1 informational data-contract gap with no fabricated substitute)
**Impact on plan:** None on shipped functionality — all `<acceptance_criteria>` and `<verification>` checks in the plan pass; the error-bar-coloring detail is the one plan-described behavior not implemented, and it is documented rather than faked.

## Known Stubs

None. Every rendered value derives from real `llmMetrics` fields returned by `api.llm.sessionCalls`; the empty/loading/cost-dash/cache-no-data states are honest placeholders required by D-13/D-14, not stubs standing in for missing wiring.

## Threat Flags

None. `T-94-05` (XSS via reflected model/traceId/toolName strings) is mitigated as specified — all values render as JSX text nodes only, no `dangerouslySetInnerHTML` anywhere in the file (confirmed via `rg`). `T-94-06` (fabricated cost/cache signal) is mitigated per the unit-tested `costLabel`/`cacheBadge` contracts. No new network endpoints, auth paths, or schema changes were introduced by this plan.

## Issues Encountered

None.

## User Setup Required

None — this plan only adds a new component consumed by Plan 04 (SessionDetail Trace tab wiring); no environment/config changes.

## Next Plan Readiness

`TraceWaterfall` is fully built, unit-tested, and ready to be imported into `SessionDetail.tsx`'s new "Trace" tab in the next plan (94-04), which also wires the `?tab=trace` deep-link and the "View Trace" cross-nav link from Analytics. No blockers.

## Self-Check: PASSED

- FOUND: `src/components/TraceWaterfall.tsx`
- FOUND: `src/components/TraceWaterfall.test.tsx`
- FOUND: `.planning/phases/94-trace-waterfall/94-03-SUMMARY.md`
- FOUND commit: `ac4b66c` (Task 1)
- FOUND commit: `7237462` (Task 2)
- FOUND commit: `cad54a1` (this summary)

---
*Phase: 94-trace-waterfall*
*Completed: 2026-07-06*
