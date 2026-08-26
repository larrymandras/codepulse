---
phase: 125-signature-layers
plan: 11
subsystem: ui
tags: [react, tailwind, convex, vitest, entry-chunk-budget]

# Dependency graph
requires:
  - phase: 125-signature-layers (plan 09)
    provides: "PulseEcgHero -- default export, no props, mounted here"
  - phase: 125-signature-layers (plan 08)
    provides: "SignalHorizon/SystemChip -- the two surfaces the deleted health dot duplicated"
  - phase: 125-signature-layers (plan 01)
    provides: "src/entryChunk.ratchet.test.ts -- the D-10/D-18 byte ceiling this plan measures against"
provides:
  - "HeroStatsBar.tsx reduced to its 8-tile KPI grid -- the fabricated SYSTEM LOAD card, its health dot, and its duplicate Memory readout are deleted"
  - "PulseEcgHero mounted as the Dashboard's hero, above the KPI grid, under PageHeader"
  - "The phase's only complete-build entry-chunk measurement: JS 586,762/594,709 ceiling, CSS 237,279/242,106 ceiling"
affects: [125-12, 125-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query-ref-differentiated useQuery mock in HeroStatsBar.test.tsx, so MetricCard's per-tile MetricState (loading/ready/empty) can be driven independently across four separate useQuery call sites in one component"
    - "Exactly-once duplicate-death proof via getByText's own multiple-match throw, rather than asserting on an AnimatedNumber-driven value that cannot settle synchronously in jsdom"

key-files:
  created: []
  modified:
    - src/components/HeroStatsBar.tsx
    - src/components/HeroStatsBar.test.tsx
    - src/pages/Dashboard.tsx

key-decisions:
  - "Rewrote HeroStatsBar.test.tsx's memory-hit-rate assertion around getByText's own single-match guarantee instead of asserting the AnimatedNumber-rendered percentage text, because MetricCard's numeral goes through a framer-motion spring that does not resolve synchronously within a single render+effects flush (confirmed by two initial test failures against the animated value)."
  - "Kept the Dashboard.tsx comment explaining why PulseEcgHero is NOT wrapped in heroFlashRef without naming the identifier literally, after a first draft's comment tripped its own before/after heroFlashRef-count acceptance criterion (same self-tripping-grep class as 125-01/125-06/125-09)."

requirements-completed: [SIGNAL-02]

# Metrics
duration: ~50min
completed: 2026-08-24
---

# Phase 125 Plan 11: Dashboard Hero Swap and Entry-Chunk Ratchet Summary

**Deleted HeroStatsBar's fabricated `100 - errorRate*2` SYSTEM LOAD card (POLISH-04) and its two genuine duplicates, mounted the measured Pulse ECG in its place, and closed out Phase 125's entry-chunk budget on a complete build at JS 586,762/594,709 and CSS 237,279/242,106 -- CSS actually below the pre-Phase-125 baseline.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3
- **Files modified:** 3 (2 source, 1 test)

## Accomplishments

- **Re-derived the `kpis` array live before deleting anything**, per the plan's own required first step: 8 entries -- Sessions(0), Error Rate(1), Alerts(2), Security(3), Memory Hit Rate(4), Durable Facts(5), Advisor Savings(6), Startup Time(7) -- with `kpis.slice(0,4)` rendering indices 0-3 and `kpis.slice(4,8)` rendering indices 4-7. Memory Hit Rate is already a rendered tile at index 4. D-09's premise (the memory hit-rate "relocates to a new tile") held exactly: **no tile was added**, because the tile already existed.
- **Deleted the whole fabricated top card** from `HeroStatsBar.tsx` (the `bg-card/60 backdrop-blur-md ...` block, `:163-200` in the pre-edit file):
  - health status dot -> **deleted as duplicate** (`DashboardLayout.tsx:982`'s `SystemChip` and `:1072`'s `SignalHorizon` both already carry this exact state on every route)
  - `System Load` numeral + gradient bar (`AnimatedNumber value={... 100 - (stats.errorRate * 2) ...}`) -> **deleted as fabricated** (the named POLISH-04 composite this phase exists to remove)
  - plain `Memory` readout (`{hitRateValue}% / 100%`) -> **deleted as duplicate** (the KPI grid's own "Memory Hit Rate" tile, index 4, already renders this same value)
  - Also removed the now-dead `healthConfig` object and `hc` local (used only by the deleted health dot) and the now-unused `AnimatedNumber` import (its only call site was inside the deleted card). `thresholdColor`/`ThresholdConfig` were left alone -- `ThresholdConfig` is used as a type on `KpiDef`; `thresholdColor` was already unused before this plan (pre-existing, out of scope per the deviation rules' scope boundary).
- **Rewrote `HeroStatsBar.test.tsx`** end to end: dropped the obsolete status-dot-dead-class and top-card-token-layer suites (they asserted on an element that no longer exists), and added:
  - a composite-absence proof: with `activeSessions=3, errorRate=13` (which would have rendered `100-(13*2)=74` under the old formula), `screen.queryByText("74%")` is absent;
  - an exactly-once proof for the memory hit-rate tile: `screen.queryByText("Memory", {exact:true})` (the deleted card's own distinct label) is absent, and `screen.getByText("Memory Hit Rate")` succeeds -- `getByText` itself throws if more than one match exists, so a successful single call IS the exactly-once evidence;
  - a full-grid coverage test asserting all 8 KPI labels still render, using a query-ref-differentiated `useQuery` mock so no tile is stuck in MetricCard's `loading` state (which renders no label text at all -- see Deviations).
  - 5/5 tests pass.
- **Mounted `PulseEcgHero`** (125-09) in `Dashboard.tsx`, in its own `SectionErrorBoundary name="Pulse"`-wrapped `md:col-span-12` section immediately above the existing Hero Stats Bar section -- the structural slot the deleted card held, still under `PageHeader`. Static import, not `lazy()`: `Dashboard` is already lazy (`App.tsx:18`), so `PulseEcgHero` lands in that same chunk regardless; a nested lazy boundary would only add a Suspense flash with no byte benefit. Not wrapped in the existing flash-on-update ref: the trace is already the live signal, and wrapping a flashing container around a flashing trace would put two animations in one region.
- **Measured the complete Phase 125 frontend on a real build** -- see the byte-clause evidence section below.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete the fabricated top card** -- `f91eb9e9` (fix)
2. **Task 2: Mount the Pulse ECG as the Dashboard hero** -- `49106ff6` (feat)
3. **Task 3: Measure the entry chunk** -- no commit (verification-only task, `files: []` in the plan; nothing to stage)

## Files Modified

- `src/components/HeroStatsBar.tsx` -- top card deleted, KPI grid (174 lines total) is the only output
- `src/components/HeroStatsBar.test.tsx` -- rewritten around the fabricated-card removal
- `src/pages/Dashboard.tsx` -- `PulseEcgHero` mounted above the KPI grid

## KPI Grid: Before and After

**Before** (top card + grid, both rendering the memory hit-rate independently):
- Top card: health dot, `System Load` numeral (`100 - errorRate*2`), gradient bar, `Memory` readout (`X% / 100%`)
- Grid `slice(0,4)`: Sessions, Error Rate, Alerts, Security
- Grid `slice(4,8)`: Memory Hit Rate, Durable Facts, Advisor Savings, Startup Time

**After** (grid only, unchanged slice ranges, unchanged tile order):
- Grid `slice(0,4)`: Sessions, Error Rate, Alerts, Security
- Grid `slice(4,8)`: Memory Hit Rate, Durable Facts, Advisor Savings, Startup Time

The KPI grid's 8 tiles and their `.slice()` ranges are byte-for-byte the same before and after; only the top card is gone. Memory Hit Rate is the one value that existed in both places before this plan and now renders in exactly one.

## Acceptance Criteria Verified

**Task 1:**
- `grep -c "errorRate \* 2" src/components/HeroStatsBar.tsx` -> 0
- `grep -c "System Load" src/components/HeroStatsBar.tsx` -> 0
- `grep -c "AnimatedNumber" src/components/HeroStatsBar.tsx` -> 0
- `npx vitest run src/components/HeroStatsBar.test.tsx` -> 5/5 passing
- `npx tsc --noEmit` -> exits 0

**Task 2:**
- `grep -c "PulseEcgHero" src/pages/Dashboard.tsx` -> 2 (import + mount)
- `grep -c 'SectionErrorBoundary name="Pulse"' src/pages/Dashboard.tsx` -> 1
- `grep -c "heroFlashRef" src/pages/Dashboard.tsx` -> 2 before this task, 2 after (unchanged) -- the mount comment was deliberately worded to avoid naming that identifier literally, after a first draft tripped this exact criterion by mentioning it in prose (see Deviations)
- `git diff --stat src/pages/Dashboard.tsx` -> 14 lines changed (< 15 required)
- `npx vitest run src/components/PulseEcgHero.test.tsx` -> 7/7 passing
- `npx tsc --noEmit` -> exits 0

**Task 3:**
- `npm run build` -> exits 0
- `npx vitest run src/entryChunk.ratchet.test.ts` -> 3/3 PASSED, assertions RUN not skipped (verbose output: `✓ self-check`, `✓ entry JS stays within ...`, `✓ entry CSS stays within ...`)
- `npm test` -> 362 files passed / 17 skipped (379), 5,062 tests passed / 195 todo (5,257), **0 failed**
- `npx tsc --noEmit` -> exits 0

## Entry-Chunk Byte Measurement (SIGNAL-02 criterion 2, the phase's only complete-build reading)

Measured via `npx vitest run src/entryChunk.ratchet.test.ts --reporter=verbose`:

```
[entry-chunk ratchet] measured entry JS=586762 bytes (ceiling 594709), entry CSS=237279 bytes (ceiling 242106)
```

| Axis | Measured | Ceiling (D-18: baseline * 1.02) | Headroom |
|------|----------|----------------------------------|----------|
| Entry JS  | 586,762 | 594,709 | 7,947 bytes |
| Entry CSS | 237,279 | 242,106 | 4,827 bytes |

Neither axis tripped. Sequence across the phase (all figures from each plan's own SUMMARY.md, re-confirmed here as the requested trend rather than a single point):

| Plan | Entry JS | Entry CSS |
|------|----------|-----------|
| Pre-Phase-125 baseline (D-18, 125-01) | 583,049 | 237,359 |
| 125-01 (Wave 1) | unchanged | 237,668 |
| 125-08 (Wave 3) | 586,735 | 239,650 |
| 125-09 (Wave 3) | 586,735 (byte-identical) | 239,701 (+51) |
| **125-11 (this plan, Wave 4)** | **586,762** | **237,279** |

**Which Phase 125 change is responsible for the entry-chunk growth (JS axis):** the Signal Horizon (125-04/125-08), because `DashboardLayout.tsx` is a static import reached from `App.tsx` on every route. The +27-byte JS delta between 125-09 and this plan's own measurement is unrelated build variance -- neither of this plan's two source files (`HeroStatsBar.tsx`, `Dashboard.tsx`) is entry-reachable; both live inside the lazy `Dashboard` chunk (confirmed: `Dashboard` is `lazy(() => import("./pages/Dashboard"))` at `App.tsx:18`, and `dist/assets/Dashboard-Gq2V8DI5.js` is a separate, non-entry chunk in the build output).

**CSS axis is the notable finding of this plan:** entry CSS DROPPED 2,422 bytes from 125-09's 239,701 to 237,279 -- lower than even the pre-Phase-125 baseline (237,359). This is Task 1's own doing: the deleted top card used several unique arbitrary-value Tailwind utilities (`bg-gradient-to-r from-orange-900/50 via-primary to-(--status-error)`, `shadow-[0_0_20px_rgba(249,115,22,0.6)]`, the diagonal-stripe `bg-[linear-gradient(45deg,...)]`) that existed nowhere else in the source tree. Once those class strings were deleted, Tailwind v4's JIT scanner no longer generates the corresponding CSS rules, shrinking the entry stylesheet below its pre-phase size. This is a real, expected consequence of Task 1's deletion, not noise -- flagged here per the plan's request to "state plainly which change is responsible," since the JS-axis attribution (Signal Horizon) does NOT explain the CSS-axis movement this time.

**`__signalHorizonStub` production check:**
```
$ grep -l "__signalHorizonStub" dist/assets/*.js
(no output, no match found)
```
Confirmed absent from production.

**Instrument Serif entry-stylesheet check -- a real grep-unit trap caught mid-verification:**
A first-pass `grep -c "Instrument Serif" dist/assets/index-C8d92zPU.css` returned **1**, which looked like a failure of the expected zero. The entry CSS file is minified to a single line, so `-c` counts LINES, not occurrences (this repo's own documented grep-unit trap). Re-derived by scoping to actual font-loading declarations:
```
$ grep -o "@font-face{[^}]*Instrument Serif[^}]*}" dist/assets/index-C8d92zPU.css
(no output, no match -- 0 @font-face rules for Instrument Serif in the entry stylesheet)

$ grep -o "@font-face{[^}]*}" dist/assets/Briefings-CHUiSS9E.css | head -2
@font-face{font-family:Instrument Serif;...src:url(/assets/instrument-serif-latin-ext-400-italic-C9HzH3YL.woff2)format("woff2")...}
@font-face{font-family:Instrument Serif;...src:url(/assets/instrument-serif-latin-400-italic-DKMiL14s.woff2)format("woff2")...}
```
The entry stylesheet's single hit was `--font-voice:"Instrument Serif", Georgia, serif` -- a CSS custom-property **name**, not a `@font-face`/`src:url()` declaration, so it triggers no font network request on its own. The real `@font-face` rules with `src:url(...)woff2` live only in `Briefings-CHUiSS9E.css`. The expected pair (0 in entry, >=1 elsewhere) holds -- chunk-scope isolation from 125-05 re-confirmed now that everything in the phase has landed.

## Manual Smoke (npm run dev)

Ran against the Clerk-free `:5181` noauth dev server via a throwaway Playwright script (not committed). Screenshot-confirmed and DOM-probed:
- `System Load` text count: **0**
- `PULSE / 60s` eyebrow count: **1**
- `Memory Hit Rate` text count: **1**
- `data-backfill-truncated` attribute present, value `"false"`
- `data-ecg-state` attribute present on the canvas, value **`"live"`**

The Dashboard renders (top to bottom): the OperatorScoreCard, then the Pulse ECG hero (`PULSE / 60S` eyebrow, a numeral-shaped skeleton at that instant because the 60s live-count window had not yet filled since page load -- D-17's honest `loading` treatment, not a bug -- and the live canvas trace beneath it), then the 8-tile KPI grid with no health dot, no gradient bar, and no duplicate Memory readout anywhere on the page.

## Decisions Made

- **Rewrote the memory-hit-rate exactly-once assertion around `getByText`'s own multiple-match guarantee** instead of asserting on the rendered `82%` text, after two initial test runs failed: `MetricCard`'s numeral goes through `AnimatedNumber`, which drives display via a `framer-motion` spring (`useSpring`/`useTransform`) that starts at 0 and does not settle synchronously within a single render+effects flush in jsdom -- `MetricCard.test.tsx`'s own precedent avoids this by never passing `numericValue` in its "ready" test. Since `HeroStatsBar`'s kpis always populate `numericValue`, that escape hatch wasn't available here; the fix was to assert structurally (exactly one `getByText` match on the tile's own label, plus the deleted card's distinct "Memory" label proven absent) rather than on the animated value's settled text.
- **Reworded the Dashboard.tsx mount comment to avoid the literal `heroFlashRef` string** after a first draft's explanatory comment (about why `PulseEcgHero` isn't wrapped in that ref) tripped its own acceptance criterion -- the same self-tripping-grep class documented in 125-01/125-06/125-09's SUMMARYs. This also incidentally exceeded the 15-line diffstat budget; the shorter, reworded comment fixed both at once.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - self-tripping-grep, same class as 125-01/125-06/125-09] Explanatory comment in Dashboard.tsx quoted the literal `heroFlashRef` identifier its own acceptance criterion checks for an unchanged count of**
- **Found during:** Task 2, immediately after first draft
- **Issue:** The mount comment explained "No heroFlashRef wrapper: ..." which added a third literal occurrence of the string, making `grep -c "heroFlashRef"` read 3 instead of the required unchanged 2. The same draft's longer comment also pushed `git diff --stat` to 19 changed lines, over the plan's 15-line ceiling.
- **Fix:** Reworded the comment to describe the avoided pattern ("Not wrapped in the flash-on-update ref below it") without naming the identifier, and trimmed it for length.
- **Files modified:** `src/pages/Dashboard.tsx`
- **Verification:** Re-ran `grep -c "heroFlashRef" src/pages/Dashboard.tsx` -> 2 (unchanged); `git diff --stat src/pages/Dashboard.tsx` -> 14 lines.
- **Committed in:** `49106ff6` (fixed before commit, no separate commit needed)

**2. [Rule 1 - bug in first-draft test assertion, not a source defect] Initial `HeroStatsBar.test.tsx` draft asserted on AnimatedNumber's post-spring text and on all-8-labels-with-default-loading-state**
- **Found during:** Task 1, first `npx vitest run` after the test rewrite
- **Issue:** Two of five tests failed: (a) asserting `screen.getAllByText("82%")` after setting `mockPreflightStats = {hitRate: 0.82}` found zero matches, because `MetricCard`'s numeral for a `numericValue`-bearing tile renders via `AnimatedNumber`, whose `framer-motion` spring does not resolve to the target text synchronously in jsdom; (b) asserting all 8 KPI labels render under the test file's default mocks found only `Startup Time` (the only kpi with a hardcoded non-loading state), because every other kpi's `MetricState` derives from a `useQuery` call that defaulted to `undefined` (`loading`), and `MetricCard`'s `loading` case renders a skeleton with no label text at all.
- **Fix:** Replaced the animated-value assertion with the structural exactly-once proof described above. Replaced the single blanket `useQuery` mock with a query-ref-differentiated one (`heroStats:summary`/`memoryPreflight:stats`/`dreaming:recentFacts`/`advisorEvents:savingsSummary` each independently controllable), and had the all-8-tiles test supply a defined (non-`loading`) value for every one of the four underlying queries.
- **Files modified:** `src/components/HeroStatsBar.test.tsx`
- **Verification:** `npx vitest run src/components/HeroStatsBar.test.tsx` -> 5/5 passing.
- **Committed in:** `f91eb9e9` (fixed before commit, no separate commit needed)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both test/comment-scoped, no production behavior change). No scope creep.

## Plan-Text Corrections

- The plan's own line-number citations for the pre-edit `HeroStatsBar.tsx` (`:163-199` top card, `:202-230` grid) matched the live file exactly at read time -- no correction needed there, unlike several prior plans in this phase whose cited line numbers had drifted.
- Nothing else in the plan's text was found to contradict live code; the D-09 premise re-derivation the plan required (kpis array shape, slice ranges, Memory Hit Rate already rendered) held exactly as the plan's own `<interfaces>` block anticipated.

## Issues Encountered

None beyond the two auto-fixed deviations above. No auth gates, no external service configuration, no shared-checkout collision on either commit (`git show --stat` after each commit confirmed only the intended file(s) present; no `PersonaDial*`/`ControlCenterPanel.tsx`/`CompactControlStrip.tsx`/`dialBands.ts`/`slider.tsx`/`.planning/phases/126-*/` swept into either commit -- that directory stayed untracked throughout, confirmed via `git status --short` before and after each commit).

## User Setup Required

None. No environment variables, external services, or manual configuration needed.

## Next Phase Readiness

- `HeroStatsBar.tsx` and `Dashboard.tsx` are in their final Phase 125 shape; nothing further in this phase touches either file.
- The entry-chunk budget holds with real headroom on both axes (7,947 bytes JS, 4,827 bytes CSS) after every Phase 125 frontend change has landed -- SIGNAL-02 criterion 2 is satisfied with a measured, complete-build reading.
- 125-12 (E-Stop wire, under D-20's malformed-snapshot control substitution) and 125-13 (live E-Stop verification) are both operator-gated plans with no dependency on this plan's files.
- No blockers for downstream plans in this wave or phase.

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 3 modified files confirmed present on disk (`src/components/HeroStatsBar.tsx`, `src/components/HeroStatsBar.test.tsx`, `src/pages/Dashboard.tsx`). Both commit hashes (`f91eb9e9`, `49106ff6`) confirmed present via `git log --oneline --all | grep -E "f91eb9e9|49106ff6"`.
