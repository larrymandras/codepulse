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

Updated 2026-08-11 after a close-out pass.

1. ~~The seeded card has 3 steps; its source declares 2.~~ **CLOSED.**
   Re-authored from the scanner's proposal to `review → verify`, matching the
   workflow's own `meta`. The upsert returned the same `_id`, so it refreshed
   rather than duplicated, and both steps kept their `docMd`. A curated card
   claiming a step its source does not have is the drift Loom exists to prevent.
2. **`LOOM_API_KEY` is backend-only** — still open, and needs Larry. The
   user-level copy was not set (probed, with `GALDR_API_KEY` as the control
   proving the probe works), so emits must pass the key explicitly.
3. ~~No committed e2e spec for `/loom`.~~ **CLOSED.** `e2e/loom.spec.ts` guards
   the control pair, with the clean-run assertion FIRST so a page rendering
   every step as errored cannot pass. Mutation-proven: forcing `stepStateFrom`
   to return `"error"` fails the control while the state-vocabulary test
   correctly still passes. It fails rather than skips when its fixture is
   missing, so it cannot pass vacuously.
4. **D-05's cap depth and D-08's deferrals** remain unexercised/undone by design.
5. **NEW — the live-data e2e specs are flaky under full-suite parallel load.**
   Three consecutive `--workers=4` runs after bounding the timeouts gave 0, 2
   and 1 of the Seiðr specs failing. Timeouts reduced it and did not eliminate
   it, because the cause is contention over shared mutable state, not a bound:
   these specs read — and `galdr` writes — one live Convex instance and one dev
   server while 20 axe scans run concurrently. In isolation they are reliable
   (loom + bifrost + galdr + navigation → 15/15). The fix is a separate serial
   Playwright project for live-data specs; not made unilaterally because it is a
   repo-wide config change and a concurrent session is active in this checkout.
6. **NEW — `e2e/command-center-breakpoints.spec.ts` fails 3/3, and it is not
   Loom's.** `87dafe30 feat(111-02)` deleted `ActiveAgentsPanel` while the spec
   still lists `'ACTIVE AGENTS'` at line 37 among its required panel headers.
   Belongs to the in-flight Phase 111.

## Verdict

**PASSED.** All four goal clauses hold against the live system and all eight
decisions carry evidence. The gaps are disclosures and deferrals, not incomplete
work — with the exception of gap 3, which is a real regression-guard hole worth
closing when `/loom` next changes.
