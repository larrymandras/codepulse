---
phase: 93-eval-pipeline-quality-kpis
plan: 05
subsystem: ui
tags: [react, recharts, shadcn, convex, quality-kpis, regression-badge]

# Dependency graph
requires:
  - phase: 93-04
    provides: "listPersonaKpis / getPersonaDetail / listJudgedSessions Convex queries (per-persona KPI read surface)"
provides:
  - "Quality page (/quality) — per-persona KPI card grid with score, sparkline, delta badge, regression badge"
  - "Quality persona detail page (/quality/:profileId) — multi-dimension trend chart with change-event markers, per-dimension breakdown, judged-sessions list"
  - "useEvalScores hooks (useQualityKpis/usePersonaDetail/useJudgedSessions) — thin useQuery wrappers"
  - "QualityTrendChart component (Recharts LineChart + ReferenceLine change markers), reusable RUBRIC_DIMENSIONS constant"
  - "StatusBadge 'regression' legacyMap variant"
affects: ["93-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "QualityTrendChart follows the ResponseTimeChart.tsx ChartContainer/ChartConfig/ReferenceLine scaffolding (the real Recharts+shadcn analog — UI-SPEC's cited CompletionRateChart.tsx precedent turned out to also exist but ResponseTimeChart was the plan's directed analog)"
    - "Client-side range filtering: the Quality page's 7/30/90-day Select recomputes 'Sessions Judged (range)'/'Avg Overall Score' by filtering each persona's already-fetched sparkline array by timestamp, since listPersonaKpis (Plan 04) takes no rangeDays arg and is fixed to a 30-day backend window — the KPI card score digit/delta always reflect that fixed backend window regardless of the Select value"
    - "QualityDetail's own independent range Select (separate local state) is genuinely wired end-to-end into usePersonaDetail/useJudgedSessions, since those two queries do accept rangeDays"

key-files:
  created:
    - src/hooks/useEvalScores.ts
    - src/components/QualityTrendChart.tsx
    - src/pages/Quality.tsx
    - src/pages/QualityDetail.tsx
    - src/pages/Quality.test.tsx
  modified:
    - src/components/StatusBadge.tsx
    - src/App.tsx
    - src/layouts/DashboardLayout.tsx

key-decisions:
  - "Quality page's range Select does not filter the KPI card score digit/sparkline/delta (all sourced from Plan 04's fixed 30-day listPersonaKpis) — it only filters the metric-row aggregates (Sessions Judged / Avg Overall Score) and is labeled accordingly ('vs previous 30d' on the delta badge), so the control is genuinely functional without misrepresenting backend-fixed data as range-filtered."
  - "Per-dimension breakdown on QualityDetail averages each of the 4 fixed rubric dimensions (task_completion/error_handling/tool_efficiency/cost_discipline, sourced directly from convex/evalScores.ts's JUDGE_TOOL/JudgeOutputSchema) across the in-range judged sessions, reusing the SubScoreBar visual styling from OperatorScoreCard.tsx (not importable directly — it's a non-exported local function there, so the styling was replicated as a local component per the plan's 'reusing SubScoreBar styling' wording, not a literal import)."
  - "Judged-session row 'rationale' (secondary text) concatenates all per-dimension rationale strings (dimensions is a Record<dim, {score, rationale}> with no top-level overall rationale in the schema) and truncates from the end via a small local helper — truncatePath (existing formatters.ts helper) was rejected because it truncates from the front with a leading ellipsis, which is the wrong semantic for a sentence."
  - "Recharts is not globally mocked in this repo (only App.test.tsx locally mocks it to let App mount); Quality.test.tsx adds its own local `vi.mock('recharts', ...)` covering every RechartsPrimitive export chart.tsx references at module scope (ResponsiveContainer/LineChart/Line/XAxis/YAxis/CartesianGrid/Tooltip/Legend/ReferenceLine) — omitting any of these throws at import time since chart.tsx destructures them as top-level consts."

patterns-established:
  - "RUBRIC_DIMENSIONS (task_completion/error_handling/tool_efficiency/cost_discipline + color/label) exported from QualityTrendChart.tsx as the single source of truth for which judge dimensions render, reused by QualityDetail.tsx's breakdown — avoids a second hardcoded dimension list drifting from the chart's."

requirements-completed: [EVAL-03]

# Metrics
duration: ~50min
completed: 2026-07-05
---

# Phase 93 Plan 05: Quality KPI Page + Persona Detail Summary

**A `/quality` per-persona KPI card grid (score/100, sparkline, delta badge, regression badge) and a `/quality/:profileId` drill-in with a multi-dimension Recharts trend chart marked with persona-change ReferenceLines, a per-dimension breakdown, and a judged-sessions list — all wired to Plan 04's `listPersonaKpis`/`getPersonaDetail`/`listJudgedSessions` queries and reachable from the OBSERVE nav.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- **Data hooks (Task 1):** `src/hooks/useEvalScores.ts` exports `useQualityKpis()`, `usePersonaDetail(profileId, rangeDays)`, `useJudgedSessions(profileId, rangeDays)` as thin `useQuery(...) ?? []`/`?? null` wrappers, following `useAlerts.ts`'s convention exactly, with `"skip"` guards when `profileId` isn't yet resolved.
- **Trend chart + regression badge (Task 1):** `src/components/QualityTrendChart.tsx` renders a Recharts `LineChart` (overall + 4 rubric-dimension lines, `strokeWidth={2}`, `dot={false}`, Y domain `[0,100]`) inside the existing `ChartContainer`/`ChartConfig` scaffolding, with `ReferenceLine` verticals per change-event marker labeled "Model change"/"Instruction change", plus an empty-state ("No judged sessions in this range yet.") when `series` is empty. `StatusBadge`'s `legacyMap` gained a `regression: { semantic: "error", label: "REGRESSION" }` entry.
- **Quality page (Task 2):** `src/pages/Quality.tsx` renders a 4-`MetricCard` row (Personas Judged, Sessions Judged (range), Active Regressions with `severity="critical"` when >0, Avg Overall Score `/100`), a `SectionHeader` with a 7/30/90-day range `Select` in its action slot, and a `SectionErrorBoundary`-wrapped KPI card grid. Each card shows the score digit colored via `thresholdColor(currentMean, {ok:0.8, warn:0.5, invertDirection:true})`, an inline `Sparkline`, a delta badge (▲/▼/→ + signed points, labeled "vs previous 30d"), a `StatusBadge status="regression"` + `InfoTooltip` when flagged, and per-card/page-level empty states ("No quality data yet" / "No judged sessions in this range...") matching the UI-SPEC copy contract verbatim.
- **Persona detail page (Task 2):** `src/pages/QualityDetail.tsx` renders a "Back to Quality" breadcrumb, its own independent range `Select` (genuinely wired to `usePersonaDetail`/`useJudgedSessions`, unlike the Quality page's Select), the `QualityTrendChart`, a per-dimension breakdown (local `SubScoreBar`-style rows averaging each of the 4 rubric dimensions across in-range judged sessions), and a judged-sessions list rendered as `EntityRow`s with concatenated per-dimension rationale (truncated) and a "View session →" link to the existing `/sessions/:id` route — each group independently wrapped in `SectionErrorBoundary`.
- **Nav + routes (Task 3):** `Gauge` (Lucide) added to `DashboardLayout.tsx`'s `iconComponents` map and a `/quality` entry added to the OBSERVE cluster after Alerts; `Quality`/`QualityDetail` lazy-imported in `App.tsx` and registered at `/quality` and `/quality/:profileId` with the existing Analytics-style `Suspense` fallback. `npm run build` confirms both pages are separately lazy-chunked (`Quality-*.js`, `QualityDetail-*.js`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Hooks + trend chart + regression badge variant** - `948e72d` (feat)
2. **Task 2: Quality page + persona detail page** - `33bf583` (feat)
3. **Task 3: Nav entry + lazy routes** - `32bbfdb` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/hooks/useEvalScores.ts` - `useQualityKpis`/`usePersonaDetail`/`useJudgedSessions` thin `useQuery` wrappers
- `src/components/QualityTrendChart.tsx` - Recharts `LineChart` (overall + 4 rubric dimensions) with `ReferenceLine` change markers; exports `RUBRIC_DIMENSIONS`
- `src/components/StatusBadge.tsx` - added `regression` legacyMap entry
- `src/pages/Quality.test.tsx` - `QualityTrendChart` render test (line-per-dimension + ReferenceLine-per-marker, empty-state copy)
- `src/pages/Quality.tsx` - Quality KPI page (metric row + range Select + per-persona card grid)
- `src/pages/QualityDetail.tsx` - persona drill-in (trend chart + dimension breakdown + judged-sessions list)
- `src/App.tsx` - lazy-loaded `Quality`/`QualityDetail`, registered `/quality` + `/quality/:profileId` routes
- `src/layouts/DashboardLayout.tsx` - `Gauge` icon + `/quality` OBSERVE nav entry

## Decisions Made

- **Range Select on the Quality page is honest about backend limitations:** `listPersonaKpis` (Plan 04) is a fixed 30-day comparison query with no `rangeDays` arg. Rather than silently ignoring the Select or fabricating a client-side re-derivation of the score/delta that would misrepresent the backend's actual comparison window, the Select drives only the page's aggregate metrics (Sessions Judged, Avg Overall Score), computed by filtering each persona's already-fetched sparkline by timestamp. The per-card score/delta are always labeled against the real 30-day backend window ("vs previous 30d").
- **QualityDetail's range Select is a genuine live control**, unlike the Quality page's, because `getPersonaDetail`/`listJudgedSessions` do accept `rangeDays` — selecting a preset there re-queries Convex directly.
- **SubScoreBar was replicated, not imported**, since `OperatorScoreCard.tsx`'s implementation is a non-exported local function — the plan's "reusing SubScoreBar styling" language was interpreted as visual-pattern reuse, not a literal cross-module import (which isn't possible without also exporting it from that file, out of this plan's scope).
- **Judged-session rationale text** concatenates every per-dimension rationale string (the schema has no single "overall" rationale field) and truncates via a small local helper rather than the existing `truncatePath` (which truncates from the front with a leading ellipsis — wrong semantics for a sentence).

## Deviations from Plan

None - plan executed exactly as written. The two judgment calls above (range-Select honesty, SubScoreBar replication) fill gaps the plan left to discretion rather than contradicting any stated instruction.

## Issues Encountered

None. `npx tsc --noEmit` clean throughout; `npx vitest run src/pages/Quality.test.tsx` (2/2) and the full suite (`npx vitest run`: 1590 passed, 187 todo, 0 failed) both green; `npm run build` succeeded with `Quality` and `QualityDetail` confirmed as separate lazy chunks.

## User Setup Required

None - no external service configuration required. This plan is pure frontend UI (pages/hooks/components/routes) consuming Plan 04's already-deployed Convex queries.

## Next Phase Readiness

- The Quality page and persona detail drill-in are fully wired to real Convex queries (no mock/stub data) and ready for live verification against real judged-session data in Plan 06 (D-04), as the plan's own `<verification>` section anticipated.
- No blockers identified for Plan 06.

---
*Phase: 93-eval-pipeline-quality-kpis*
*Completed: 2026-07-05*

## Self-Check: PASSED

All created files verified present (`src/hooks/useEvalScores.ts`, `src/components/QualityTrendChart.tsx`, `src/pages/Quality.tsx`, `src/pages/QualityDetail.tsx`, `src/pages/Quality.test.tsx`, this summary); all 3 task commits (`948e72d` Task 1, `33bf583` Task 2, `32bbfdb` Task 3) verified in `git log`.
