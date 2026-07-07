---
phase: 93-eval-pipeline-quality-kpis
plan: 02
subsystem: backend
tags: [convex, llm-as-judge, eval-pipeline, cron, zod, dual-provider-caller]

# Dependency graph
requires: ["93-01"]
provides:
  - "intelligence.llm_eval config slot (setLLMConfig accepts \"eval\"; getEvalLLMConfigInternal reader)"
  - "buildJudgeDigest — pure, evidence-preserving session digest builder (events/sessions/llmMetrics -> bounded prompt text)"
  - "JUDGE_TOOL/JudgeOutputSchema/callAnthropicJudge/callOpenAIJudge/callJudgeLLM — dual-provider judge caller with 3-attempt zod-validated retry loop"
  - "storeEvalScore — idempotent llm_judge row writer (judge:${sessionId}, rubricVersion/judgeModel stamped)"
  - "judgeSessionsAction — nightly internalAction: samples <=3 sessions/active-persona, judges each, Promise.allSettled-isolated, N sampled/scored/failed/unknown-persona liveness summary"
  - "judge-sampled-sessions cron at 05:00 UTC"
affects: ["93-03"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third isolated LLM config slot (intelligence.llm_eval) alongside primary/backup — D-07 so briefing-model changes never reweight judge scoring"
    - "Extracted-handler test pattern: storeEvalScoreHandler exported separately from the internalMutation wrapper so its idempotency/insert logic is unit-testable against a hand-rolled fake ctx.db, without convex-test"
    - "Promise.allSettled batch isolation with an extracted runJudgeBatch helper, directly unit-testable without a Convex ctx"
    - "Documented persona-attribution join (PERSONA DECISION comment) resolving a genuinely ambiguous cross-repo identity question in code, not silently"

key-files:
  created: []
  modified:
    - convex/briefings.ts
    - convex/evalScores.ts
    - convex/evalScores.test.ts
    - convex/crons.ts

key-decisions:
  - "PERSONA DECISION: \"active persona\" = profileConfigs rows (personal/business/consulting); sessions attributed to a persona via llmMetrics.agentId (best-effort join, documented in-code with the astridr loop.py:1537 fallback caveat); unattributable sessions are judged under an explicit \"unknown\" bucket and counted in the liveness summary rather than dropped"
  - "storeEvalScore's handler is extracted as a standalone exported function (storeEvalScoreHandler) taking a minimal { db } shape, so idempotency/insert behavior is directly unit-tested against a fake in-memory db — a stronger test than a re-implemented mirror predicate, and still convex-test-free"
  - "runJudgeBatch extracted as its own exported function wrapping Promise.allSettled, so the allSettled-isolation invariant (one failing session must not drop the others) is unit-tested directly rather than only inferred from code review"
  - "callJudgeLLM returns { output, model } (not just output) so judgeOneSession can stamp judgeModel on the stored row without a second config read"
  - "listConfigs is a public query (convex/profiles.ts), so judgeSessionsAction calls it via api.profiles.listConfigs, not internal.profiles.listConfigs — internalActions may call public queries freely"

patterns-established:
  - "Judge config slot + digest + caller + sampling all live in evalScores.ts (D-07 isolation), never touching briefings.ts's callLLMWithFallback"

requirements-completed: [EVAL-02]

# Metrics
duration: ~35min
completed: 2026-07-05
---

# Phase 93 Plan 02: Eval Pipeline — Nightly LLM-Judge Summary

**A nightly Convex `internalAction` (05:00 UTC) samples up to 3 completed sessions per active persona, LLM-judges each against a code-defined 4-dimension rubric via an isolated `intelligence.llm_eval` config slot, and writes version-stamped `llm_judge` rows into `evalScores` — with `Promise.allSettled` failure isolation and zero poisoned rows on judge exhaustion.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments

- **Eval config slot (D-07):** `setLLMConfig`'s slot validation now accepts `"eval"` alongside `"primary"`/`"backup"`; `getEvalLLMConfigInternal` reads `agentConfigs` key `intelligence.llm_eval` in isolation, so a briefing-model change can never silently reweight judge scoring.
- **Digest builder:** `buildJudgeDigest` is a pure function that aggregates events into tool/eventType counts, truncates free-text payload snippets to ~250 chars while always preserving the failing tool/operation name verbatim (E6 digest fidelity), and summarizes `llmMetrics` into cost/token totals — target well under 1-2K tokens per session.
- **Dual-provider judge caller:** `callAnthropicJudge`/`callOpenAIJudge` mirror `briefings.ts`'s provider branch but with forced `tool_choice`/strict `response_format.json_schema`, `temperature: 0`, `max_tokens: 1024`, and no `budget_tokens`/thinking config (verified via grep: zero occurrences). `callJudgeLLM` runs a 3-attempt loop: zod-validation failures get a repair prompt appended for the next attempt; HTTP failures retry without a repair message; exhaustion throws (no row written, session stays re-sampleable).
- **Idempotent judge store:** `storeEvalScore` (backed by the directly-testable `storeEvalScoreHandler`) writes exactly one `llm_judge` row per session (`idempotencyKey: judge:${sessionId}`), stamping `rubricVersion` ("v1") and `judgeModel` for E5 trend attributability, with per-dimension `{score, rationale}` maps.
- **Nightly sampling action + cron:** `judgeSessionsAction` reads active personas (`profileConfigs` via `api.profiles.listConfigs`), reads a day's candidate completed sessions with best-effort `llmMetrics.agentId` persona attribution, samples ≤3/persona via the pure `sampleSessionsForPersonas`, judges each session with `Promise.allSettled` isolation (`runJudgeBatch`), and logs an `N sampled / N scored / N failed / N unknown-persona` liveness summary. Registered at `05:00 UTC` in `convex/crons.ts` (free slot between the 04:30 graph-snapshot sweep and 06:00 daily digest).
- **Persona-attribution decision made explicit in code** (not silently baked into a query): a top-of-function comment in `getCandidateSessionsInternal` documents the `llmMetrics.agentId` → persona join, including the known `astridr/agent/loop.py:1537` `_agent_type` fallback gap, and unattributable sessions land in an explicit `"unknown"` bucket that is counted and surfaced rather than dropped.

## Task Commits

Each task was committed atomically:

1. **Task 1: Eval config slot + digest builder** — `b1a9c18` (feat)
2. **Task 2: Dual-provider judge caller + zod validation + idempotent store** — `0f74b7a` (feat)
3. **Task 3: Nightly sampling internalAction + cron** — `ed6a0a8` (feat)

**Plan metadata:** (this commit)

_All three tasks were `tdd="true"`; tests were written alongside the implementation in the same commit per this repo's convex-test-absent convention (plain vitest unit tests on extracted pure functions / directly-testable handlers, matching the established `runtimeIngest.test.ts`/`briefings.test.ts` precedent read at plan start)._

## Files Created/Modified

- `convex/briefings.ts` — `setLLMConfig` slot validation extended to accept `"eval"` (D-07)
- `convex/evalScores.ts` — Added: `getEvalLLMConfigInternal`, `getJudgeDigestInternal`, `buildJudgeDigest`; `JUDGE_TOOL`/`JUDGE_TOOL_NAME`, `RUBRIC_VERSION`, `JudgeOutputSchema`, `callAnthropicJudge`/`callOpenAIJudge`, `callJudgeLLM`, `storeEvalScoreHandler`/`storeEvalScore`; `sampleSessionsForPersonas`, `runJudgeBatch`, `getCandidateSessionsInternal`, `judgeOneSession` (module-private), `judgeSessionsAction`
- `convex/evalScores.test.ts` — 22 new tests: digest builder (4), zod schema (4), judge caller retry loop (5), idempotent store (4), sampling invariants (4), allSettled isolation (3) — total file now 36 tests, all green
- `convex/crons.ts` — `judge-sampled-sessions` daily cron at `hourUTC: 5, minuteUTC: 0`

## Decisions Made

- **PERSONA DECISION** (resolves RESEARCH Pitfall 1 / Open Question 1 explicitly): "active persona" = `profileConfigs` rows (`personal`/`business`/`consulting`), consistent with UI-SPEC Assumption #6. Since `sessions`/`events` carry no `profileId`, a candidate session is attributed via its `llmMetrics.agentId` — astridr's `loop.py`/`insight_extractor.py` set `agent_id` to the active profile at most call sites, but `loop.py:1537`'s `self_improvement.py` path falls back to `_agent_type` instead, so attribution is not total. Unattributable sessions are judged under an explicit `"unknown"` persona bucket (not dropped) and that bucket's volume is counted in the action's liveness summary — attribution drift is visible in prod, not silently absorbed. This rationale is written as a top-of-section comment in `evalScores.ts`, not left as an implicit assumption.
- **`storeEvalScoreHandler` extracted as its own exported function** taking a minimal `{ db }` shape (query/withIndex/first/insert), rather than only testing a re-implemented mirror predicate (Plan 01's approach for `ingestTaskQuality`). This lets the idempotency dedup and dimension-mapping logic be unit-tested against a real (if hand-rolled) fake `ctx.db`, exercising the actual production code path, not a parallel copy — still zero dependency on `convex-test`.
- **`runJudgeBatch` extracted as its own function** wrapping `Promise.allSettled` over the sampled sessions, so the "one failing session doesn't drop the others" invariant (Pitfall 5/4b.2) is directly unit-tested rather than only verified by code review / grep.
- **`callJudgeLLM` returns `{ output, model }`** (not bare output) so the caller can stamp `judgeModel` on the stored row without a second config read.
- **`listConfigs` is a public `query`** (not `internalQuery`) in `convex/profiles.ts` — `judgeSessionsAction` therefore calls it via `api.profiles.listConfigs`, not `internal.profiles.listConfigs` (internalActions may call public queries directly; this surfaced as a `tsc` error and was fixed in-task, Rule 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `internal.profiles.listConfigs` does not exist — `listConfigs` is a public query**
- **Found during:** Task 3 (`npx tsc --noEmit` verification)
- **Issue:** `judgeSessionsAction` was written calling `internal.profiles.listConfigs`, but `listConfigs` in `convex/profiles.ts` is exported via `query(...)`, not `internalQuery(...)`, so it only exists on the generated `api` namespace, not `internal`.
- **Fix:** Imported `api` alongside `internal` from `./_generated/api` and switched the call to `api.profiles.listConfigs` (internalActions can call public queries directly).
- **Files modified:** `convex/evalScores.ts`
- **Verification:** `npx tsc --noEmit` exits 0.
- **Committed in:** `ed6a0a8` (Task 3 commit)

**2. [Rule 3 - Blocking] `storeEvalScoreHandler`'s ctx type union collapsed to `any`, losing index-callback inference**
- **Found during:** Task 2 (`npx tsc --noEmit` verification)
- **Issue:** Typing `ctx: { db: EvalScoreDb } | any` (needed so the function is assignable to the real Convex `internalMutation` handler signature, which has a much stricter `GenericMutationCtx`) collapses the parameter type to `any`, which then made the `withIndex` callback parameter `q` an implicit-any TS error under strict mode.
- **Fix:** Added an explicit inline type annotation on the `withIndex` callback parameter (`q: { eq: (field: string, value: any) => any }`).
- **Files modified:** `convex/evalScores.ts`
- **Verification:** `npx tsc --noEmit` exits 0.
- **Committed in:** `0f74b7a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both blocking, both required to satisfy the plan's own `tsc --noEmit` acceptance criterion)
**Impact on plan:** No scope creep — both fixes were required to unblock `tsc --noEmit`, which every task in this plan lists as an explicit acceptance criterion.

## Issues Encountered

None beyond the above.

## User Setup Required

- **`intelligence.llm_eval` config slot must be set before the nightly cron can produce any scores.** The judge cron (`judge-sampled-sessions`, 05:00 UTC) will run every night regardless, but `getEvalLLMConfigInternal` returns `null` (or an empty `apiKey`) until an operator sets the slot via `setLLMConfig({ slot: "eval", provider: "anthropic", model: "claude-haiku-4-5", apiKey: "..." })` from the Settings page (or an equivalent dashboard mutation call). Until then, `callJudgeLLM` throws `"Eval LLM not configured (intelligence.llm_eval)"` for every sampled session — each session simply gets zero rows and remains re-sampleable (no poisoned dedup key), and the liveness summary (`N sampled / N scored / N failed / N unknown-persona`) will show `failed === sampled` every night until the key is set. This matches the plan's own `user_setup` frontmatter entry and is expected — no code fix is possible for a missing operator-provided API key.
- No other external service configuration required this plan (no new packages — `zod` already installed per RESEARCH).

## Next Phase Readiness

- `evalScores` now has both `task_quality` (Plan 01) and `llm_judge` (this plan) rows landing in the same table with `rubricVersion`/`judgeModel` version stamps — Plan 03 (regression detection / KPI page) can read both `scoreName`s from one table without further schema work.
- The `"unknown"` persona bucket and its liveness count give Plan 03 (or a future ops pass) an observable signal if attribution drift grows — no action needed yet, but the counter exists.
- **D-04 live-E2E bar is NOT yet closed by this plan** — this plan is convex-test-free unit coverage only (fixture-based, no live LLM call). A real Ástríðr session must still be judged end-to-end against prod Convex (`tidy-whale-981`) with a real `intelligence.llm_eval` key configured before EVAL-02 is considered fully done per the phase's `<verification>` section ("Manual live judge run deferred to Plan 06"). No blocker for Plan 03 in the meantime — it depends on the schema/rows, not on a live judge run having occurred.
- No blockers identified for 93-03.

---
*Phase: 93-eval-pipeline-quality-kpis*
*Completed: 2026-07-05*

## Self-Check: PASSED

All modified files verified present (`convex/briefings.ts`, `convex/evalScores.ts`, `convex/evalScores.test.ts`, `convex/crons.ts`); all 3 task commits (`b1a9c18`, `0f74b7a`, `ed6a0a8`) verified in `git log`; full `npm test` suite green (1561 passed, 187 todo, 0 failed); `npx tsc --noEmit` clean; zero `budget_tokens`/`thinking` occurrences in `convex/evalScores.ts`; zero `Promise.all(` occurrences over the sampling loop.
