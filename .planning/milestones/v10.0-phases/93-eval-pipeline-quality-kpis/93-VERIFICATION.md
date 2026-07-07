---
phase: 93-eval-pipeline-quality-kpis
verified: 2026-07-06T18:00:00Z
status: passed
score: 18/18 must-haves verified
overrides_applied: 0
---

# Phase 93: Eval Pipeline & Quality KPIs Verification Report

**Phase Goal:** Persist per-persona quality scores from Ástríðr (EVAL-01), judge sessions nightly against a rubric via LLM (EVAL-02), and detect quality regressions with alerts + operator KPI surface (EVAL-03).
**Verified:** 2026-07-06
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | task_quality event POSTed to /runtime-ingest with valid Bearer stores exactly one evalScores row | VERIFIED | `convex/runtimeIngest.ts:78-93` dispatches `case "task_quality"` → `internal.evalScores.ingestTaskQuality` (`convex/evalScores.ts:70-110`); `npx vitest run convex/evalScores.test.ts` 75/75 green |
| 2 | Same task_quality event redelivered (same idempotencyKey) inserts no second row | VERIFIED | `ingestTaskQuality` queries `by_idempotencyKey` and early-returns before insert (`evalScores.ts:91-99`) |
| 3 | Changing a persona's modelPreferences via upsertConfig writes a configChanges audit row | VERIFIED | `convex/profiles.ts:109-124` inserts `configChanges` only when `modelPreferences` changes; `personaConfigChangeKey` exported (`profiles.ts:84-85`) |
| 4 | Nightly Convex internalAction samples ≤3 completed sessions per active persona and LLM-judges each against a rubric | VERIFIED | `judgeSessionsAction` (`evalScores.ts:765-818`), `MAX_SESSIONS_PER_PERSONA = 3` (`evalScores.ts:636`), `crons.ts:137-141` registers `judge-sampled-sessions` at `hourUTC: 5` |
| 5 | Each judged session writes exactly one llm_judge row with 4 dimensions+rationales, overall, rubric/model version stamps | VERIFIED | `storeEvalScoreHandler` (`evalScores.ts:535-576`) — idempotent on `judge:${sessionId}`, stamps `rubricVersion`/`judgeModel` |
| 6 | A judge call exhausting all 3 attempts writes NO row and does not abort the batch | VERIFIED | `callJudgeLLM` throws after `JUDGE_MAX_ATTEMPTS=3` (`evalScores.ts:442-497`); `runJudgeBatch` uses `Promise.allSettled` (`evalScores.ts:683-696`) |
| 7 | Judge dimension/overall scores outside [0,1] never persist | VERIFIED | `JudgeOutputSchema` zod `.min(0).max(1)` on every dimension + overall (`evalScores.ts:350-360`) |
| 8 | spawn_score fires a fire-and-forget POST to CodePulse /runtime-ingest with a task_quality event (producer side, astridr-repo) | VERIFIED | `langfuse_eval.py` `_post_task_quality` + call site inside `spawn_score`; `python -m pytest tests/test_langfuse_eval.py -q` → 9 passed (full relevant set 38 passed) |
| 9 | Mirror POST skips silently when CONVEX_URL/ASTRIDR_INGEST_API_KEY unset, never raises into score path | VERIFIED | env-gate + try/except swallow, pinned by tests |
| 10 | Payload carries profileId, session_id, agent_id, numeric score, producer-generated idempotencyKey | VERIFIED | confirmed in `langfuse_eval.py:120-134`; WR-01 fix adds `:turn` suffix so per-turn scores don't collide |
| 11 | Regression alert fires only when both windows have ≥5 judged sessions AND drop clears threshold | VERIFIED | `evaluateRegression` (`evalScores.ts:1110-1127`), `MIN_SESSIONS_PER_SIDE=5`, `REGRESSION_DROP_THRESHOLD=0.15` |
| 12 | 2-vs-2, 4-vs-6, sub-threshold, single-outlier comparisons never fire | VERIFIED | boundary logic gated by `minPerSide` check before threshold check; part of the 75 green `evalScores.test.ts` tests |
| 13 | Fired regression alert created via createIfNew delivery shape (webhookStatus pending + scheduled sendAlertWebhook), not public alerts.create | VERIFIED | `insertRegressionAlertHandler` sets `webhookStatus: "pending"` (`evalScores.ts:1239-1248`); `detectRegressionsForPersona` schedules `internal.webhookDelivery.sendAlertWebhook` (`evalScores.ts:1346-1349`); `sendAlertWebhook` confirmed defined in `convex/webhookDelivery.ts:406` |
| 14 | KPI queries return per-persona current score + sparkline + change-event markers, joined to profileConfigs/profileSwitches/configChanges | VERIFIED | `listPersonaKpis`, `getPersonaDetail` (`evalScores.ts:942-1068`) read `profileConfigs`/`profileSwitches`/`configChanges` via indexed queries |
| 15 | Quality nav entry (Gauge icon, OBSERVE) routes to /quality showing per-persona KPI grid | VERIFIED | `DashboardLayout.tsx:118,190`; `App.tsx:96-97` routes; `Quality.tsx` renders grid via `useQualityKpis` |
| 16 | Persona cards show score/100, sparkline, delta badge, REGRESSION badge, click navigates to /quality/:profileId | VERIFIED | `Quality.tsx:45-98` (`QualityKpiCard`) |
| 17 | Persona detail renders multi-dimension LineChart w/ ReferenceLine change markers, per-dimension breakdown, judged-sessions list w/ rationale + View session link | VERIFIED | `QualityTrendChart.tsx` (numeric time axis + `ReferenceLine`, WR-05 fixed); `QualityDetail.tsx:110-171` |
| 18 | Empty states render when no evalScores exist (no crash) | VERIFIED | `Quality.tsx:159-167` page-level; `Quality.tsx:67-71` per-card; `QualityTrendChart.tsx:111-114`; `QualityDetail.tsx:119-122,140-143` |

**Score:** 18/18 truths verified

### Live E2E / Calibration (Plan 06 — documented evidence, not re-run)

Per task instructions, prod-state claims in `93-06-SUMMARY.md` are treated as documented evidence and were not re-executed (no prod mutations re-run):

- Real Ástríðr Telegram-turn `task_quality` score landed on prod (`tidy-whale-981`) as an `evalScores` row (`profileId: "personal"`), confirmed returned by `listPersonaKpis`.
- Judge manually triggered against prod: 3/3 sessions scored with full row shape (4 dims + rationales + `rubricVersion: "v1"` + `judgeModel: "claude-haiku-4-5"`); E7 liveness summary logged; operator visually confirmed the `/quality/unknown` drill-in.
- `93-CALIBRATION.md` seeded per its own plan's acceptance criteria, which explicitly permits an "labels pending — trends not yet trusted" terminal state (`93-06-PLAN.md` Task 3 acceptance criteria) — 12 real prod sessions, frozen digests, labeling table present, gate explicitly recorded as **NOT EVALUATED**, verdict explicitly "trends NOT trusted" until Larry fills labels. This satisfies the plan's own bar; it is not a gap.

### Code Review Findings (93-REVIEW.md) — fix verification

All 11 fixed findings (3 Critical + 8 Warning) were independently re-checked against the live code (not just trusted from the review doc):

| Finding | Fix location verified | Confirmed |
|---|---|---|
| CR-01 (judge window wrong day) | `judgeWindowDayStart()` subtracts 86400 (`evalScores.ts:707-709`), called at `evalScores.ts:776` | Yes |
| CR-02 (regression dedup keyed to mutable status) | `getRegressionAlertsInternal` returns all statuses; dedup on `details.changeDate` (`evalScores.ts:1168-1178, 1285-1300`) | Yes |
| CR-03 (OpenAI strict schema invalid) | `OPENAI_JUDGE_SCHEMA` adds `additionalProperties: false`, strips min/max (`evalScores.ts:315-325`) | Yes |
| WR-01 (mirror idempotency omits turn) | `key = f"{session_id}:{agent_id}:{name}:{turn}"` when turn provided (`langfuse_eval.py:126-130`) | Yes |
| WR-02 (dead persona fallback "default") | `resolve_operational_profile()` helper, applied at 3 call sites incl. `loop.py:1089` | Yes |
| WR-03 (KPI blends binary + judge scores) | All 3 reads (`listPersonaKpis`, `getPersonaDetail`, `getEvalScoresWindowInternal`) filter `scoreName === "llm_judge"` (`evalScores.ts:977,988,1047,1217`) | Yes |
| WR-04 (range selector doesn't move data window) | `listPersonaKpis` takes `rangeDays` arg; `useQualityKpis(rangeDays)` threads it through (`useEvalScores.ts:10-17`, `Quality.tsx:118`) | Yes |
| WR-05 (ReferenceLine silently drops) | `QualityTrendChart.tsx` uses numeric `type="number"` XAxis with domain spanning series+markers (`QualityTrendChart.tsx:118-124`) | Yes |
| WR-06 (public mutation bypasses Bearer gate) | `ingestTaskQuality` is `internalMutation` (`evalScores.ts:70`), called via `internal.evalScores.ingestTaskQuality` from `runtimeIngest.ts:89` | Yes |
| WR-07 (audit rows always attributed to "dashboard") | `changedBy: v.optional(v.string())` on `upsertConfig`; runtimeIngest passes `"astridr-sync"` (`profiles.ts:100,124`) | Yes |
| WR-08 (no per-persona isolation, summary suppressed) | `runRegressionSweep` per-persona try/catch (`evalScores.ts:1365-1383`); E7 summary logged before the regression pass (`evalScores.ts:795-809`) | Yes |

IN-01 and IN-02 remain open by design (Info severity, explicitly out of fix scope per review).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | `evalScores` table + 3 indexes | VERIFIED | `evalScores: defineTable` (L1727), `by_idempotencyKey`/`by_profileId`/`by_scoreName` (L1738-1740) |
| `convex/evalScores.ts` | Full ingest/judge/regression/KPI module | VERIFIED | 1401 lines; all exports present (`ingestTaskQuality`, `processTaskQualityEvent`, `judgeSessionsAction`, `sampleSessionsForPersonas`, `evaluateRegression`, `listPersonaKpis`, `getPersonaDetail`, `listJudgedSessions`, `detectRegressions`) |
| `convex/runtimeIngest.ts` | `case "task_quality"` dispatch | VERIFIED | L78-93, routes to `internal.evalScores.ingestTaskQuality` |
| `convex/profiles.ts` | `configChanges` audit insert + `personaConfigChangeKey` | VERIFIED | L84-85, L109-124 |
| `convex/crons.ts` | 05:00 UTC judge cron | VERIFIED | L137-141 `judge-sampled-sessions` |
| `astridr-repo/astridr/integrations/langfuse_eval.py` | `_post_task_quality` mirror + call site | VERIFIED | confirmed content + WR-01 fix |
| `astridr-repo/astridr/agent/post_turn_pipeline.py` | `resolve_operational_profile()` | VERIFIED | WR-02 fix present |
| `src/hooks/useEvalScores.ts` | `useQualityKpis`/`usePersonaDetail`/`useJudgedSessions` | VERIFIED | all 3 exported, WR-04-aware |
| `src/components/QualityTrendChart.tsx` | LineChart + ReferenceLine, numeric axis | VERIFIED | WR-05 fix present |
| `src/pages/Quality.tsx` | KPI grid page | VERIFIED | 229 lines, metric row + card grid + range Select |
| `src/pages/QualityDetail.tsx` | Persona drill-in | VERIFIED | 175 lines, trend chart + dimension breakdown + judged sessions |
| `src/layouts/DashboardLayout.tsx` / `src/App.tsx` | Nav entry + lazy routes | VERIFIED | Gauge icon, OBSERVE group, `/quality` + `/quality/:profileId` routes |
| `.planning/phases/93.../93-CALIBRATION.md` | E3 reference set | VERIFIED | 165 lines, 12 sessions, labeling table, explicit non-trust verdict (satisfies plan's own acceptance criteria) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `runtimeIngest.ts` task_quality case | `internal.evalScores.ingestTaskQuality` | `ctx.runMutation` | WIRED | L89 |
| `evalScores.ts` ingestTaskQuality | `by_idempotencyKey` index | early-return dedup | WIRED | L91-99 |
| `crons.ts` | `internal.evalScores.judgeSessionsAction` | `crons.daily` hourUTC 5 | WIRED | L137-141 |
| `evalScores.ts` storeEvalScore | `by_idempotencyKey` index | `judge:${sessionId}` | WIRED | L539-546 |
| `evalScores.ts` detectRegressions | `internal.webhookDelivery.sendAlertWebhook` | `ctx.scheduler.runAfter` after alert insert | WIRED | L1346-1349; `sendAlertWebhook` confirmed defined |
| `judgeSessionsAction` | `detectRegressions` | tail call after allSettled batch | WIRED | L805-809 |
| `Quality.tsx` | `api.evalScores.listPersonaKpis` | `useQualityKpis` hook | WIRED | `Quality.tsx:118` |
| `App.tsx` | `Quality.tsx`/`QualityDetail.tsx` | lazy route | WIRED | `App.tsx:96-97` |
| `langfuse_eval.py spawn_score` | CodePulse `/runtime-ingest` | `asyncio.create_task` fire-and-forget POST | WIRED | confirmed in producer file; live prod row is documented evidence |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CodePulse type safety | `npx tsc --noEmit` | exit 0, no output | PASS |
| CodePulse full unit/component suite | `npx vitest run` | 162 files / 1607 tests passed, 187 todo, 0 failed | PASS |
| evalScores module unit tests | `npx vitest run convex/evalScores.test.ts` | 75/75 passed | PASS |
| astridr-repo producer/self-improvement/web-auth tests | `python -m pytest tests/test_langfuse_eval.py tests/test_self_improvement.py tests/test_web_auth.py -q` | 38/38 passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| EVAL-01 | 93-01, 93-03 | Ástríðr task_quality scores persisted idempotently via bearer-authed ingest | SATISFIED | ingest mutation + dispatch case (93-01) + producer mirror (93-03), live prod row documented (93-06) |
| EVAL-02 | 93-02 | Nightly Convex internalAction LLM-judges sampled sessions against a rubric | SATISFIED | judgeSessionsAction + cron + dual-provider caller + zod validation; 3 live judge rows documented (93-06) |
| EVAL-03 | 93-04, 93-05 | Per-persona quality KPI/trend + regression detection joined to profileSwitches/configChanges | SATISFIED | detectRegressions + KPI queries (93-04); Quality/QualityDetail UI (93-05) |

Cross-referenced against `.planning/REQUIREMENTS.md`: all three (EVAL-01, EVAL-02, EVAL-03) are listed under "Phase 93 — Complete" with no other phase claiming them. No orphaned requirements for this phase — TRACE-01/02 and HARD-01..04 are explicitly Phase 94/95, out of this phase's scope.

### Anti-Patterns Found

None blocking. Scanned `convex/evalScores.ts`, `convex/runtimeIngest.ts`, `convex/profiles.ts`, `src/pages/Quality.tsx`, `src/pages/QualityDetail.tsx`, `src/components/QualityTrendChart.tsx` for TODO/FIXME/XXX/placeholder/stub markers and hardcoded-empty-return patterns — none found. The two Info-severity findings from code review (IN-01 biased Fisher-Yates-lacking shuffle, IN-02 unused test import) remain open by explicit, documented design (out of fix scope, non-blocking).

### Human Verification Required

None blocking phase completion. The following are explicitly documented, already-surfaced **operator follow-up items** from `93-06-SUMMARY.md`'s "Known Stubs / Pending Human Items" table — per task instructions these are known outstanding items that do NOT count as gaps:

1. **Final astridr container rebuild** — applies the SELF-01 revert (`1d249d5c`) and the web-auth fix (`674a13c4`); astridr container currently still running pre-fix code. Owner: Larry.
2. **`/quality` grid visual refresh** — the `personal` KPI card visual re-confirmation after sign-in (drill-in page was already visually confirmed). Owner: Larry.
3. **E3 calibration labels** — filling the H-columns in `93-CALIBRATION.md` and computing the ≥0.7 agreement gate. Explicitly and correctly left pending per the plan's own acceptance criteria (a "labels pending" terminal state is an allowed outcome, not a gap).
4. **Convex prod redeploy carrying the post-review fixes** — the 11 review-fixed commits (CR-01/02/03, WR-01..08) landed in the repos after the 93-06 live-E2E verification ran; a fresh `npx convex deploy` (and astridr container rebuild for the astridr-side fixes) is needed to carry these fixes into the currently-running prod deployment.

None of these block the phase's goal-backward truths — all are implemented, tested, and reviewed in the codebase; the remaining items are deployment/labeling operations outside the scope of "does the code achieve the goal."

## Gaps Summary

No gaps found. All 18 derived observable truths (roadmap EVAL-01/02/03 plus all 6 plans' must-haves) are verified against live code: artifacts exist, are substantive (not stubs), are wired end-to-end, and pass their own test suites (CodePulse: 1607/1607 vitest tests + clean `tsc --noEmit`; astridr-repo: 38/38 relevant pytest tests). All 11 code-review-fixed findings were independently re-verified in the current code, not merely trusted from `93-REVIEW.md`'s claims. Live E2E completion (D-04) and the E3 calibration seed are documented with concrete evidence (real prod session ID, actual query results, frozen digests) rather than assumed. Remaining items are explicit, non-silent operator handoffs (container rebuild, prod redeploy, visual re-confirm, calibration labeling) that the phase's own plans intentionally deferred to the operator and are not required for phase-goal achievement in the codebase.

---

_Verified: 2026-07-06_
_Verifier: Claude (gsd-verifier)_
