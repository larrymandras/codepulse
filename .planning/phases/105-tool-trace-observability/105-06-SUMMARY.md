---
phase: 105-tool-trace-observability
plan: 06
subsystem: api
tags: [convex, react, aggregates, toolAnalytics, tool-usage, shadcn, toggle-group]

# Dependency graph
requires:
  - phase: 105-04
    provides: the hourly tool_calls/tool_failures/tool_duration_ms/tool_duration_samples aggregate buckets keyed by {tool, provider} this plan's queries read
  - phase: 105-03
    provides: ASTRIDR_TOOL_PROVIDER, the by_provider_time toolExecutions index, and the provider-tagged tool_executed ingest volume
  - phase: 105-01
    provides: the bounded-read-with-truncation-flag pattern this plan's AGG_READ_CAP/RAW_SCAN_CAP reads mirror
provides:
  - "convex/toolAnalytics.ts — classifyToolSource, usageOverTime, usageByTool, recentExecutionsBySource (all bounded, source-classified, honest-null)"
  - "src/hooks/useToolUsage.ts — useToolUsageOverTime/useToolUsageByTool/useToolExecutionsBySource wrapper hooks"
  - "src/components/ToolUsagePanel.tsx — the OBS-01 usage section (summary strip, source filter, two charts, per-tool table, empty state) — not yet mounted on any page"
affects: [105-08, 105-09]

tech-stack:
  added: []
  patterns:
    - "Provider-agnostic source classification: classifyToolSource(dim) resolves the D-02 gateway:claude-cli / provider-less collision by testing the tool NAME before the provider string, and is reused identically across raw toolExecutions rows and aggregate dimension objects (both key shapes accepted)"
    - "Honest-null averages: avgDurationMs/successRate are computed with an explicit `> 0` guard before dividing, never a `?? 0`/`|| 0` fallback that would fabricate a measurement — zero such fallbacks exist anywhere in toolAnalytics.ts (grep-verified)"
    - "sources[] computed independent of the active filter so a UI can disable an empty filter option instead of offering a dead end"

key-files:
  created:
    - convex/toolAnalytics.ts
    - convex/toolAnalytics.test.ts
    - src/hooks/useToolUsage.ts
    - src/components/ToolUsagePanel.tsx
    - src/components/ToolUsagePanel.test.tsx
  modified:
    - convex/_generated/api.d.ts

key-decisions:
  - "usageOverTime's per-bucket source filter could NOT reuse a shared filterBySource() helper the way the plan's own draft implied — flattening an aggregate row with `{...row, ...dimTool(row.dimensions)}` does not lift `provider` to the top level (only `tool`/`source` do), so classifyToolSource run against the flattened object always saw provider: undefined and silently misclassified every astridr row as claude-code. Found via the test I wrote for behavior bullet 'filters by source unless source is all', which failed with `expected 0 to be 4` before any code was shipped. Replaced with a shared `matchesSourceFilter(source, filter)` predicate applied directly against the already-classified `{tool, source}` pair from `dimTool()`, used identically in both usageOverTime and usageByTool — this is a Rule 1 fix to a bug caught by TDD before commit, not a shipped defect."
  - "Same class-of-fix as every prior Phase 105 plan: two comments (the SOURCE_OPTIONS doc comment and the useState default-source comment) independently used the literal substring \"All sources\", tripping the plan's own `grep -c 'All sources' == 1` acceptance criterion. Reworded both to describe the same fact without repeating the literal string."
  - "The literal string \"astridr\" is never re-typed in convex/toolAnalytics.ts (grep-verified 0 hits) — classifyToolSource's return value and the ToolSource union both derive from `typeof ASTRIDR_TOOL_PROVIDER` (a const-inferred string-literal type), and recentExecutionsBySource's default source reads the same imported constant rather than a second copy of the string."
  - "Added a data-testid on each of the two chart wrapper divs (tool-usage-frequency-chart / tool-usage-over-time-chart) purely to let the zero-bucket test scope its [data-stacked-bar] count to the over-time chart specifically — the per-tool chart also renders stacked bars from the same fixture, so an unscoped count would conflate the two. Matches this codebase's existing data-testid convention (10 other files already use it)."

requirements-completed: []  # OBS-01 NOT marked complete — this is plan 6/9 (Wave 4, read path + component only). No page mounts this component yet (105-08's scope, finding F5) and nothing has been deployed to the live self-hosted Convex instance, so per this project's established "green suite/single-plan != live-verified end-to-end" convention, full requirement satisfaction awaits 105-09's live confirmation against real Ástríðr tool-call data.

duration: ~50min
completed: 2026-08-04
---

# Phase 105 Plan 06: Tool Usage Analytics — Read Path + Panel Summary

**Bounded, source-classified `toolAnalytics.ts` queries reading only the hourly aggregate buckets 105-04 writes, wrapper hooks matching this codebase's `useQuery(...) ?? DEFAULT` convention, and a self-contained `ToolUsagePanel` (D-02 source filter defaulting to Ástríðr, D-12 truncation banner, two `FlexBarChart`s, a per-tool table with honest `n/a` durations, and the UI-SPEC empty state verbatim) — not yet mounted on any page.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 (Tasks 1 and 3 `tdd="true"`)
- **Files modified:** 6 (5 created, 1 regenerated codegen artifact)
- **Completed:** 2026-08-04

## Accomplishments

- `convex/toolAnalytics.ts`: `classifyToolSource` resolves finding F1's three-way collision (astridr-provider rows, `gateway:{provider}`-named rows including the colliding `provider: "claude-cli"` case, and provider-less legacy rows) via a tool-name-wins rule over `ASTRIDR_TOOL_PROVIDER`
- `usageOverTime` pre-seeds every hour boundary in the window at zero before filling in real buckets, so a genuine gap in tool activity renders as a real zero bar rather than a point the chart silently closes over (T-105-30)
- `usageByTool` returns `avgDurationMs: null` (never `0` or `NaN`) when no `tool_duration_samples` bucket exists for a tool, `successRate: null` for a tool with zero calls, and a `sources[]` list computed independent of the active filter so the UI can disable an empty filter option
- `recentExecutionsBySource` drills down via the dedicated `by_provider_time` index for the Ástríðr default (index-bounded, no scan), and a `RAW_SCAN_CAP=500`-bounded JS-classified scan for the other three source classes
- Every read is capped at `AGG_READ_CAP=5000` and `windowHours` is clamped to `MAX_WINDOW_HOURS=720` (T-105-26/T-105-27); `grep -c "\.collect()"` returns `0`
- `src/hooks/useToolUsage.ts` ships three `useQuery(...) ?? DEFAULT` wrapper hooks with typed honest-empty defaults
- `src/components/ToolUsagePanel.tsx`: `ToggleGroup` source filter (D-02, defaults to `"astridr"`, widest option labelled "All sources" — never bare "All"), summary strip (`MetricCard` × 4), D-12 truncation banner, per-tool + over-time `FlexBarChart`s, a shadcn `Table` with honest `n/a` durations/rates, and the UI-SPEC empty state copy verbatim — zero hardcoded hex, zero new packages, no `SectionErrorBoundary` (105-08 owns page-level wrapping), no page/route/nav file touched (finding F5, confirmed by `git diff --stat` across all three commits)
- Regenerated `convex/_generated/api.d.ts` via `npx convex codegen` (offline binding regeneration only — no `npx convex deploy` was run)
- 37 new tests (27 in `toolAnalytics.test.ts`, 10 in `ToolUsagePanel.test.tsx`) across every `<behavior>` bullet in both TDD tasks; full suite 3365/3365 passing (up from 3328 pre-plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: convex/toolAnalytics.ts — bounded, source-classified usage queries** — `dfef7428` (feat)
2. **Task 2: useToolUsage hooks + ToolUsagePanel component** — `8ac8257d` (feat)
3. **Task 3: ToolUsagePanel component tests** — `90a7919b` (test)

## Files Created/Modified

- `convex/toolAnalytics.ts` — NEW. `classifyToolSource`, `AGG_READ_CAP=5000`, `MAX_WINDOW_HOURS=720`, `RAW_SCAN_CAP=500`, `usageOverTime`, `usageByTool`, `recentExecutionsBySource` — all exported
- `convex/toolAnalytics.test.ts` — NEW. 27 tests: 5 `classifyToolSource` cases (including the gateway:claude-cli collision and the provider-less-row case as their own named tests), `usageOverTime` zero-pre-seeding/ordering/filtering/truncation/read-count/clamp tests, `usageByTool` source-filter/avgDurationMs-null (own named test)/failures-zero/sources-list/sort-and-slice/truncation/read-count tests, `recentExecutionsBySource` provider-index/default-source/JS-classify/sparse-class/limit-clamp tests
- `src/hooks/useToolUsage.ts` — NEW. `useToolUsageOverTime`, `useToolUsageByTool`, `useToolExecutionsBySource`, typed result/default exports
- `src/components/ToolUsagePanel.tsx` — NEW. Default-export self-contained panel, no required props
- `src/components/ToolUsagePanel.test.tsx` — NEW. 10 tests covering the D-02 default (DOM-asserted), the source-switch re-query, the "never bare All" guard, both honest-null render paths, the empty state, the truncation banner, and the zero-bucket-renders-a-bar case
- `convex/_generated/api.d.ts` — regenerated (`npx convex codegen`) so `api.toolAnalytics.*` type-resolves; `grep -c toolAnalytics convex/_generated/api.d.ts` → `2`

## Decisions Made

See the `key-decisions` list in the frontmatter for the full text of each decision (the `usageOverTime` source-filter bug caught by its own test before commit, the two comment-trips-own-grep fixes, the "astridr" literal-never-retyped confirmation, and the `data-testid` addition for test scoping).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `usageOverTime`'s source filter silently misclassified every row when first written**
- **Found during:** Task 1, running the test for behavior bullet "usageOverTime ... filters by source unless source is all" before commit (TDD RED-then-GREEN, not a shipped defect)
- **Issue:** The initial implementation reused a `filterBySource(rows.map(r => ({...r, ...dimTool(r.dimensions)})), source)` pattern borrowed from the plan's own draft shape. Spreading an aggregate row (`{metric_type, period, bucket_start, value, dimensions}`) does not lift `dimensions.provider` to the top level — only `dimTool()`'s own `tool`/`source` keys land there — so `classifyToolSource` re-run against the flattened object always saw `provider: undefined` and fell through to the `claude-code` default for every row, including genuinely astridr-provider ones.
- **Fix:** Removed the buggy `filterBySource` helper entirely and replaced it with a `matchesSourceFilter(source, filter)` predicate applied directly against the `{tool, source}` pair `dimTool()` already computes — the same predicate is now shared by `usageOverTime` and `usageByTool`.
- **Files modified:** convex/toolAnalytics.ts
- **Verification:** The failing test ("filters by source unless source is 'all'") passed after the fix; full 27-test file green.
- **Committed in:** `dfef7428`

**2. [Rule 1 - Bug] Two comments independently tripped the plan's own "All sources" acceptance grep**
- **Found during:** Task 2, running the acceptance-criteria greps before commit
- **Issue:** The `SOURCE_OPTIONS` doc comment and the `useState` default-source comment both used the literal substring `"All sources"` in prose, making `grep -c 'All sources' src/components/ToolUsagePanel.tsx` return `3` instead of the plan's required exactly-`1`. Same class of fix every prior Phase 105 plan (105-01 through 105-05) has independently hit.
- **Fix:** Reworded both comments to describe the same fact ("the widest option's label spells out every source" / "never the widest option") without repeating the literal string.
- **Files modified:** src/components/ToolUsagePanel.tsx
- **Verification:** `grep -c 'All sources' src/components/ToolUsagePanel.tsx` → `1`.
- **Committed in:** `8ac8257d`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — a genuine bug caught by the plan's own required TDD test before any commit, not a shipped defect; 1 Rule 1 — the now-familiar comment-text/acceptance-criteria collision class). No production-behavior deviations from the plan's specified query/component shapes otherwise.

## Mutation Verification (required proof)

Both required mutation proofs were performed — production code temporarily broken, confirmed the corresponding test(s) FAIL, then restored via a scratchpad byte-identical diff before re-running:

| Mutation | Target | Result |
|---|---|---|
| **Task 1's required proof:** `usageByTool`'s `avgDurationMs` guard changed from `agg.durationSamples > 0 ? agg.durationSum / agg.durationSamples : null` to the unguarded `agg.durationSum / agg.durationSamples` | "avgDurationMs === null for a tool with no tool_duration_samples bucket" test | FAILED as required — `expected NaN to be null`. Restored, byte-identical (`diff` confirmed). |
| **Task 3's required proof:** `ToolUsagePanel`'s table cell changed from `typeof row.avgDurationMs === "number" ? formatDurationMs(row.avgDurationMs) : "n/a"` to the unguarded `formatDurationMs(row.avgDurationMs ?? 0)` | Both "avgDurationMs: null renders n/a, 0ms nowhere" AND the dedicated mutation-check test | FAILED as required — the Bash row rendered `0ms` instead of `n/a` (`expected document not to contain element, found <td>...0ms</td>`). Restored, byte-identical (`diff` confirmed). |

Both restores were confirmed via `diff <scratchpad-backup> <live-file>` printing no output before the final test run.

## Class-Closure Check (verification-discipline requirement)

The defect class Task 1's own mutation proof + the Rule-1 fix above both guard against — "a value that should be an honest `null` when unmeasured/absent instead falls back to a fabricated `0`" — was checked across the whole plan's diff: `grep -nE '\|\| 0|\?\? 0' convex/toolAnalytics.ts` returns **zero hits** (no such fallback exists anywhere in the query module, not just off the `avgDurationMs`/`successRate` paths). The one place the pattern would have mattered in `ToolUsagePanel.tsx` (the table cell) is exactly what the Task 3 mutation proof exercised and confirmed guarded.

## Issues Encountered

None beyond the two documented deviations above (one caught by the plan's own mandated TDD/mutation discipline before it ever shipped, one the now-familiar comment/grep collision class).

## User Setup Required

None — no external service configuration required. `npx convex codegen` was run (offline binding regeneration only, confirmed by this project's established precedent from 105-03/104-07) to pick up `api.toolAnalytics.*`; **no `npx convex deploy`, no bulk delete/patch, and no schema push against the live self-hosted instance was run in this plan.** Deployment remains plan 105-09's step.

## Verification (raw output)

`npx tsc --noEmit` — clean, zero output, exit 0 (checked after every task and again after the final `npx convex codegen` regeneration).

`npx vitest run` (full suite):
```
Test Files  269 passed | 17 skipped (286)
     Tests  3365 passed | 193 todo (3558)
```
(The "Not implemented: HTMLCanvasElement's getContext()" lines are pre-existing jsdom/canvas noise from unrelated WebGL-mocked test files — 0 failed tests.)

`npm run build` — succeeded (`✓ built in 1.27s`); pre-existing >500kB chunk-size warning, unrelated to this plan.

Targeted acceptance-criteria greps (all passed, final state):
- `grep -c "ASTRIDR_TOOL_PROVIDER" convex/toolAnalytics.ts` → `6` (≥ 2 required)
- `grep -c '"astridr"' convex/toolAnalytics.ts` → `0`
- `grep -c "\.collect()" convex/toolAnalytics.ts` → `0`
- `grep -c "by_provider_time" convex/toolAnalytics.ts` → `1`
- `grep -cE '\|\| 0|\?\? 0' convex/toolAnalytics.ts` → `0`
- `npx vitest run convex/toolAnalytics.test.ts` → 27 tests, exit 0 (≥ 12 required)
- `grep -Ei '#[0-9a-f]{3,8}' src/components/ToolUsagePanel.tsx | grep -v '^\s*//'` → zero matches
- `grep -c 'All sources' src/components/ToolUsagePanel.tsx` → `1`; `grep -cE '>All<' src/components/ToolUsagePanel.tsx` → `0`
- `grep -c 'useState.*"astridr"' src/components/ToolUsagePanel.tsx` → `1`
- `grep -c "SectionErrorBoundary" src/components/ToolUsagePanel.tsx` → `0`
- `grep -c "dangerouslySetInnerHTML" src/components/ToolUsagePanel.tsx` → `0`
- `grep -c "no refresh needed" src/components/ToolUsagePanel.tsx` → `1`
- `npx vitest run src/components/ToolUsagePanel.test.tsx` → 10 tests, exit 0 (≥ 8 required)
- `grep -c toolAnalytics convex/_generated/api.d.ts` → `2`
- `git diff --stat` (across all three commits) → exactly `convex/toolAnalytics.ts`, `convex/toolAnalytics.test.ts`, `src/hooks/useToolUsage.ts`, `src/components/ToolUsagePanel.tsx`, `src/components/ToolUsagePanel.test.tsx`, plus the regenerated `convex/_generated/api.d.ts` — no `src/pages/`, `src/App.tsx`, or `src/lib/navRegistry.ts` (finding F5)
- `git diff --stat package.json package-lock.json` → empty (T-105-SC: zero packages installed)

## Metric-Type Names Used (per this plan's `<output>` requirement)

Read exactly the four metric-type names 105-04-SUMMARY.md documents as authoritative: `tool_calls`, `tool_failures`, `tool_duration_ms`, `tool_duration_samples`, `period: "hourly"`, `dimensions: { tool, provider }`. **These matched the plan's own finding F2 listing verbatim — no divergence to report.**

## Known Stubs

None. `ToolUsagePanel` is fully wired to live Convex queries via the hooks in `useToolUsage.ts` — no hardcoded/mock data anywhere. It is simply not yet reachable from any route (105-08's scope, by design — finding F5).

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-105-26 through T-105-30, T-105-SC) — this plan introduced no new trust boundary, endpoint shape, or schema change beyond the three public queries the threat model already names.

## Next Phase Readiness

- Plan 105-08 can mount `ToolUsagePanel` on the new Tools page and wrap it in a page-level `SectionErrorBoundary` (D-16) — the component takes no required props and is self-contained.
- Plan 105-09 owns deployment: the live self-hosted instance still runs pre-105-06 code, so `usageOverTime`/`usageByTool`/`recentExecutionsBySource` have never executed against real aggregate/toolExecutions data. Live verification of the Ástríðr-default view against real tool-call volume, and the six-theme sweep, are both explicitly deferred there per this plan's own `<verification>` section.
- No blockers for 105-07 (policy feed UI, independent read surface) or 105-08.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 6 key files confirmed present on disk (`convex/toolAnalytics.ts`, `convex/toolAnalytics.test.ts`,
`src/hooks/useToolUsage.ts`, `src/components/ToolUsagePanel.tsx`, `src/components/ToolUsagePanel.test.tsx`,
`.planning/phases/105-tool-trace-observability/105-06-SUMMARY.md`); all 3 task commit hashes
(`dfef7428`, `8ac8257d`, `90a7919b`) confirmed present in `git log`.
