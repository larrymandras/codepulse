---
phase: 93
slug: eval-pipeline-quality-kpis
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 93 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom; extracted pure-function pattern for Convex — convex-test NOT installed) + pytest (astridr-repo producer side) |
| **Config file** | vitest via vite.config.ts, setup at src/test/setup.ts; pytest in astridr-repo |
| **Quick run command** | `npx vitest run <file>` (Convex/UI) · `python -m pytest tests/test_langfuse_eval.py -q` (producer) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 93-01-01 | 01 | 1 | EVAL-01 | T-93-01 / T-93-02 / T-93-03 | Idempotent `by_idempotencyKey` dedup + inherited Bearer auth + `[0,1]` score clamp/reject | unit (extracted-logic) | `npx vitest run convex/evalScores.test.ts convex/runtimeIngest.test.ts` | ❌ W0 | ⬜ pending |
| 93-01-02 | 01 | 1 | EVAL-01 (enables EVAL-03 / D-11) | — (dashboard-gated write) | Auditable `configChanges` row on persona model change | unit (extracted-logic) | `npx vitest run convex/evalScores.test.ts -t "configChange"` | ❌ W0 | ⬜ pending |
| 93-02-01 | 02 | 2 | EVAL-02 | T-93-05 | eval config slot isolated; apiKey never logged/returned | unit (extracted-logic) | `npx vitest run convex/evalScores.test.ts -t "digest"` | ❌ W0 | ⬜ pending |
| 93-02-02 | 02 | 2 | EVAL-02 | T-93-04 / T-93-07 | zod `[0,1]` bounds; no poisoned/partial row on exhausted retry | unit (fixture replay, no live LLM) | `npx vitest run convex/evalScores.test.ts -t "judge"` | ❌ W0 | ⬜ pending |
| 93-02-03 | 02 | 2 | EVAL-02 | T-93-06 | `Promise.allSettled` isolation; ≤3/persona cost cap; unknown-bucket counted | unit (extracted-logic) | `npx vitest run convex/evalScores.test.ts -t "sampling\|allSettled\|partial"` | ❌ W0 | ⬜ pending |
| 93-03-01 | 03 | 2 | EVAL-01 | T-93-08 / T-93-09 | Bearer key env-only; fire-and-forget, never raises into score path | syntax (ast parse) | `cd C:/Users/mandr/astridr-repo && python -c "import ast; ast.parse(open('astridr/integrations/langfuse_eval.py').read()); print('ok')"` | ❌ W0 | ⬜ pending |
| 93-03-02 | 03 | 2 | EVAL-01 | T-93-08 / T-93-09 | Gated mirror payload/header + never-raises isolation pinned by test | unit (mocked HTTP) | `cd C:/Users/mandr/astridr-repo && python -m pytest tests/test_langfuse_eval.py -q` | ❌ W0 | ⬜ pending |
| 93-04-01 | 04 | 3 | EVAL-03 | T-93-12 | KPI queries index-bound; never return apiKey | unit (extracted-logic) | `npx vitest run convex/evalScores.test.ts -t "kpi\|meanOverall\|delta"` | ❌ W0 | ⬜ pending |
| 93-04-02 | 04 | 3 | EVAL-03 | T-93-10 / T-93-11 | ≥5/side + threshold gate (no false fire); delivered via createIfNew shape | unit (boundary fixtures) | `npx vitest run convex/evalScores.test.ts -t "regression\|alert delivery"` | ❌ W0 | ⬜ pending |
| 93-05-01 | 05 | 4 | EVAL-03 | T-93-13 | Rationale rendered via React text nodes only (no XSS) | unit (jsdom render) | `npx vitest run src/pages/Quality.test.tsx` | ❌ W0 | ⬜ pending |
| 93-05-02 | 05 | 4 | EVAL-03 | T-93-12 / T-93-13 | No apiKey to client; text-only rendering | unit (jsdom render) | `npx tsc --noEmit && npx vitest run src/pages/Quality.test.tsx` | ❌ W0 | ⬜ pending |
| 93-05-03 | 05 | 4 | EVAL-03 | — | Lazy-chunked routes build clean | build | `npx tsc --noEmit && npm run build` | ✅ (build, no test file) | ⬜ pending |
| 93-06-01 | 06 | 5 | EVAL-01 / EVAL-02 / EVAL-03 | T-93-14 / T-93-SC | Operator-gated prod deploy + secret handling | manual-only | see Manual-Only Verifications | n/a | ⬜ pending |
| 93-06-02 | 06 | 5 | EVAL-01 / EVAL-02 / EVAL-03 | T-93-SC | Live E2E human-verify (D-04) — green tests do not substitute | manual-only | see Manual-Only Verifications | n/a | ⬜ pending |
| 93-06-03 | 06 | 5 | EVAL-01 / EVAL-02 / EVAL-03 | T-93-15 | Judge calibration ≥0.7 agreement gate recorded before trends trusted | file+grep | `test -f .planning/phases/93-eval-pipeline-quality-kpis/93-CALIBRATION.md && grep -qi "agreement" .planning/phases/93-eval-pipeline-quality-kpis/93-CALIBRATION.md && echo ok` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Source: transcribed from RESEARCH.md § Validation Architecture "Phase Requirements → Test Map" (EVAL-01/02/03 rows) expanded to per-task granularity against the six plan files.*

---

## Wave 0 Requirements

- [ ] `convex/evalScores.test.ts` — new file; covers EVAL-01 (idempotency + snake/camel coalesce), EVAL-02 (digest, judge zod/retry, allSettled sampling), EVAL-03 (regression threshold math, alert-delivery shape, `meanOverall`/`periodDelta` KPI helpers). Created in 93-01-01, extended by 93-02 and 93-04 tasks.
- [ ] `convex/runtimeIngest.test.ts` — extend with a `describe("runtimeIngest — task_quality case")` block mirroring the existing `processSwarmTaskEvent` extracted-logic pattern (93-01-01).
- [ ] `src/pages/Quality.test.tsx` — new jsdom rendering test for `QualityTrendChart` (line-per-dimension + ReferenceLine markers) and the KPI/detail pages (93-05-01).
- [ ] `C:/Users/mandr/astridr-repo/tests/test_langfuse_eval.py` — extend (cross-repo) with the gated-mirror payload/header assertions + never-raises isolation (93-03-02).
- [ ] **No framework install needed** — vitest/zod (Convex+UI) and pytest (producer) already present; `convex-test` is intentionally NOT installed — follow the extracted-pure-function convention (`runtimeIngest.test.ts`/`swarmTasks.test.ts`/`cacheStats.test.ts`/`briefings.test.ts`).

*Wave 0 flips `wave_0_complete: true` during execution once the above scaffolds exist and import cleanly.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Configure eval LLM key + deploy Convex backend to prod + point astridr env at `tidy-whale-981` | EVAL-01 / EVAL-02 / EVAL-03 | Prod deploy + secret handling — Claude cannot run a prod deploy or handle the Anthropic API key | 93-06 Task 1: `npx convex deploy --yes`; set the `intelligence.llm_eval` slot via the dashboard `setLLMConfig` (provider `anthropic`, model `claude-haiku-4-5`, apiKey); confirm astridr `CONVEX_URL` + `ASTRIDR_INGEST_API_KEY` resolve to `tidy-whale-981` |
| Live E2E: a real Ástríðr-emitted `task_quality` score reaches prod Convex and renders on the Quality page; a manual judge run writes an `llm_judge` row that renders on persona detail (D-04) | EVAL-01 / EVAL-02 / EVAL-03 | Requires a real cross-repo score emission against prod + visual confirmation of the live UI; green tests do not substitute (Phase 90 lesson — the cross-repo gate was flagged but only live testing surfaced the real gaps) | 93-06 Task 2: trigger `spawn_score`, confirm a `task_quality` `evalScores` row on `tidy-whale-981`, confirm the persona KPI card updates (`/quality`), manually run `judgeSessionsAction`, confirm an `llm_judge` row (4 dims + rationales + rubricVersion + judgeModel) renders on persona detail, and confirm the `N sampled / N scored / N failed` liveness summary logged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (93-06 Tasks 1-2 are the only intentionally manual gates — operator-only prod deploy + live-E2E, D-04)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (the two manual checkpoints in 93-06 are followed immediately by the automated calibration-file check in Task 3)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-05
