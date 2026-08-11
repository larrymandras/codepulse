---
phase: 119-loom-curated-pipelines
verified: 2026-08-11T14:05:00Z
status: passed
score: 4/4 goal clauses verified
overrides_applied: 0
---

# Phase 119: Loom Curated Pipelines Verification Report

**Phase Goal (ROADMAP):** `pipelines`/`pipelineRuns` + React Flow view + step-event emits over Convex subscriptions.
**Design source:** `docs/proposals/2026-08-07-seidr-suite-design.md` §4.4.
**Verified:** 2026-08-11 · **Status:** passed · Initial verification.

## Goal Achievement

| # | Clause | Status | Evidence |
|---|---|---|---|
| 1 | `pipelines` / `pipelineRuns` exist and are live | ✓ | `npx convex deploy` → `127.0.0.1:3210`, zero `.convex.cloud`, no indexes deleted, `[+] pipelines.by_slug`, `[+] pipelineRuns.by_pipelineSlug`, `[+] pipelineRuns.by_startedAt`. Live reads return 1 pipeline and 2 runs. |
| 2 | A React Flow view renders the pipeline | ✓ | `/loom` live probe: `Review + Verify` present, 3 `.react-flow__node`, 3 step testids, zero page errors. Reachable from the sidebar — `e2e/navigation.spec.ts` 10/10 including `/loom`. |
| 3 | Step-event emits drive it over Convex subscriptions | ✓ | Six real emits through `hooks/loom-emit.mjs` (exit 0 each) produced a run reading `status: error, currentStep: verify` with its four events in order, then a second clean run of six. No WebSocket layer involved. |
| 4 | An error renders distinctly, with a clean-run control | ✓ | Errored run → `["complete","error","pending"]` + `loom-run-error`. Clean run → `["complete","complete","complete"]` + `loom-run-complete`. Same pipeline and components; only the run differs. |

**Score:** 4/4

## Decision Coverage

| # | Decision | Status | Evidence |
|---|---|---|---|
| D-01 | Two tables per the doc's field list, docs in-row | ✓ | `convex/schema.ts`; `steps[].docMd` rendered by the side panel as plain text, never an HTML/markdown renderer. |
| D-02 | HTTP emit, no WebSocket layer | ✓ | One route; the UI animates through its existing subscription. |
| D-03 | Emit route bearer-gated, fail-closed | ✓ | 401 / 401-bogus measured before the key existed; **200** after. A real before/after, not two readings of one state. |
| D-04 | No CORS, no OPTIONS partner | ✓ | `OPTIONS /loom/event` 404 against control `OPTIONS /preflight-ingest` 204. |
| D-05 | `stepEvents` bounded, newest kept | ✓ | `LOOM_STEP_EVENT_CAP = 200`, pruned inline. Mutation: keeping the oldest fails 1 of 10. Cap depth not exercised live — no run has 200 events. |
| D-06 | Unknown slug refuses, never auto-creates | ✓ | 404 on a bogus slug, and `listPipelines` still returns exactly 1 afterwards — the refusal is proven by the absence of a new row, not by the status code alone. |
| D-07 | Loom is the only live-progress surface | ✓ | Recorded from `111-01-PLAN.md`'s own objective (turning Mission Board into post-hoc history), read directly rather than taken from the design doc's stale boundary sentence. |
| D-08 | Ástríðr cron lens deferred | ✓ | Not scanned; stated in `SKILL.md` and the scanner header with the reason. |

## Gates

`npx tsc --noEmit` exit 0 · `npx vitest run` **298 files / 3947 passed, 0
failures** · `e2e/navigation.spec.ts` 10/10 · scanner verified against ground
truth (6 workflows, phase titles matching each `meta`; `--gsd` → 8 steps; bad
path → exit 2).

## Gaps

1. **The seeded card has 3 steps; its source workflow declares 2.** Hand-seeded
   before the scanner existed. `/loom-author` proposes the correct `Review →
   Verify`.
2. **`LOOM_API_KEY` is backend-only** — the user-level copy was not set, so
   emits need it passed explicitly. Probed, with a working control.
3. **No committed e2e spec for `/loom`** beyond the nav test; the live gate was
   verified by direct probe, so it is not regression-guarded like `/bifrost`.
4. **D-05's cap depth and D-08's deferrals** remain unexercised/undone by design.

## Verdict

**PASSED.** All four goal clauses hold against the live system and all eight
decisions carry evidence. The gaps are disclosures and deferrals, not incomplete
work — with the exception of gap 3, which is a real regression-guard hole worth
closing when `/loom` next changes.
