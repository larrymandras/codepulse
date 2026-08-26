---
phase: 122-tokens-primitives-contrast-measurement
plan: 16
subsystem: ui
tags: [react, empty-state, honesty-sweep, tailwind, hydration, convex]

# Dependency graph
requires:
  - phase: 122-09
    provides: "src/lib/metricState.ts and src/hooks/useMetricState.ts, the six-state vocabulary"
  - phase: 122-13
    provides: "src/components/MetricCard.tsx's state contract (read-only reference, not modified)"
  - phase: 122-15
    provides: "InlineMetricState (cell-scale renderer) and LoadingState wired up; the ledger style and files_modified boundary this plan continues from"
provides:
  - "Zero value-slot em-dash placeholders remaining anywhere in src/ -- closes the em-dash half of D-15 across the full corpus (122-14 MetricCard sites, 122-15 components-root, 122-16 subtrees + page tier)"
  - "RadialGauge.tsx gains an optional loading prop distinguishing still-loading from resolved-but-absent, wired from VitalsRail.tsx and SystemMonitorPanel.tsx's useSystemResources() call"
  - "122-LOADING-LEDGER-SUBTREES.md, the per-site record for the 14-file slice"
  - "A hydration-safety rule for InlineMetricState: its loading branch renders a block-level Skeleton, so it must never sit inside a <p> when its state prop can resolve to \"loading\" -- documented in both edited files and worth carrying into any future call site with a dynamic state"
affects: [ui-honesty-sweep, wave-6-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useMetricState applied directly to a hand-rolled (non-MetricCard) stat card to split loading from a genuine empty/zero-event result, rather than leaving the two collapsed into one dash"
    - "A shared component whose render depends on caller-supplied loading state (RadialGauge) grows an optional, default-false prop rather than inferring loading from the value alone -- backward compatible, opt-in per caller"
    - "InlineMetricState's icon-bearing render is span-only when its state is a literal (e.g. state=\"empty\"), but its loading branch renders a block-level Skeleton -- any call site whose state prop is a variable that can be \"loading\" must not nest it inside a <p>"

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/122-LOADING-LEDGER-SUBTREES.md
  modified:
    - src/components/analytics/AdvisorStrategyPanel.tsx
    - src/components/analytics/RecentLlmCallsPanel.tsx
    - src/components/brains/SwapHistoryList.tsx
    - src/components/chat/RadialGauge.tsx
    - src/components/chat/VitalsRail.tsx
    - src/components/control-center/SystemMonitorPanel.tsx
    - src/components/forge/ForgeJobList.tsx
    - src/components/graph/CodeVaultGraph.tsx
    - src/components/kg/KGAnimateControls.tsx
    - src/components/skills/IntakeReportView.tsx
    - src/components/studio/MediaDetailSheet.tsx
    - src/pages/Executions.tsx
    - src/pages/Infrastructure.tsx
    - src/pages/Security.tsx

key-decisions:
  - "SwapHistoryList: row.target -> InlineMetricState(empty) since it's an independently-optional field with no sibling explanation; row.resolved -> plain \"n/a\" since describeSwapOutcome already explains a missing resolved value via the adjacent outcome label (Unresolved/Refused) rendered in the same row -- two different verdicts for two dashes on the same line"
  - "RadialGauge gained a loading prop instead of inferring loading from value==null, because value==null is genuinely ambiguous (still-loading vs resolved-with-no-metric) and both callers already hold the true signal via useSystemResources()'s undefined-while-loading contract -- the fix threads an existing signal through rather than fabricating a new inference"
  - "VitalsRail/SystemMonitorPanel's Tok/s, Latency, and (VitalsRail only) context-tokens figures all use state=\"empty\" not a loading/empty split, because useLlmMetrics coalesces loading and empty into one [] by its own documented convention (matching SwapHistoryList's precedent) -- there is no live signal available at these call sites to split further"
  - "ForgeJobList's PendingRow prompt fallback was changed to plain text \"(no prompt)\" rather than InlineMetricState, to match the real job list's own identical fallback 30 lines below verbatim -- in-file consistency for the same concept beat introducing a second phrasing"
  - "KGAnimateControls' frame-date readout uses plain text \"no frames\", not InlineMetricState, because an icon-bearing pill would widen a fixed min-w-[80px] transport-row slot whose sibling controls are already visually disabled in that state -- same footprint-stability precedent 122-15 established for SwarmTaskNode"
  - "Executions.tsx's four stat cards split via useMetricState(stats, undefined): Total/Running/Failed show a loading Skeleton only (stats always has those fields once resolved, no genuine empty case), while Avg Duration gets a three-way split (loading Skeleton / InlineMetricState(empty) for a resolved-but-no-completions stats object / the real figure) since avgDuration alone can be genuinely null post-resolve"

requirements-completed: [TOKEN-04]

# Metrics
duration: 29min
completed: 2026-08-19
---

# Phase 122 Plan 16: Component Subtrees + Page Tier Em-Dash Migration Summary

**Converted the last 33 value-slot em-dash placeholders across 14 component-subtree and page-tier files to explicit states from the shared vocabulary, added a `loading` prop to `RadialGauge` to stop conflating still-loading with resolved-but-absent, and fixed a live hydration bug (a block-level `Skeleton` nested inside a `<p>`) discovered during Playwright verification against real Convex data.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-08-19T18:54:36Z
- **Completed:** 2026-08-19T19:23:56Z
- **Tasks:** 3 (population re-derivation + ledger, component-subtree conversion, page-tier conversion + live verification)
- **Files modified:** 15 (14 source files + 1 new ledger doc)

## Accomplishments

- Re-derived this plan's em-dash population directly against its own 14-file `files_modified` list (168 raw fixed-string occurrences, 26 quoted-string literals, 1 bare-JSX text node, 5 template-literal prose em-dashes), reconciling every count against CONTEXT.md's stale figure rather than adopting it.
- Every one of the 33 value-slot placeholders across the 14 files converted to the state the site could actually justify: 21 `InlineMetricState(empty)` D-20 overrides, 2 `n/a` (structurally inapplicable / explained by a sibling field), 3 plain text (footprint-stability precedent), and a `useMetricState`-driven loading/empty split on 2 hand-rolled tile-scale stat cards.
- `RadialGauge.tsx` gained a backward-compatible optional `loading` prop so its two callers (`VitalsRail.tsx`, `SystemMonitorPanel.tsx`) can distinguish "still loading" from "resolved, no value" instead of rendering the identical dash for both.
- Found and fixed a real hydration bug live: `InlineMetricState`'s `"loading"` branch renders a block-level `Skeleton`, which is invalid nested inside a `<p>`. This fired in exactly the two places in this plan where the `state` prop was a variable that could resolve to `"loading"` (`AdvisorStrategyPanel.tsx`'s Escalation Rate card, `Executions.tsx`'s four stat cards) — every other call site in this plan passes a literal `state="empty"` (span-only, safe). Fixed by switching those five value-slot wrappers from `<p>` to `<div>`.
- Live-verified against real Convex data (Playwright, `dev:noauth`, Clerk disabled) on `/executions`, `/infrastructure`, `/security`, and `/analytics`: zero console errors, real values rendering where data existed, and one genuinely-still-loading query (`advisorEvents.recent`) rendering an honest skeleton rather than a fabricated dash — with `Total Savings` on the same panel as the succeeding-query control.
- 135 legitimate-typography em dashes (section-header comment rules, JSDoc prose, real rendered sentences using the dash as a separator) verified in context and left untouched — none converted on sight.

## Task Commits

1. **Task 1: Re-derive this slice's em-dash population and open the ledger** — `a1643755` (docs)
2. **Task 2: Convert the component-subtree em-dash sites** — `2cffb48c` (feat)
3. **Task 3: Convert the page-tier em-dash sites and verify against a real failure** — `b9aa2f8d` (feat) — includes the `AdvisorStrategyPanel.tsx` hydration fix found during this task's live-verification step (amended once after commit to fix a `$0.00` -> `$0` shell-variable-expansion typo in the commit message itself; `git show -s` confirms HEAD was still my own just-created commit, no concurrent work, before the amend)

## Files Created/Modified

- `.planning/phases/122-tokens-primitives-contrast-measurement/122-LOADING-LEDGER-SUBTREES.md` — per-site record, population re-derived with unit+scope, two comparison patterns, reconciled against CONTEXT.md
- `src/components/chat/RadialGauge.tsx` — optional `loading` prop; numeral slot renders a `Skeleton` while loading, plain `n/a` text when resolved-but-absent
- `src/components/chat/VitalsRail.tsx`, `src/components/control-center/SystemMonitorPanel.tsx` — wire `loading={sys === undefined}` into `RadialGauge`; `Meter`/inline value slots convert to `InlineMetricState(empty, "no signal yet")`
- `src/components/analytics/AdvisorStrategyPanel.tsx` — `useMetricState` splits loading from a genuine zero-event empty result; hydration fix (`<p>` → `<div>`)
- `src/components/analytics/RecentLlmCallsPanel.tsx`, `src/components/skills/IntakeReportView.tsx`, `src/components/graph/CodeVaultGraph.tsx`, `src/components/studio/MediaDetailSheet.tsx`, `src/pages/Infrastructure.tsx`, `src/pages/Security.tsx` — per-row/per-field `InlineMetricState(empty)` D-20 overrides
- `src/components/brains/SwapHistoryList.tsx` — `target` → `InlineMetricState(empty)`; `resolved` → `n/a` (already explained by the sibling outcome label)
- `src/components/forge/ForgeJobList.tsx` — `safeRelativeTime` returns `null` instead of a dash string; `PendingRow`'s prompt fallback matches the real job list's existing `(no prompt)` convention
- `src/components/kg/KGAnimateControls.tsx` — plain `"no frames"` text for the transport-row frame readout
- `src/pages/Executions.tsx` — `useMetricState(stats, undefined)` drives all four stat cards; hydration fix (`<p>` → `<div>` on all four value slots)

## Decisions Made

See `key-decisions` in frontmatter. The most consequential one operationally: the hydration-safety rule discovered mid-plan (`InlineMetricState`'s loading branch is block-level, so it cannot sit inside a `<p>` when its `state` prop is dynamic) — every future call site passing a non-literal `state` should default to a `<div>` wrapper, not a `<p>`, unless the state is provably never `"loading"`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `InlineMetricState`'s loading branch (block-level `Skeleton`) nested inside a `<p>` — React hydration error**
- **Found during:** Task 3's live-verification step (Playwright against `dev:noauth` with real Convex data)
- **Issue:** `AdvisorStrategyPanel.tsx`'s Escalation Rate card passed `advisorRecentState` (a variable that can be `"loading"`) to `InlineMetricState` inside a `<p className="text-2xl ...">`. When the state resolved to `"loading"`, `InlineMetricState` rendered a `<Skeleton>` (a `<div>`) as a child of that `<p>` — invalid HTML, and React logged "In HTML, %s cannot be a descendant of %s. This will cause a hydration error." `Executions.tsx`'s four stat cards had the identical shape (a conditional `<Skeleton>` inside a `<p>`).
- **Fix:** Switched the five affected value-slot wrappers from `<p>` to `<div>` (`AdvisorStrategyPanel.tsx` ×1, `Executions.tsx` ×4). Grepped every `Skeleton`/`InlineMetricState` call site this plan introduced to confirm no other instance of the same shape exists — every other call site passes a literal `state="empty"`, which `InlineMetricState` always renders as an inline `<span>` (safe inside a `<p>`), so the defect class is fully accounted for, not just the two instances found live.
- **Files modified:** src/components/analytics/AdvisorStrategyPanel.tsx, src/pages/Executions.tsx
- **Verification:** Re-ran the Playwright check after the fix — zero console errors across four page loads (`/executions`, `/infrastructure`, `/security`, `/analytics`); `npx tsc --noEmit` and full `npx vitest run` both re-confirmed clean afterward.
- **Committed in:** b9aa2f8d (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug). Necessary for correctness — an uncaught bug would have shipped a live hydration error on two of the plan's own converted surfaces. No scope creep.

## Issues Encountered

- The dev server at `:5173` gates behind Clerk (`Sign in to access the telemetry dashboard`), which blocked the plan's required live-verification step. Started `dev:noauth` (`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`, issued from Git Bash per this repo's own documented gotcha) on `:5181` instead — this repo's memory already documents this exact recipe.
- Wrote throwaway Playwright scripts (`.mjs`) directly in the repo root (required so Node resolves the `playwright` package from `node_modules` — running from the scratchpad directory hit `ERR_MODULE_NOT_FOUND`) and deleted them before committing; confirmed `git status --short` showed only the intended 4 source files before staging.
- `git commit -m` mangled a literal `$0.00` in the commit message into `/usr/bin/bash.00` (Bash interpreted `$0` as a positional parameter). Verified `HEAD` was still my own just-created, unshared commit (`git log -1 --format=%H` matched, no concurrent commit had landed) before amending with `git commit --amend -F <file>` to fix the message text only — no file content changed, confirmed by `git show HEAD --stat` reporting the identical 4 files / 64+/-23- both before and after.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 6 (122-14 MetricCard render sites, 122-15 Loading-string + components-root em-dashes, 122-16 subtrees + page tier) is now complete: zero bare `>Loading` strings and zero value-slot em-dash placeholders remain anywhere in `src/`.
- `RadialGauge`'s new `loading` prop and the `<p>`-vs-`<div>` hydration-safety rule for dynamic-state `InlineMetricState` call sites are available for any later plan touching these files.
- Suite baseline exiting this plan: 345 files / 4858 passed / 0 failed (unchanged from entering it). `tsc --noEmit` and `npm run build` both exit 0.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

All 15 claimed files found on disk (the ledger doc, 13 modified source files, this
SUMMARY.md). All 3 task commit hashes (`a1643755`, `2cffb48c`, `b9aa2f8d`) found in
`git log --oneline --all`.
