---
phase: 104-cost-intelligence
plan: 10
subsystem: frontend
tags: [convex, cost-intelligence, react, design-tokens, flexbarchart]

# Dependency graph
requires:
  - phase: 104-05
    provides: "convex/costDerived.ts's costOverTime/costBreakdown (the single tokens-to-dollars derivation) and CostBreakdown.tsx's data-source rewire onto DerivedRow"
provides:
  - "src/components/CostTrendChart.tsx — Billed / Billed + Covered toggle (D-08) over the derived costOverTime series, fully token-driven"
  - "src/components/CostBreakdown.tsx — hex-to-token remediation completed (data flow unchanged from 104-05)"
affects: [104-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-state segmented toggle composed from the shadcn Button primitive (variant=\"default\"/\"outline\" pair), not a hand-rolled control or Tabs (Tabs' Content-switching semantics didn't fit a same-view display toggle)"
    - "Covered segment color = PROVIDER_COLORS[provider] hex at reduced opacity via `color-mix(in srgb, ${color} 35%, transparent)` — same exempt provider-identity palette, no second color scale"
    - "Status-token color-mix pattern (MetricCard.tsx's severityConfig shape) applied to CostBreakdown's tier-flag/runaway-warning/Opus-row highlighting — module-level exported class-name constants instead of inline ternaries, to keep the JSX diff small"

key-files:
  created:
    - src/components/CostTrendChart.test.tsx
  modified:
    - src/components/CostTrendChart.tsx
    - src/components/CostBreakdown.tsx
    - src/components/CostBreakdown.test.tsx

key-decisions:
  - "Redundant surface wrapper (bg-gray-800/50 border-gray-700/50 rounded-xl p-4) removed entirely rather than retokenized — Analytics.tsx already wraps CostTrendChart in a GlassPanel with its own p-4, so the double surface was purely redundant, not just non-token"
  - "Toggle primitive: Button pair (variant=\"default\" for active, \"outline\" for inactive), not shadcn Tabs — Tabs' TabsContent/view-router semantics (used elsewhere in this codebase as a page-section router) didn't fit a same-view, same-data-source display toggle; a plain aria-labelled button group is simpler and matches UI-SPEC's explicit 'leaves the choice open' note"
  - "Empty-state copy changed from the old 'No API cost data yet.' to 'No cost data yet.' per the plan's own Task 1 action text and UI-SPEC's Copywriting Contract — the 'API' qualifier no longer applies since costOverTime spans all billing types, not just costByPeriodByProvider's billingType:\"api\" filter"
  - "CostBreakdown's hex remediation exports named class-name constants (RUNAWAY_WRAPPER_CLASS, RUNAWAY_BADGE_CLASS, OPUS_ROW_CLASS, etc.) at module scope rather than inlining color-mix expressions in every ternary — keeps the JSX diff scoped to swapping literal class strings for named constants, matching the plan's 'colour-only change, do not restructure the table' instruction"
  - "costByPeriodByProvider (convex/aggregates.ts) was intentionally left untouched — plan 104-10's Task 1 explicitly forbids deleting it since other consumers exist"

patterns-established:
  - "A stacked-bar toggle where one series is a strict superset of the other's segments (Billed segments always present, Covered segments appended only when toggled) — the never-merged guard is structural (separate array entries), not just tested behavior"

requirements-completed: [COST-01]

# Metrics
duration: 12min
completed: 2026-07-31
---

# Phase 104 Plan 10: Cost Trend Toggle + Hex Remediation Summary

**`CostTrendChart` gains a D-08 Billed / Billed + Covered toggle over the derived `costOverTime` series (covered segments render at reduced opacity of the same provider hex, always appended after billed, never summed); both `CostTrendChart` and `CostBreakdown` are now fully token-driven — zero hex outside the exempt `PROVIDER_COLORS` palette.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-31T11:19:00Z (after 104-07 commit)
- **Completed:** 2026-07-31T11:27:06Z
- **Tasks:** 2
- **Files modified:** 3 (1 created: `CostTrendChart.test.tsx`; 2 edited: `CostTrendChart.tsx`, `CostBreakdown.tsx`; 1 test file extended: `CostBreakdown.test.tsx`)

## Accomplishments

- **`CostTrendChart.tsx`** now reads `useQuery(api.costDerived.costOverTime, { period: "hourly", lookbackHours: 24 })` instead of the pre-baked `api.aggregates.costByPeriodByProvider` (D-01). A two-state `Billed` / `Billed + Covered` toggle — a `Button` pair (`variant="default"` active / `"outline"` inactive) inside a `role="group" aria-label="Cost series"` container — defaults to `Billed`. In `Billed` mode, segments come exclusively from `billedByProvider` (D-08's "default view never displays imputed money"). Toggling to `Billed + Covered` appends one additional `StackedSegment` per provider with covered spend, colored `color-mix(in srgb, ${PROVIDER_COLORS[provider]} 35%, transparent)` and labelled `"{name} (covered)"` — billed segments are never mutated, and the two are always separate `segments[]` entries so they can never collapse into one summed value for a provider (D-05). A caption (`"{n} tokens in this window aren't priced and aren't in this chart."`) renders whenever any bucket in the window carries unpriced tokens (D-03), and is absent otherwise. The redundant `bg-gray-800/50 border-gray-700/50 rounded-xl p-4` surface wrapper was removed entirely — `Analytics.tsx:287` already wraps this component in a `GlassPanel` with its own `p-4` — leaving only layout classes. The only hex literals remaining in the file are the two `"#6b7280"` fallback occurrences (the documented `PROVIDER_COLORS` exemption).
- **`CostBreakdown.tsx`**'s hex-to-token remediation (deferred by 104-05, completed here): the tier-flag dot/label colors, the runaway-warning wrapper border/glow/badge/text, the total-cost warn color, and the Opus-tier row/cell highlight all now read `var(--status-ok)` / `var(--status-warn)` / `var(--status-error)` via `color-mix`, following `MetricCard.tsx`'s `severityConfig` convention exactly — `#10b981`/`#ef4444`/`#eab308`/`bg-amber-500/10`/`text-amber-300` are all gone. This was a colour-only change: no field renames, no data-flow changes, no table restructuring — plan 104-05's `billedUsd`/`billedTotal` rewire is untouched.
- **`CostTrendChart.test.tsx`** (new, 9 tests) exercises: empty-state copy, default-Billed-active with zero covered segments, the toggle's never-merged guard (billed segment values byte-identical before/after toggling, using a fixture where the same provider appears in BOTH `billedByProvider` and `coveredByProvider` to actually stress the merge risk), the covered segment's color containing the same provider hex as its billed sibling, the unpriced-tokens caption (present and absent cases), toggle accessibility (`role="group"`, both options as real buttons), the `costOverTime` query binding, and two source-level regex assertions (hex allowlist, no legacy `bg-gray-800`/`border-gray-700`).
- **`CostBreakdown.test.tsx`** extended (+2 tests): a source-level assertion that the file contains no hex literal and no legacy `amber-`/`red-`/`green-`/`yellow-` Tailwind class, plus a render assertion that an Opus-tier row still carries a distinguishing class (`className` matching `/status-warn/`) after the token swap, while a non-Opus row does not — proving the remediation didn't silently drop the signal.
- Full repo suite: 3091/3091 passing (249 files, 193 todo unaffected), `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the Billed / Billed + Covered toggle and move CostTrendChart onto the derived series and design tokens** — `119a6c24` (feat)
2. **Task 2: Complete the hex-to-token remediation on CostBreakdown** — `c37d65e7` (fix)

## Files Created/Modified

- `src/components/CostTrendChart.tsx` — data source rewired to `costDerived.costOverTime`, Billed/Billed+Covered toggle added, redundant surface wrapper removed, empty-state copy changed to `"No cost data yet."`
- `src/components/CostTrendChart.test.tsx` — 9 new tests (toggle behavior, never-merged guard, unpriced caption, accessibility, source-level hex/legacy-class checks)
- `src/components/CostBreakdown.tsx` — hex-to-token remediation only (tier-flag/runaway-warning/Opus-row classes); table structure and `billedUsd`/`billedTotal` data flow from 104-05 untouched
- `src/components/CostBreakdown.test.tsx` — 2 new tests (source-level hex/legacy-class assertion, Opus-row distinguishing-class assertion)

## Decisions Made

See frontmatter `key-decisions`. The most consequential: the redundant `CostTrendChart` surface wrapper was removed rather than retokenized, since `Analytics.tsx` already supplies the panel surface via `GlassPanel` — retaining a second `bg-card border-border` div would have been non-hex but still redundant chrome.

## Deviations from Plan

None — plan executed exactly as written. The empty-state copy change (`"No API cost data yet."` → `"No cost data yet."`) was explicitly instructed by the plan's own Task 1 action text ("Keep the existing empty-state copy `'No cost data yet.'` unchanged"), not a deviation.

## Hex Remediation Verification

```
$ grep -oE '#[0-9a-fA-F]{6}' src/components/CostTrendChart.tsx | sort -u
#6b7280

$ grep -cE '#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b' src/components/CostBreakdown.tsx
0

$ grep -cE 'amber-|text-red-|bg-red-|green-[0-9]|yellow-[0-9]' src/components/CostBreakdown.tsx
0
```

Both files pass the mandatory zero-hex-outside-`PROVIDER_COLORS`-exemption bar.

## Issues Encountered

None.

## User Setup Required

None — pure frontend/UI change on top of plan 104-05's already-shipped, already-seeded `costDerived.ts` derivation layer.

## Next Phase Readiness

- Plan 104-11 (live UAT / verification) can visually confirm the toggle and the retokenized `CostBreakdown` across all six themes — this plan's own `<verification>` section explicitly defers cross-theme visual confirmation to 104-11.
- `CostTrendChart.tsx` and `CostBreakdown.tsx` are now both clean of hardcoded hex outside the documented `PROVIDER_COLORS` exemption — the two files CLAUDE.md and UI-SPEC flagged as current violations at phase start are both closed.

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

All 4 created/modified source files found on disk plus this SUMMARY. Both task commit hashes (`119a6c24`, `c37d65e7`) found in `git log --oneline --all`.
