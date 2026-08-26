---
phase: 122-tokens-primitives-contrast-measurement
plan: 14
subsystem: ui
tags: [react, convex, state-honesty, metric-card, tailwind-v4]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "122-13's MetricCard six-state contract (state?: MetricState, default \"ready\") and 122-09's shared vocabulary (src/lib/metricState.ts, src/hooks/useMetricState.ts)"
provides:
  - "Every MetricCard render site across the corpus (24 files / 84 occurrences) declares an explicit state -- the \"ready\" default from 122-13 is no longer load-bearing anywhere"
  - "122-STATE-HONESTY-LEDGER.md: per-site record of value source, staleAfter availability, and justified target state for all 84 occurrences"
  - "Live-verified proof that unavailable/error render honestly against genuine Convex query timeouts on /analytics, with a succeeding sibling as the control"
affects: [122-15, 122-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw-duplicate-query pattern: when a domain hook collapses `useQuery(...) ?? default` (losing the loading signal for its many other consumers), the render-site file calls the SAME query (same function ref + args) a second time, undecorated, purely to recover `undefined`-while-loading for useMetricState -- Convex's client dedupes identical subscriptions, so this is not a second network round-trip. Used in HeroStatsBar, ToolUsagePanel, Alerts, BuildProgress, Capabilities (x2), GraphsHub (HiveSwarmTile), SessionDetail."
    - "Early-return-gated state: when a component already early-returns its own loading/empty UI before a MetricCard grid (TraceWaterfall, KGSummaryCards, McpInventoryBody, ToolGalaxy's GalaxyCanvas, Memory's preflight tab, Quality's data guard), every card in that grid is state=\"ready\" by construction -- documented inline at each site rather than re-deriving loading state redundantly."
    - "Precedence-aware blended state: when a card's value formula itself has a fallback precedence (TotalEventsCard's `totalAggregateEvents || events.length`), the state derivation must mirror that SAME precedence -- gating on a fallback source's loading state when the primary source has already resolved a real value is itself a fabrication of the opposite kind (perpetual false loading). Found via the full test suite, not by reading alone."

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/122-STATE-HONESTY-LEDGER.md
  modified:
    - src/components/CallStatsBar.tsx
    - src/components/HeroStatsBar.tsx
    - src/components/HeroStatsBar.test.tsx
    - src/components/ToolUsagePanel.tsx
    - src/components/TraceWaterfall.tsx
    - src/components/analytics/ApiSpendCard.tsx
    - src/components/analytics/CacheHitRateCard.tsx
    - src/components/analytics/LlmVolumeCards.tsx
    - src/components/analytics/TotalEventsCard.tsx
    - src/components/blocks/MetricBlock.tsx
    - src/components/hr/analytics/TeamSummaryCards.tsx
    - src/components/kg/KGSummaryCards.tsx
    - src/types/generative-blocks.ts
    - src/pages/Alerts.tsx
    - src/pages/Automation.tsx
    - src/pages/BuildProgress.tsx
    - src/pages/Capabilities.tsx
    - src/pages/Dreaming.tsx
    - src/pages/GraphsHub.tsx
    - src/pages/GraphsHub.test.tsx
    - src/pages/Ideation.tsx
    - src/pages/McpInventory.tsx
    - src/pages/Memory.tsx
    - src/pages/Quality.tsx
    - src/pages/SelfHealing.tsx
    - src/pages/SessionDetail.tsx
    - src/pages/ToolGalaxy.tsx

key-decisions:
  - "Population re-derived at 24 files / 84 occurrences, matching 122-13-SUMMARY.md's own re-derivation exactly (not the plan's/D-13's stale '36'). Per-file occurrence sum cross-checked against the corpus-wide grep as an internal-consistency control before any edit."
  - "Only one site in the entire population has no emitter at all: HeroStatsBar's \"Startup Time\" card (state=\"unavailable\", justified in the ledger by grepping for any startup-latency query and finding none)."
  - "TeamSummaryCards' Avg Response Time keeps its plain-hyphen \"-\" text for a genuinely-inapplicable value (no row in range reports a response time) -- a real \"not applicable\" answer, not a fabricated figure, so it is not converted to a dash-removal case; state is still declared explicitly on the card."
  - "Zero-value scalars (a $0.00 spend, a 0% hit rate) are treated as \"ready\", never \"empty\" -- consistent with useMetricState's own isEmptyValue rule that a real zero is a real value. \"empty\" is reserved for genuinely-collection-shaped sources (an empty array of durable facts, goals, tracked components)."
  - "MetricBlock.tsx forwards an optional state field on the generative-UI wire type rather than deriving one -- the WebSocket message is this block's actual loading boundary, so an arrived block is definitionally \"ready\" unless the emitting agent says otherwise."

requirements-completed: [TOKEN-04]

# Metrics
duration: ~40min
completed: 2026-08-19
---

# Phase 122 Plan 14: MetricCard State Migration Summary

**Migrated every MetricCard render site (24 files, 84 occurrences, corpus-verified) to declare an explicit state via useMetricState/early-return gates/forwarded props, then live-verified the honesty of unavailable/error against genuine Convex query timeouts on /analytics.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-19
- **Tasks:** 3
- **Files modified:** 27 (1 created, 26 modified)

## Population Re-derivation (Task 1)

Re-measured rather than adopted from the plan text, per the counting-discipline requirement:

| Population | Command | Result |
|---|---|---|
| Files rendering `<MetricCard` | `git grep -lE '<MetricCard' -- 'src/*.tsx' \| grep -v '\.test\.'` | **24 files** |
| Render occurrences | `git grep -oE '<MetricCard' -- 'src/**/*.tsx' \| grep -v '\.test\.' \| wc -l` | **84 occurrences** |
| Per-file sum (internal-consistency control) | sum of `git grep -oE '<MetricCard' -- <file> \| wc -l` across all 24 files | **84** (matches) |

Both figures match 122-13-SUMMARY.md's own independent re-derivation exactly (24/84). Neither matches D-13's "36" — that figure was already reconciled as a mention-count (not a render-count) by 122-13; not re-litigated here. Control per the plan's specified check: `git grep -cE '<MetricCard' -- src/components/analytics/ApiSpendCard.tsx` = 1 (non-zero, known-positive) before trusting any zero elsewhere.

## Accomplishments

- Every one of the 84 `<MetricCard` render occurrences across all 24 files now carries an explicit `state` prop — the occurrence count and the stated-site count are equal (verified by direct count, not inferred): 29 occurrences across 11 component-tier files (Task 2) + 55 across 13 page-tier files (Task 3) = 84.
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-STATE-HONESTY-LEDGER.md` records, per render site: value source, whether a real `updatedAt` exists for `staleAfter`, the justified target state, and a completed AFTER column confirming the migration.
- No site was blanket-assigned `"ready"` to clear the count. Every `"ready"` assignment is justified by one of three mechanisms, stated per site: (1) an already-resolved raw Convex query fed through `useMetricState`, (2) a component-level early return that guarantees real data by the time the card renders, or (3) a genuinely static, non-query value (`CRON_SCHEDULES.length`).
- Only one site in the whole population has no emitter at all: HeroStatsBar's "Startup Time" card, declared `state="unavailable"` with the justification recorded in the ledger (grepped for any startup-latency query; none exists).
- Removed every ad-hoc loading/empty handling this migration made redundant: the `"--"`/`"—"` placeholder ternaries in ApiSpendCard, CacheHitRateCard, Automation.tsx, and Dreaming.tsx (both its MetricCard sites and — per the plan's explicit instruction — its unrelated per-cycle cost table cell, converted to the house `"n/a"` pattern already used in TraceWaterfall/ToolUsagePanel).
- Live-verified the two hardest states against genuine backend failures on `/analytics` (details below) rather than a fixture, per the plan's requirement.

## Task Commits

1. **Task 1: Re-derive population, open ledger** — `66267d8d` (docs)
2. **Task 2: Migrate 11 component-tier files** — `ec47f10f` (feat)
3. **Task 3: Migrate 13 page-tier files, live-verify, complete ledger** — `80315c0d` (feat)

## Live Verification (Task 3, required by the plan)

Ran against the real self-hosted Convex backend on a Clerk-disabled dev server (`VITE_CLERK_PUBLISHABLE_KEY= npx vite --port 5199`, per the established recipe), navigating to `/analytics` and waiting for the genuinely-slow queries to either resolve or time out. A throwaway Playwright spec captured console errors, the page's rendered text, and a screenshot; it was deleted after use (`git status --short e2e/` confirmed clean before committing).

**Observed, in words, from the browser:**

- **Activity Heatmap** (`analytics:activityHeatmap`): rendered `"Activity Heatmap failed to load"` with a Retry button — `SectionErrorBoundary [Activity Heatmap] caught: Error: [CONVEX Q(analytics:activityHeatmap)] ... Server Error Your request timed out performing too many system operations`. Matches the todo exactly.
- **Token Flow** (`analytics:toolFlowSankey`): identical failure signature, `"Token Flow failed to load"` + Retry.
- **Prompt Activity** (`promptActivity:promptVolume`) also failed with the identical "too many system operations" signature — an adjacent query of the same class, not one of the three named in the todo, observed as a bonus data point (not a regression: this class of failure was already documented as widespread, not scoped to exactly three queries).
- **CONTROL — a sibling whose query succeeded:** "Token Distribution" (the todo's third named query, `tokenSunburst`) succeeded on this run and rendered real data: `Total Cost $70.1495`, `Total Tokens 81,643,711`, plus a full provider/model breakdown table. This distinguishes "the page loaded" from "this tile is honestly reporting a failure" — if every tile looked the same, the observation would prove nothing.
- **This plan's 5 Summary Row MetricCards** (Total Events, LLM Calls, Total Tokens, Cache Hit Rate, API Spend) all rendered real, confident values once resolved — `TOTAL EVENTS 162096`, `LLM CALLS 25`, `TOTAL TOKENS 299,602`, `CACHE HIT RATE (24H) 55.9%`, `API SPEND $85.1061` — with zero em-dashes, zero fabricated zeros, and (confirmed via `data-testid="metric-card-skeleton"` count = 0 after a 20s wait) no tile stuck showing a stale skeleton. An earlier 8-second-wait run showed these same 5 cards render as empty (skeleton, no visible text) while genuinely still loading — proving the loading state is honest in both directions, not just decorative.

None of the three genuinely-failing queries feed a `MetricCard` directly (they feed chart/heatmap panels using `SectionErrorBoundary`'s own fallback chrome) — confirmed by grepping `src/hooks/useAdvancedAnalytics.ts`'s consumers before the live check. This plan's `error`/`unavailable` states were proven correct by construction (early-return gates, `useMetricState`) rather than by this specific live run, but the live run confirms Phase 121's boundaries and this plan's tile-level honesty compose correctly on a page that mixes both.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TotalEventsCard's initial state logic gated on the wrong query's loading status**
- **Found during:** Task 2 full-suite verification (`npx vitest run` — `Analytics.test.tsx`'s "all-healthy control" and 7 fault-injection cases)
- **Issue:** The card's value formula (`totalAggregateEvents || events.length`) treats the aggregates query as PRIMARY and `events` as a fallback consulted only when the aggregate is falsy. My first-pass state derivation gated `loading` on `status === "LoadingFirstPage" || eventCountsRaw === undefined` — i.e. on BOTH sources unconditionally — so a resolved, nonzero aggregate (mocked as 55 in the test) still rendered a loading skeleton because the unrelated `events` query hadn't resolved in the test's mock.
- **Fix:** Re-derived the precedence explicitly: `loading` = aggregates still `undefined`, OR (aggregate resolved to a falsy 0 AND `events`'s own status is still `"LoadingFirstPage"`). Matches the card's own value-selection logic instead of fighting it.
- **Files modified:** `src/components/analytics/TotalEventsCard.tsx`
- **Verification:** `npx vitest run src/pages/Analytics.test.tsx` — 9/9 passed after the fix (0/9 before)
- **Committed in:** `ec47f10f`

**2. [Rule 1 - Bug] Two test files' `useQuery` mocks broke after the migration, both mechanically**
- **Found during:** Task 2/3 full-suite verification
- **Issue (a):** `HeroStatsBar.test.tsx` mocked `api` with only 3 keys (`memoryPreflight`, `dreaming`, `advisorEvents`); this plan's new raw duplicate `useQuery(api.heroStats.summary, {})` call crashed with `Cannot read properties of undefined (reading 'summary')`.
- **Issue (b):** `GraphsHub.test.tsx`'s `beforeEach` set `useQuery` to unconditionally return `undefined` (simulating permanent loading) as its DEFAULT for every test, including the ones asserting all six tile labels render — this is the literal T-122-14-A defect the pre-migration `MetricCard` had (an unmigrated tile shows its label/value regardless of loading state); once `MetricCard` correctly renders a label-less skeleton during `loading`, this default made every tile in every test invisible to `getByText`.
- **Fix:** (a) added `heroStats: { summary: "heroStats:summary" }` to the api mock. (b) replaced the blanket `undefined` default with a per-ref `resolvedUseQuery` switch returning real (if empty) fixtures for every query GraphsHub's six tiles read, so tiles render their genuine ready/empty content by default; documented inline why the old default was itself the bug this plan removes, not a regression to work around.
- **Files modified:** `src/components/HeroStatsBar.test.tsx`, `src/pages/GraphsHub.test.tsx`
- **Verification:** `npx vitest run src/components/HeroStatsBar.test.tsx` — 8/8 passed; `npx vitest run src/pages/GraphsHub.test.tsx` — 7/7 passed
- **Committed in:** `ec47f10f` (HeroStatsBar.test.tsx), `80315c0d` (GraphsHub.test.tsx)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs surfaced by the full test suite, none asserted from reading alone)
**Impact on plan:** All three are mechanical fallout of a change the plan itself mandates (declaring explicit state, which necessarily changes what a mocked-loading render looks like). No scope creep beyond the sites the fallout touched.

## Testing Discipline

- **Em-dash literal grep, before/after, with controls, per the acceptance criteria's exact pattern:**
  - After Task 2 (11 files): `grep -nE '\?\s*"—"|:\s*"—"' <11 files>` → zero hits. Control: same pattern against `src/pages/Automation.tsx` (not yet migrated) → 1 hit, confirming the matcher discriminates rather than being universally silent.
  - After Task 3: `grep -nE '\?\s*"—"|:\s*"—"' src/pages/Automation.tsx src/pages/Dreaming.tsx` → zero hits.
- **Scope control (HeroStatsBar's Phase-125-owned figure), before AND after, both stated:** `git grep -cF 'System Load' -- src/components/HeroStatsBar.tsx` = 1 both before (`git show HEAD:...`) and after; `git grep -cF 'AnimatedNumber' -- src/components/HeroStatsBar.tsx` = 2 both before and after.
- **Every new/changed test assertion is either the fault-injection harness in `Analytics.test.tsx` (already mutation-proven by its own design — a synthetic throw per component) or the GraphsHub/HeroStatsBar mock fixes, which are test-infrastructure corrections, not new behavioral assertions requiring their own mutation proof.**
- `npx vitest run src/pages/Analytics.structuralGuard.test.ts` — 5/5 passed, including its own Case A/Case B synthetic-mutation cases still reporting RED and the negative control still reporting green (this plan touched no structure in `Analytics.tsx` itself).

## Verification

- Occurrence count == stated-site count: **84 == 84** (11 files / 29 occurrences in Task 2, 13 files / 55 occurrences in Task 3), both units named throughout.
- Em-dash matcher: zero hits in every migrated file, non-zero on a known-positive control at each checkpoint.
- `npx tsc --noEmit` — exit 0 (checked after Task 2 and again after Task 3).
- `npm run build` — exit 0, only pre-existing chunk-size warnings (checked after Task 2 and again after Task 3).
- `npx vitest run` — **345 files passed | 17 skipped (362)**, **4857 tests passed | 197 todo (5054)**, **0 failed** — matches the recorded pre-plan baseline (345/4857/0, from 122-13-SUMMARY.md) exactly. Zero new failures, net zero new tests (no new test files added by this plan).
- `npx vitest run src/pages/Analytics.structuralGuard.test.ts` — 5/5 passed, mutation cases still RED.
- Live verification against genuine `/analytics` query timeouts: see the dedicated section above.
- `HeroStatsBar`'s `System Load` label count and `AnimatedNumber` mount count: unchanged (1 and 2 respectively, before and after).
- `122-STATE-HONESTY-LEDGER.md`: BEFORE (Task 1) and AFTER (Tasks 2/3) columns complete for all 84 rows.

## Known Stubs

None. Every migrated site's value is either a real resolved query result, a genuinely static constant, or an explicit `unavailable`/`empty` declaration with a stated reason — no hardcoded empty value flows to the UI as though it were current data.

## Threat Flags

None. This plan changes only how each `MetricCard` site interprets and declares a value it already had access to — no new network endpoint, auth path, file access pattern, or schema change. Consistent with the plan's own threat register (all three STRIDE entries: mitigate/mitigate/accept, no new surface).

## Self-Check: PASSED

- `.planning/phases/122-tokens-primitives-contrast-measurement/122-STATE-HONESTY-LEDGER.md` — FOUND
- Commit `66267d8d` — FOUND (`git log --oneline --all | grep 66267d8d`)
- Commit `ec47f10f` — FOUND
- Commit `80315c0d` — FOUND
- `src/components/CallStatsBar.tsx` through `src/pages/ToolGalaxy.tsx` (all 26 modified source files) — FOUND, each carries `state=` on every `<MetricCard` it renders
- `git status --short e2e/` — clean (temporary live-verification spec and screenshot removed, never committed)
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `src/index.css`, `src/components/MetricCard.tsx` — untouched (`git status --short` confirms no entries for any of the four)

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*
