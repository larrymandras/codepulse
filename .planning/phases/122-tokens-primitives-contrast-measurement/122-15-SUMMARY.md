---
phase: 122-tokens-primitives-contrast-measurement
plan: 15
subsystem: ui
tags: [react, skeleton, empty-state, honesty-sweep, tailwind]

# Dependency graph
requires:
  - phase: 122-09
    provides: "src/lib/metricState.ts and src/hooks/useMetricState.ts, the six-state vocabulary"
  - phase: 122-13
    provides: "src/components/MetricCard.tsx's state contract"
  - phase: 122-14
    provides: "MetricCard render-site migration and the state-honesty ledger style this plan follows"
provides:
  - "LoadingState.tsx wired up as the shared shaped-skeleton primitive (table/metric/chart/text/page), previously dead code with zero callers"
  - "InlineMetricState, a new cell-scale renderer of the shared vocabulary, added to EmptyState.tsx"
  - "Zero bare '>Loading' strings and zero value-slot em-dash placeholders across the plan's 19-file scope"
  - "122-LOADING-LEDGER.md, the per-site record of every bare-loading and em-dash occurrence, its verdict, and its replacement"
affects: [122-16, ui-honesty-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content-shaped loading skeletons (LoadingState shape prop) instead of a spinner-plus-word"
    - "Cell-scale state rendering (InlineMetricState) for dense table cells, distinct from panel-scale (EmptyState) and tile-scale (MetricCard)"
    - "'n/a' plain text (not a MetricState) for values that are structurally inapplicable given a row's other fields, distinct from InlineMetricState's 'empty' (a real per-row data gap)"

key-files:
  created:
    - src/components/LoadingState.tsx (rewritten from dead code to the shared shape API)
    - .planning/phases/122-tokens-primitives-contrast-measurement/122-LOADING-LEDGER.md
  modified:
    - src/App.tsx
    - src/App.test.tsx
    - src/layouts/DashboardLayout.tsx
    - src/components/CostForecastPanel.tsx
    - src/components/CostForecastPanel.test.tsx
    - src/components/OperatorScoreCard.tsx
    - src/components/__tests__/OperatorScoreCard.test.tsx
    - src/components/SessionCapabilities.tsx
    - src/components/SessionComparison.tsx
    - src/components/AgentDetailPanel.tsx
    - src/components/EmptyState.tsx (adds InlineMetricState)
    - src/components/BashLog.tsx
    - src/components/ContextGauge.tsx
    - src/components/CostBreakdown.tsx
    - src/components/DeliveryHistory.tsx
    - src/components/ExecutionTable.tsx
    - src/components/FactsTable.tsx
    - src/components/GatewayTasksPanel.tsx
    - src/components/RoutingDecisionsTable.tsx
    - src/components/RunSummary.tsx
    - src/components/__tests__/RunSummary.test.tsx
    - src/components/SessionHeader.tsx
    - src/components/SwarmTaskNode.tsx

key-decisions:
  - "LoadingState.tsx had zero callers anywhere in src/ before this plan (dead code, hardcoded spinner+word body) -- this plan is what wires it up, not a refactor of an existing consumer"
  - "Bare-loading population re-derived as 58 occurrences / 8 files, matching CONTEXT.md's number exactly but correcting its claim that the figure includes test files -- measured, zero of the 58 are in a test file"
  - "Em-dash population re-derived as 75 raw occurrences across 16 files; 33 are real value-slot placeholders, 42 are legitimate typography (comments/JSDoc/one rendered tooltip sentence) -- CONTEXT.md's 27 and the plan's own revised 52/28 both differ from every re-measurement run, none adopted"
  - "Two non-MetricState conventions carried from 122-14's house style: 'n/a' plain text for structurally-inapplicable values (a percentage of an unpriced row, a routing score never computed, a run field not yet reported) and a plain 'No' for a real known boolean (RoutingDecisionsTable's fallback-not-used column) -- neither is a data gap, so neither gets the empty-state icon"
  - "SwarmTaskNode's unclaimed-task fallback uses plain text ('unclaimed'), not the icon-bearing InlineMetricState, to keep the React Flow node's fixed footprint stable"
  - "App.tsx's DEBT-03 source-shape guard test (App.test.tsx) hardcoded the pre-migration per-route fallback markup as an exact string; updated to check the shared LoadingState component instead, since 122-15 changes what a route-level Suspense fallback looks like by design"

requirements-completed: [TOKEN-04]

# Metrics
duration: ~2h
completed: 2026-08-19
---

# Phase 122 Plan 15: Loading String / Em-Dash Migration Summary

**Converted 58 bare "Loading" strings to shaped skeletons via a newly-wired LoadingState component, and 33 component-tier em-dash placeholders to explicit states or honest "n/a"/plain-text values, across 19 files.**

## Performance

- **Duration:** ~2h
- **Tasks:** 3 (population re-derivation + ledger, bare-loading conversion, em-dash conversion)
- **Files modified:** 22 (2 created: LoadingState.tsx rewrite counts as modified since the file pre-existed; 1 new ledger doc; 21 modified)

## Accomplishments

- `LoadingState.tsx` — previously dead code with zero callers anywhere in `src/` — is now the shared shaped-skeleton primitive with 5 content shapes (table/metric/chart/text/page), wired into 8 loading-branch sites.
- All 51 of `App.tsx`'s route-level `Suspense` fallbacks (one per `<Route>`, including the two `/war-room` routes) plus `DashboardLayout.tsx`'s avatar-dialog fallback now render `<LoadingState shape="..." />` instead of a centered "Loading X..." word.
- `EmptyState.tsx` gains `InlineMetricState`, a new cell-scale renderer of the shared six-state vocabulary, for dense-table cells where a full panel-scale `EmptyState` would be the wrong scale.
- 33 value-slot em-dash placeholders across 12 files converted to an explicit state, a per-site D-20-overridden label, or (for values that are structurally inapplicable rather than merely unknown) plain "n/a" text — matching the "n/a" convention 122-14 already established for `formatSuccessRate`/`costLabel()`.
- 42 legitimate-typography em-dashes (code comments, JSDoc headers, one rendered tooltip sentence, one rendered "— soon" nav label) verified in context and left untouched.

## Task Commits

1. **Task 1: Re-derive both populations and open the ledger** — `985a21a1` (docs)
2. **Task 2: Convert the bare-loading surfaces** — `303220b9` (feat) — includes AgentDetailPanel's 2 em-dash conversions (same file, same edit) and `InlineMetricState`'s introduction
3. **Task 3: Convert the component-tier em-dash placeholders** — `78c8b146` (feat)

## Files Created/Modified

- `src/components/LoadingState.tsx` — rewritten: dead spinner+word component → shared shape API, now consumed by 8 call sites
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-LOADING-LEDGER.md` — per-site record, both populations re-derived with unit+scope, every site's verdict
- `src/components/EmptyState.tsx` — adds `InlineMetricState` (cell-scale renderer)
- `src/App.tsx`, `src/layouts/DashboardLayout.tsx` — Suspense fallbacks converted
- `src/components/{CostForecastPanel,OperatorScoreCard,SessionCapabilities,SessionComparison,AgentDetailPanel}.tsx` — loading branches converted
- `src/components/{BashLog,ContextGauge,CostBreakdown,DeliveryHistory,ExecutionTable,FactsTable,GatewayTasksPanel,RoutingDecisionsTable,RunSummary,SessionHeader,SwarmTaskNode}.tsx` — em-dash placeholders converted
- `src/App.test.tsx`, `src/components/CostForecastPanel.test.tsx`, `src/components/__tests__/OperatorScoreCard.test.tsx`, `src/components/__tests__/RunSummary.test.tsx` — updated assertions that depended on now-removed literal text; `RunSummary.test.tsx`'s update was mutation-tested (broke one `n/a` fallback, confirmed red, restored, confirmed green)

## Decisions Made

See `key-decisions` in frontmatter. The most consequential one architecturally: App.tsx's existing DEBT-03 regression-guard test (`App.test.tsx`) hardcoded the pre-migration Suspense fallback markup as an exact string for its 14-route table. Converting the fallback to a shared skeleton by design broke that literal-string assertion; rather than leave it stale or delete the guard, it was rewritten to assert the new `<LoadingState shape="page" />` markup and to check the skeleton's own `data-testid` at runtime instead of a fallback string that no longer exists — preserving the guard's actual intent (no eager top-level page imports, every route wrapped in `Suspense`) without depending on text that design law now forbids.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CostBreakdown's percentage cell would have rendered "n/a%" instead of "n/a"**
- **Found during:** Task 3 (CostBreakdown.tsx em-dash conversion)
- **Issue:** The original code always appended a literal `%` after the pct value (`{pct}%`); converting the fallback string from `"—"` to `"n/a"` without changing the render site would have produced the malformed "n/a%".
- **Fix:** Render site now conditionally omits the `%` suffix when `pct === "n/a"`.
- **Files modified:** src/components/CostBreakdown.tsx
- **Verification:** Read the render site before committing; no existing test asserted on this text so no test needed updating, but the fix was necessary for correctness (Rule 1: broken rendering, not a fabricated claim).
- **Committed in:** 78c8b146 (Task 3 commit)

**2. [Rule 3 - Blocking] ExecutionTable's `formatDuration`/`formatTs` helpers needed a signature change to support per-call-site honest labels**
- **Found during:** Task 3 (ExecutionTable.tsx em-dash conversion)
- **Issue:** Both helpers returned a hardcoded `"—"` string on the null path, shared across 6 call sites that each need a different honest label ("not recorded" vs "not yet"/"no channel"/"no mode data").
- **Fix:** Changed both helpers' return type to `string | null`, letting each call site choose its own `InlineMetricState` override via `?? <InlineMetricState .../>`. One call site (`Stalled at:`, inside an already-null-guarded branch) needed a defensive `?? "n/a"` purely to satisfy the new nullable return type — that branch is unreachable in practice.
- **Files modified:** src/components/ExecutionTable.tsx
- **Verification:** tsc clean; no test file exists for ExecutionTable.tsx (none was broken or needed).
- **Committed in:** 78c8b146 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking signature change). Both were necessary for the migration to render correctly; no scope creep.

## Issues Encountered

Git pathspec glob semantics tripped the initial population re-derivation: `git grep -- 'src/**/*.tsx'` (double-star) returned far fewer hits than `git grep -- 'src/*.tsx'` (single-star) despite the intent to search recursively, because git's pathspec glob (not the shell's) treats a bare `*` as crossing directory boundaries by default — this repo's own LESSONS file already names this trap. Resolved by using the single-star form throughout, consistent with the plan's own hinted command, and by re-deriving with an explicit per-file `git grep -c` sum as a second check whenever the population arithmetic didn't self-consistently add up (caught and corrected two hand-tally errors in the ledger's own drafting — see the ledger's population section for the corrected math).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 122-16 owns the em-dash placeholders remaining in `src/pages/*.tsx` (page tier) and any component subtree outside this plan's 19-file list — the boundary is explicit in `122-LOADING-LEDGER.md`'s final section: this plan's `files_modified` list already IS the full em-dash population it re-derived, so 122-16's scope is "everything else."
- `InlineMetricState` (EmptyState.tsx) and `LoadingState`'s shape API are now available for 122-16 or any later plan needing the same cell-scale or shaped-skeleton primitives — no need to re-invent either.
- Suite baseline going into 122-16: 345 files / 4858 passed / 0 failed (was 345/4857/0 before this plan; +1 from a new App.tsx source-shape assertion this plan added). `tsc --noEmit` and `npm run build` both exit 0.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

All claimed files found on disk (`src/components/LoadingState.tsx`,
`122-LOADING-LEDGER.md`, `src/components/EmptyState.tsx`, `src/App.tsx`,
`src/components/BashLog.tsx`, this SUMMARY.md). All 3 task commit hashes
(`985a21a1`, `303220b9`, `78c8b146`) found in `git log --oneline --all`.
