---
phase: 93-eval-pipeline-quality-kpis
plan: 04
subsystem: backend
tags: [convex, eval-pipeline, regression-detection, alerting, kpi, quality]

# Dependency graph
requires:
  - phase: 93-01
    provides: "evalScores table + task_quality ingest + personaConfigChangeKey/configChanges audit trail"
  - phase: 93-02
    provides: "judgeSessionsAction (nightly LLM-judge internalAction) that this plan's detectRegressions tail-calls"
provides:
  - "listPersonaKpis / getPersonaDetail / listJudgedSessions Convex queries (per-persona KPI read surface for the Quality page)"
  - "evaluateRegression pure D-12/D-14 gate + detectRegressions internalAction (before/after window-mean regression detector)"
  - "Delivered regression alerts via the createIfNew shape (webhookStatus pending + scheduled sendAlertWebhook), source eval-regression:<profileId>"
affects: ["93-05", "93-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Change-event merge helper (buildChangeMarkers) shared by both the KPI detail-page markers and the regression detector's window boundaries — one source of truth for 'what counts as a persona change' (D-11)"
    - "Extracted-handler test pattern continued: insertRegressionAlertHandler takes a minimal {db} shape (mirrors storeEvalScoreHandler from Plan 02), directly unit-tested without convex-test"
    - "detectRegressionsForPersona takes an injectable {runQuery, runMutation, scheduler} ctx shape so the fire/no-fire orchestration is unit-tested against a fake ctx without convex-test or comparing Convex function-reference proxies"

key-files:
  created: []
  modified:
    - convex/evalScores.ts
    - convex/evalScores.test.ts

key-decisions:
  - "changeType mapping resolved as a first-class code decision, not left implicit: a persona-scoped configChanges row (profile.<id>.modelPreferences) renders as 'a model change'; a profileSwitches row touching the persona renders as 'an instruction change' — D-11 defines only these two change-source categories, so the two-way UI-SPEC copy option ('a model change' | 'an instruction change') maps exhaustively onto them."
  - "detectRegressionsForPersona stops at the first change event that fires per run (one alert per persona per run is sufficient — the existing-alert dedup guard already blocks re-scanning once a regression is open for that persona)."
  - "Change-event candidates are bounded to a 30-day lookback (CHANGE_EVENT_LOOKBACK_SECONDS) rather than an unbounded profileSwitches/configChanges scan, extending the plan's 'never .collect() unbounded' discipline beyond evalScores to the other tables the detector reads."
  - "REGRESSION_DROP_THRESHOLD = 0.15 (15 pts on the 0-100 display scale) chosen as the conservative, code-defined D-14 constant — verified against the single-outlier boundary case (a 5-vs-5 comparison with one bad session moving the mean by only 0.12 correctly does not fire)."
  - "Comparing Convex anyApi function-reference Proxies (internal.evalScores.X) through vi.fn()-captured mock args crashes vitest's pretty-format diffing when an assertion fails (a Convex/vitest interaction quirk, verified empirically) — detectRegressionsForPersona tests dispatch on call ORDER instead of function-reference identity, and 'public alerts.create never called' is instead proven by a static source-grep test plus the separately-tested insertRegressionAlertHandler shape."

patterns-established:
  - "KPI/regression read logic split into pure, directly-testable helpers (meanOverall, periodDelta, buildPersonaKpi, buildPersonaDetailSeries, buildChangeMarkers, evaluateRegression, buildRegressionMessage) with thin Convex query/action wrappers around them — same discipline as Plans 01/02's extracted-handler pattern."

requirements-completed: [EVAL-03]

# Metrics
duration: ~45min
completed: 2026-07-05
---

# Phase 93 Plan 04: Regression Detection + Quality KPI Queries Summary

**A before/after window-mean regression detector (`evaluateRegression`, `detectRegressions`) that raises properly-delivered alerts through the existing `createIfNew` webhook-delivery shape, plus three per-persona KPI read queries (`listPersonaKpis`, `getPersonaDetail`, `listJudgedSessions`) that the Quality page consumes.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- **KPI read surface (Task 1):** `listPersonaKpis` returns one entry per active persona (`profileConfigs`) with current 30-day mean overall, a chronological sparkline, a delta vs. the previous 30-day period, and an `activeRegression` flag derived from an open `eval-regression:<profileId>` alert. `getPersonaDetail(profileId, rangeDays)` returns a per-session time series (overall + per-dimension scores where present) plus change-event markers merged from `profileSwitches` (fromProfile/toProfile touching the persona) and persona-scoped `configChanges` (`profile.<id>.modelPreferences`, D-11). `listJudgedSessions(profileId, rangeDays)` returns bounded `llm_judge` rows with dimensions/rationale/sessionId. All reads are index-first (`by_profileId`/`by_timestamp`/`by_key`/`by_source`, range-bound via `.gte`/`.lt`) — no unbounded `.collect()`, and no query ever touches `agentConfigs`/`apiKey` (T-93-12).
- **Regression detector (Task 2):** `evaluateRegression` is a pure D-12/D-14 gate — fires only when both the before and after windows clear `MIN_SESSIONS_PER_SIDE=5` judged sessions AND the mean drop clears `REGRESSION_DROP_THRESHOLD=0.15`. Boundary-tested against 2-vs-2, 4-vs-6, sub-threshold, and single-outlier comparisons — all correctly resolve `fire: false` (T-93-10 zero-false-positive bar).
- **Delivered alerts, not silent inserts (T-93-11):** `detectRegressions`/`detectRegressionsForPersona` replicate `alerts.ts`'s `createIfNew` field set exactly (`severity`, `source: eval-regression:<profileId>`, `webhookStatus: "pending"`, `status: "active"`, `acknowledged: false`) plus a `details` payload (`createIfNew` itself doesn't accept one), then schedule `internal.webhookDelivery.sendAlertWebhook` — never the non-delivering public `alerts.create`. Dedup is by source: an already-open regression alert for a persona blocks re-firing before any change-event scan runs.
- **Nightly wiring:** `judgeSessionsAction` (Plan 02) now tail-calls `ctx.runAction(internal.evalScores.detectRegressions, {})` immediately after its `Promise.allSettled` batch resolves, so the night's own freshly-judged scores are counted in the comparison before it runs (RESEARCH Open Question 3 — no extra cron slot needed).
- **UI-SPEC copy contract:** `buildRegressionMessage` renders the exact required shape — `"{persona} quality dropped {N} pts after {change type} on {date} ({before} → {after})"` — verified against the UI-SPEC's own example numbers (business, 82→64, 18 pts, "a model change").

## Task Commits

Each task was committed atomically:

1. **Task 1: KPI read queries** - `a87c2f4` (feat)
2. **Task 2: Regression detector + delivered alert** - `a06d268` (feat)

**Plan metadata:** (this commit)

_Both tasks were `tdd="true"`; tests were written alongside the implementation in the same commit per this repo's convex-test-absent convention (plain vitest unit tests on extracted pure functions / directly-testable handlers), matching the established Plan 01/02 precedent read at plan start. Splitting the two tasks into separate atomic commits required temporarily truncating the file to its Task-1-only state, re-verifying `tsc --noEmit` + the full test file passed at that checkpoint, committing, then restoring the Task 2 content and committing again — both intermediate states were independently verified green, not just the final combined state._

## Files Created/Modified
- `convex/evalScores.ts` - Added: `meanOverall`/`periodDelta`/`buildPersonaKpi`/`buildPersonaDetailSeries`/`buildChangeMarkers` pure helpers; `listPersonaKpis`/`getPersonaDetail`/`listJudgedSessions` public queries; `evaluateRegression`/`buildRegressionMessage` pure functions; `getActiveRegressionAlertInternal`/`getPersonaChangeEventsInternal`/`getEvalScoresWindowInternal` internal queries; `insertRegressionAlertHandler`/`insertRegressionAlert` (extracted-handler + internalMutation pair); `detectRegressionsForPersona`/`detectRegressions` (extracted orchestration + internalAction); `judgeSessionsAction` now tail-calls `detectRegressions`
- `convex/evalScores.test.ts` - 63 total tests in the file (28 new for this plan): KPI math (meanOverall/periodDelta/buildPersonaKpi/buildPersonaDetailSeries), change-marker merging (buildChangeMarkers), regression gate boundaries (evaluateRegression — fires, 2-vs-2, 4-vs-6, sub-threshold, single-outlier, override params), UI-SPEC copy contract (buildRegressionMessage), alert delivery shape (insertRegressionAlertHandler), and orchestration + dedup (detectRegressionsForPersona, plus a static source-grep proving `alerts.create(` is never called)

## Decisions Made

- **changeType → copy mapping made explicit in code:** D-11 defines exactly two change-source categories (persona-scoped `configChanges` and `profileSwitches`), and the UI-SPEC copy contract offers exactly two labels ("a model change" | "an instruction change"). `buildChangeMarkers` tags each source with `changeType: "model" | "switch"`, and `buildRegressionMessage` maps `"model"→"a model change"`, `"switch"→"an instruction change"` — an exhaustive, documented mapping rather than an unstated assumption.
- **One alert per persona per detector run:** `detectRegressionsForPersona` returns as soon as one change event fires, rather than scanning every change event for a persona every run. The existing-alert dedup guard (checked first, before any change-event read) already prevents re-firing while a regression is open, so a second qualifying event in the same run cannot double-alert.
- **30-day lookback bound on change-event candidates:** `CHANGE_EVENT_LOOKBACK_SECONDS` (30 days) keeps the `profileSwitches`/`configChanges` reads range-bound via their indexes rather than an unbounded table scan — extending the plan's "never `.collect()` unbounded on evalScores" discipline to the other two tables the detector reads.
- **REGRESSION_DROP_THRESHOLD = 0.15:** chosen and verified against the plan's own single-outlier boundary case — a 5-vs-5 comparison where one bad session (0.3 among four 0.9s) only moves the mean by 0.12 correctly does NOT fire, while a genuine 0.3 drop across two clean 5-session windows does.
- **Proxy-comparison landmine avoided in tests:** empirically confirmed that asserting `toHaveBeenCalledWith`/`toEqual` on a Convex `anyApi` function-reference Proxy captured through `vi.fn()` crashes vitest's pretty-format diffing when the assertion fails (`PrettyFormatPluginError: Cannot convert object to primitive value`) — not a real equality result, a tooling interaction quirk. `detectRegressionsForPersona`'s tests dispatch the fake `ctx.runQuery` on call order instead, and "the public `alerts.create` mutation is never called" is proven via a static source-text grep (`/alerts\.create\(/` absent from the module) rather than a mocked-call assertion.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>` specs were implemented as described; the only judgment call was resolving the `changeType` → copy-label mapping (documented above), which the plan explicitly left ambiguous between the two D-11 change sources and the two UI-SPEC copy options — not a deviation from a stated behavior, but filling in an intentionally-deferred detail (`93-CONTEXT.md` "Claude's Discretion" covers persona/configKey identity mapping generally).

## Issues Encountered

None. Full `npm test` suite green (1588 passed, 187 todo, 0 failed) both before and after this plan's changes; `npx tsc --noEmit` clean throughout, including at the intermediate Task-1-only checkpoint used to split the commits.

## User Setup Required

None - no external service configuration required. This plan is pure Convex backend logic (queries + an internalAction) with no new environment variables, no new npm packages, and no new HTTP surface.

## Next Phase Readiness

- `listPersonaKpis`/`getPersonaDetail`/`listJudgedSessions` are ready for Plan 05 (Quality page UI) to consume via `useQuery` — no further schema or query work needed for the KPI card grid + persona detail drill-in described in D-16.
- `detectRegressions` runs automatically at the tail of the nightly judge cron (05:00 UTC, Plan 02) — the regression-alert pipeline is live end-to-end in code; it will start producing real alerts once (a) `intelligence.llm_eval` is configured (Plan 02's `judgeSessionsAction` prerequisite) and (b) enough judged sessions accrue on both sides of a real persona model/instruction change (>=5/side, D-14).
- No blockers identified for Plan 05 or Plan 06.

---
*Phase: 93-eval-pipeline-quality-kpis*
*Completed: 2026-07-05*
