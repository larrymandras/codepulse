---
phase: 104-cost-intelligence
plan: 09
subsystem: frontend
tags: [convex, cost-intelligence, react, shadcn-table, design-tokens]

# Dependency graph
requires:
  - phase: 104-05
    provides: "convex/costDerived.ts's costBreakdown/unpricedModels queries (the single tokens-to-dollars derivation)"
  - phase: 104-07
    provides: "ModelPricingAdmin.tsx's precedent for reading api.costDerived.unpricedModels with { lookbackHours: 24 }"
provides:
  - "src/hooks/useCostDerived.ts — useCostBreakdown/useUnpricedModels wrapper hooks"
  - "src/components/CostBreakdownTable.tsx — the COST-01 per-provider/per-model breakdown table"
  - "src/components/UnpricedModelsNudge.tsx — the persistent D-03 unpriced-models affordance"
  - "src/pages/Analytics.tsx — both components mounted in the cost cluster"
affects: [104-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Window selector (24h/7d/30d) as a Button-pair/triple, mirroring CostTrendChart.tsx's D-08 Billed/Covered toggle — not a Select, not shadcn Tabs"
    - "Unpriced row renders a single Badge with colSpan=2 replacing the Billed+Covered cells rather than two separate placeholder cells — keeps 'never a $0.00 or blank cell' true for both columns in one element"
    - "Footer totals split across two TableFooter rows (colSpan=5+value, colSpan=6+value) rather than one row with two value cells — makes the D-05 never-merged guard visually and structurally obvious"

key-files:
  created:
    - src/hooks/useCostDerived.ts
    - src/components/CostBreakdownTable.tsx
    - src/components/CostBreakdownTable.test.tsx
    - src/components/UnpricedModelsNudge.tsx
    - src/components/UnpricedModelsNudge.test.tsx
  modified:
    - src/pages/Analytics.tsx

key-decisions:
  - "UnpricedModelsNudge's 'Add rates' action links to plain /settings, not a query-param tab scheme — Settings' Tabs state (src/pages/Settings.tsx:377, `useState(\"general\")`) is local component state, not URL-addressable, confirmed by reading the file rather than assumed. Per the plan's own fallback instruction, this is documented here rather than inventing a URL contract Settings doesn't support."
  - "useCostBreakdown/useUnpricedModels collapse both 'loading' and 'genuinely empty' to the same DEFAULT_* shape (useQuery(...) ?? DEFAULT), matching useCostByGoal.ts's convention — UnpricedModelsNudge doesn't need to distinguish undefined from count:0 because both cases render identically (null), unlike useCostBudget's deliberate undefined/null split in 104-07"
  - "InfoTooltip (the existing hover-based hand-rolled component) used for the Covered-cell tooltip instead of the shadcn Tooltip primitive — InfoTooltip needs no TooltipProvider ancestor, avoiding the exact missing-provider crash class Phase 103's BrainPickerRow hit"
  - "Doc comment in UnpricedModelsNudge.tsx reworded to avoid the literal substring 'localStorage' (a Rule 1 fix caught by the plan's own acceptance-criteria grep on first test run) — same class of fix 104-05's SUMMARY documented for 'totalCost'"

patterns-established:
  - "A doc comment describing what a component deliberately does NOT do must reword the literal forbidden substring, since acceptance-criteria greps check the whole file including comments (confirmed a second time, same as 104-05)"

requirements-completed: [COST-01]

# Metrics
duration: 20min
completed: 2026-07-31
---

# Phase 104 Plan 09: Cost Breakdown Table + Unpriced Models Nudge Summary

**`CostBreakdownTable` (24h/7d/30d windowed per-provider/per-model shadcn Table with Unpriced badge rows and never-merged Billed/Covered footer totals) and `UnpricedModelsNudge` (persistent, live-count-only "N models need pricing rates" banner) are now mounted on Analytics — COST-01's breakdown is on screen, and D-03's honesty rule is visible, not just enforced in the backend.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-31T11:55:00Z
- **Completed:** 2026-07-31T12:02:00Z
- **Tasks:** 3
- **Files modified:** 6 (5 created: `useCostDerived.ts`, `CostBreakdownTable.tsx`/`.test.tsx`, `UnpricedModelsNudge.tsx`/`.test.tsx`; 1 edited: `Analytics.tsx`)

## Accomplishments

- **`src/hooks/useCostDerived.ts`** ships `useCostBreakdown(period, lookbackHours)` and `useUnpricedModels(lookbackHours)`, both following `useCostByGoal.ts`'s `useQuery(...) ?? DEFAULT` shape with module-level default constants. Exports `CostBreakdownResult`/`UnpricedModelsResult` types.
- **`src/components/CostBreakdownTable.tsx`** — "Cost by Model" panel with a 24h/7d/30d window selector (`Button` triple, mirroring `CostTrendChart`'s D-08 toggle) mapping to `{period:"hourly",lookbackHours:24}` / `{period:"daily",lookbackHours:168}` / `{period:"daily",lookbackHours:720}`. A shadcn `Table` with Provider/Model/Billing/Prompt tokens/Completion tokens/Billed/Covered columns. An unpriced row (`priced===false`) renders a single `Badge` reading "Unpriced" (status-warn token via `color-mix`) spanning the Billed+Covered columns, while its token-count cells still show real numbers — never `$0.00`, never blank. A subscription row shows a genuine `$0.0000` Billed figure and its shadow `coveredUsd` in Covered, with the exact UI-SPEC tooltip copy (`InfoTooltip`, no `TooltipProvider` needed). The footer renders "Billed total" and "Covered total" as two structurally separate `TableFooter` rows — no expression anywhere sums them (D-05). A caption states excluded unpriced tokens when `unpricedTokenTotal > 0`. Empty state: "No cost data yet." verbatim.
- **`src/components/UnpricedModelsNudge.tsx`** reads `useUnpricedModels(24)` and renders `null` for both the loading and the genuinely-zero case. When `count > 0` it renders a compact `role="status"` banner (status-warn token, `AlertTriangle` icon) with the UI-SPEC copy verbatim (`"**{N} models** need pricing rates — their cost isn't in the total above."`) and an `Add rates` link. The count is read directly from the live query every render — no local state, no caching, no persisted dismissal of any kind, so a re-render with a new count always shows the new count (test-verified).
- **`src/pages/Analytics.tsx`** — `UnpricedModelsNudge` mounted as a full-width `md:col-span-12` row above the existing top row (no `GlassPanel`, per the UI-SPEC "don't compete with the forecast panel" instruction), wrapped in `<SectionErrorBoundary name="Unpriced Models">`. `CostBreakdownTable` mounted as a `md:col-span-12` row immediately below the `CostTrendChart`/`GatewayQuotaPanel` row, wrapped in `<SectionErrorBoundary name="Cost Breakdown">` + `GlassPanel className="p-4"` matching the neighbouring panels. No existing panel's grid weighting, wrapping, or component was touched — confirmed via `git diff` filtered on the four named panels/classes (0 matches).
- 15 new component tests (8 `CostBreakdownTable.test.tsx`, 7 `UnpricedModelsNudge.test.tsx`) plus the full repo suite: 3117/3117 passing (up from 3102 at 104-08), `npx tsc --noEmit` and `npm run build` both clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the per provider and model cost breakdown table** — `3203a0e7` (feat)
2. **Task 2: Build the persistent unpriced-models nudge** — `97c04687` (feat)
3. **Task 3: Mount both components in the Analytics cost cluster** — `410aca52` (feat)

## Files Created/Modified

- `src/hooks/useCostDerived.ts` — `useCostBreakdown`/`useUnpricedModels` wrapper hooks + exported result types
- `src/components/CostBreakdownTable.tsx` — the breakdown table (window selector, Unpriced badge rows, subscription shadow tooltip, split footer totals, unpriced-token caption, empty state)
- `src/components/CostBreakdownTable.test.tsx` — 8 tests (row rendering with provider display names, unpriced-row badge+tokens+no-$0.00 scoped-to-row, subscription zero-billed/non-zero-covered, split footer totals + no-merged-sum guard, window-selector re-query, empty state, no hex, no Recharts)
- `src/components/UnpricedModelsNudge.tsx` — the nudge banner
- `src/components/UnpricedModelsNudge.test.tsx` — 7 tests (count:0 renders nothing, loading renders nothing, exact copy + live count + Add-rates link, count-change re-render guard, no localStorage writes, no hex, no localStorage reference in source)
- `src/pages/Analytics.tsx` — both components imported and mounted; no existing panel moved/restyled/re-wrapped

## Decisions Made

See frontmatter `key-decisions`. The most consequential: `UnpricedModelsNudge`'s "Add rates" link targets plain `/settings` rather than a query-param tab scheme, because `Settings.tsx`'s tab state (`useState("general")`, converted to controlled in 104-08 but never wired to the URL) is not URL-addressable — verified by reading the live file rather than assumed, per the plan's own instruction to say so in the summary rather than invent a scheme.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a doc comment to avoid the literal substring `localStorage`**
- **Found during:** Task 2, first test run (`references no localStorage in source`)
- **Issue:** `UnpricedModelsNudge.tsx`'s header doc comment named `localStorage` in prose explaining what the component deliberately does NOT use — but the test's/plan's own acceptance criterion (`grep -c 'localStorage'` → 0) checks the whole file including comments, same class of trap 104-05's SUMMARY documented for `totalCost`.
- **Fix:** Reworded the comment to describe the same constraint ("no local caching and no persisted dismissal flag of any kind") without the literal substring.
- **Files modified:** `src/components/UnpricedModelsNudge.tsx`
- **Verification:** `grep -c 'localStorage' src/components/UnpricedModelsNudge.tsx` returns 0; `npx vitest run src/components/UnpricedModelsNudge.test.tsx` — 7/7 passing.
- **Committed in:** `97c04687` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, a self-inflicted test failure from this task's own doc comment, not pre-existing/unrelated work).
**Impact on plan:** No scope creep — the fix was required to satisfy this plan's own stated acceptance criterion.

## Issues Encountered

- Initial test fixtures for `CostBreakdownTable.test.tsx` had the priced API row's `billedUsd` (1.25) equal the footer's `billedTotal` (also 1.25, since the fixture's only other priced row was the subscription row contributing `billedUsd: 0`) — a global `screen.getByText("$1.2500")` would have matched both the row cell and the footer cell, an ambiguous-match failure, not a real defect. Rewrote the footer-totals test to scope each assertion to its own `<tr>` via `within(row)` rather than changing the fixture shape, since the collision is inherent to a small fixture and scoping is the correct test discipline regardless of fixture size.

## User Setup Required

None — this plan is pure frontend wiring on top of plan 104-05's already-shipped, already-index-bounded `costDerived.ts` queries. No new Convex tables, no new environment variables, no deploy step beyond the standard build.

## Next Phase Readiness

- COST-01's breakdown is now visible end-to-end: an operator can see spend broken down per provider and per model over 24h/7d/30d windows, unpriced models are their own rows with real token counts (never folded into the total), and a persistent nudge names the live count of models needing rates.
- Per this project's "green suite ≠ live-verified" convention (matching 104-01/104-04/104-05/104-06/104-08's own precedent), the live confirmation that the nudge count matches models actually present in `llmMetrics` on the running self-hosted instance, and that the breakdown table renders correctly across all 6 themes, is explicitly deferred to plan 104-11 — this plan's own `<verification>` section states this.
- Plan 104-11 (live verification/UAT) is now the last unexecuted plan in Phase 104 (10/11 plans complete).

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

All 6 created/modified source files found on disk plus this SUMMARY. All 3 task commit hashes (`3203a0e7`, `97c04687`, `410aca52`) found in `git log --oneline --all`.
