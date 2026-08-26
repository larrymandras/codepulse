---
phase: 121-analytics-query-resilience
plan: 07
subsystem: infra
tags: [convex, self-hosted, deploy, backfill, aggregates, analytics]

# Dependency graph
requires:
  - phase: 121-analytics-query-resilience
    plan: 01
    provides: "de-latched, resumable backfillTokenSplit cursor and the calls rollup metric type"
  - phase: 121-analytics-query-resilience
    plan: 02
    provides: "aggregates-backed providerBreakdown/costByModel query shapes and the two deleted unbounded endpoints"
  - phase: 121-analytics-query-resilience
    plan: 04
    provides: "the eight self-fetching, SectionErrorBoundary-wrapped /analytics components this plan smoke-tests"
  - phase: 121-analytics-query-resilience
    plan: 05
    provides: "prior wave's deploy-adjacent work"
  - phase: 121-analytics-query-resilience
    plan: 06
    provides: "the D-11 as-of freshness label this plan verifies renders correctly against live data"
provides:
  - "This phase's convex/ code deployed and running on the self-hosted backend (proven by positive read + negative control, not the CLI's own success message)"
  - "30 days (720 hours) of calls rollup buckets materialized via a 120-link resumed backfill chain -- the Provider Comparison panel is populated for the first time"
  - "ROLLUP_READ_CAP measured live (11%/22% of the 8000 cap) rather than assumed -- confirmed correctly sized, no change made"
  - "Live proof that SectionErrorBoundary isolation works against real, un-injected server-side query timeouts, not just jsdom fault injection"
affects: [122-token-fidelity, any-future-analytics-query]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backfill chains driven from a shell loop with BOTH an explicit stop condition (done: true) and an explicit iteration guard (200), never an open-ended loop"
    - "Every before/after control for a live-instance change anchors on an explicit recorded SHA, never HEAD~1, because a shared checkout can commit on top of you mid-plan"
    - "A CLI-only probe (metrics:dashboardSummary via npx convex run, no browser) is what proved a smoke-check failure was server-side, not frontend -- isolate the browser from the backend before diagnosing either"

key-files:
  created: []
  modified:
    - .planning/phases/121-analytics-query-resilience/121-DEPLOY-EVIDENCE.md

key-decisions:
  - "The operator ran `npx convex deploy` at the keyboard, not any agent -- the Claude Code auto-mode classifier blocks agent-driven `convex deploy` outright. `npx convex run` (read or write) does pass the classifier and was used for every backfill link and measurement in this plan."
  - "Task 4's live smoke check was performed by the orchestrator via Chrome browser automation, not by this executor (no browser tool available) and not by the human operator directly -- attributed exactly that way in the evidence file rather than left ambiguous or misattributed to whichever agent happened to relay it."
  - "ROLLUP_READ_CAP (8000, convex/llm.ts) confirmed correctly sized from live measurement (rowsRead 889/1773, both under 22% of cap) -- left unchanged. This was 121-RESEARCH.md Q5's flagged-but-never-taken measurement; it is now taken and closes that open question."
  - "A first smoke-check attempt showing all-zero tiles was NOT recorded as a Phase 121 defect: a CLI-only probe (no browser) reproduced the identical timeout independent of any frontend code, isolating the cause to backend memory pressure (19.19 GiB / 120.9% CPU) unrelated to this plan's changes. A health-gated restart reclaimed 15.6 GiB, but did NOT resolve two of the four affected queries -- recorded honestly as a disproven hypothesis (memory starvation) rather than papered over, with the real residual cause (per-query scan cost on unbounded queries) named as explicit out-of-scope follow-up."
  - "A 'Load more' false negative (25 rows unchanged after a fixed 2.5s wait) was corrected by re-measuring with staggered sampling (1/2/4/8s) rather than accepted at face value -- it grows in ~3-4s against the loaded backend, not never. Recorded as a timing artifact of the first check, not a regression."

requirements-completed: [DEBT-08]

# Metrics
duration: ~40min (this continuation's portion; Task 1 and Task 2's blocked first attempt were run by prior executors in this same plan)
completed: 2026-08-18
---

# Phase 121 Plan 07: Deploy, Backfill, and Live-Measure Summary

**Deployed this phase's `convex/` changes to the self-hosted backend (operator-run, classifier-blocked for agents), ran a 120-link resumed backfill chain that materialized the full 30-day `calls` rollup and populated the previously-empty Provider Comparison panel, measured `ROLLUP_READ_CAP` against live data (11%/22% utilization, confirmed correctly sized), and proved `/analytics`'s `SectionErrorBoundary` isolation against three real, un-injected backend query timeouts with zero collateral damage.**

## Performance

- **Duration:** ~40 min (this continuation agent's portion: Task 2 completion through Task 4 and this summary)
- **Tasks:** 4 (Task 1 completed pre-dispatch by the orchestrator's pre-dispatch sweep; Task 2's first attempt blocked by a prior executor; Task 2 completion, Task 3, and Task 4 run in this session)
- **Files modified:** 1 (`121-DEPLOY-EVIDENCE.md`, appended across 4 commits by 2 prior executors + this one + the orchestrator's relay)

## Accomplishments

- **Task 1 (pre-dispatch):** Operator approved the deletion of `llm:costByProvider` and `llm:latencyOverTime` after a repo-wide + cross-repo consumer sweep found zero live callers, with a known-present control proving the sweep methodology discriminates.
- **Task 2:** Confirmed via CLI attempt that `npx convex deploy` is blocked by the Claude Code auto-mode classifier for any agent — the operator ran it directly. Confirmed `Deleted table indexes:` is absent from the deploy output (no schema rollback). Confirmed via a control-paired probe (`llm:notARealFn9x7q2` returning the identical error text) that `costByProvider`/`latencyOverTime` are genuinely deleted, not merely unreachable.
- **Task 3:** Drove `aggregates:backfillTokenSplit` through 120 links (720 hours = the exact 30-day retention window) with an explicit stop condition and 200-iteration guard; the chain terminated on its own `done: true`, inserting 895 rows with zero truncated hours. `providerBreakdown` went from `rows: [], presentBuckets: 0` to 10 provider rows / `presentBuckets: 499` — the Provider Comparison panel's data gap is closed. `ROLLUP_READ_CAP` (8000) measured at 889/1773 rows read (11%/22%), well under the 50% raise threshold — left unchanged. Cross-checked the migrated `calls` rollup against the independent `subscriptionUsage` query: 1462 vs 1463, matching the small expected freshness-lag gap.
- **Task 4:** The orchestrator performed the live browser smoke check (this executor has no browser tool). `/analytics` mounts and every section renders. Three panels (Activity Heatmap, Token Flow, Prompt Activity) were caught by their `SectionErrorBoundary` during a REAL backend degradation — proof this phase's isolation mechanism works against genuine failures, not just jsdom fault injection. The freshness label, Summary Row, and Model Breakdown table all render real data sourced from Task 3's backfill.

## Task Commits

1. **Task 1: Confirm no external consumer** — `2cf385b2` (docs, pre-dispatch)
2. **Task 2: Deploy attempt, blocked by classifier** — `7e0826cf` (docs, prior executor)
3. **Task 2: Deploy completed by operator + post-deploy probes recorded** — `3d93be21` (docs)
4. **Task 3: Backfill chain + read-cap measurement** — `8a873c9a` (docs)
5. **Task 4: Live smoke check, approved** — `e8595a0d` (docs)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `.planning/phases/121-analytics-query-resilience/121-DEPLOY-EVIDENCE.md` — the deliverable: verbatim command output for every step of the deploy, backfill, measurement, and smoke check, each attributed to whoever actually ran it (operator / orchestrator / this executor / a prior executor).

## Decisions Made

See `key-decisions` in frontmatter. In addition: this executor deliberately did NOT attempt to substitute Playwright e2e coverage for Task 4's manual browser check, even though `analytics-cache-tile.spec.ts` exists as a narrower precedent — `121-VALIDATION.md` explicitly routes this check to manual verification because no e2e spec covers the full `/analytics` page, and inventing new coverage mid-plan would have been scope beyond what was asked.

## Deviations from Plan

### Auto-fixed Issues

None — no code changes were made by this plan. Every action was a deploy, a read/write against the live backend via `npx convex run`, or evidence recording.

### Notable non-deviations worth recording (per the plan's own "acceptance criteria that cannot discriminate" instruction)

- The plan's Task 4 acceptance criteria assume a clean-first-attempt smoke check. The real run required diagnosing and disproving a backend memory-pressure hypothesis mid-checkpoint. This is not a plan defect — the plan's `<how-to-verify>` steps were followed faithfully once the unrelated backend issue was resolved — but it is recorded because a criterion that only allows for success-on-first-try would have hidden a legitimate, disproven working hypothesis.

---

**Total deviations:** 0 auto-fixed. One environmental complication (unrelated backend memory pressure) diagnosed, disproven as memory-related for 2 of 4 affected queries, and handled transparently rather than silently re-run.
**Impact on plan:** None on scope. The environmental complication is recorded as out-of-scope follow-up, not folded into this phase's deliverable.

## Issues Encountered

- `npx convex deploy` is blocked by the Claude Code auto-mode permission classifier for agent-driven attempts (confirmed twice, by two different executors). No workaround was attempted, per the plan's explicit prohibition on `--push` or alternate routes — the operator ran it directly instead.
- A first Task 4 smoke-check attempt showed all-zero tiles due to backend memory pressure unrelated to this phase; diagnosed via a CLI-only probe (no browser), resolved via a health-gated restart, and the residual (still-timing-out) queries named as explicit out-of-scope follow-up rather than papered over.
- A first "Load more" measurement was a false negative from a too-short fixed wait; corrected via staggered re-sampling.

## User Setup Required

None — no external service configuration required. Note for the operator: 4 unbounded Convex queries (`analytics:activityHeatmap`, `analytics:toolFlowSankey`, `analytics:tokenSunburst`, `metrics:dashboardSummary`) now time out server-side at current data volume and are candidates for a future phase using this phase's bounded-read pattern (`.take(cap)` + `truncated` reporting).

## Next Phase Readiness

- Phase 121 (DEBT-08) is fully deployed and live-verified: the two unbounded endpoints are deleted, the `calls` rollup is backfilled for the full 30-day window, the read cap is measured and confirmed correctly sized, and `/analytics` isolation is proven against real failures.
- Follow-up candidate for a future phase: the 4 out-of-scope unbounded queries named above are the same debt class this phase fixed for `costByModel`/`providerBreakdown`/`evalScores`/`cacheStats`, now confirmed to time out in production.
- STATE.md / ROADMAP.md / REQUIREMENTS.md are NOT updated by this executor — per dispatch, the orchestrator owns those shared artifacts.

---
*Phase: 121-analytics-query-resilience*
*Completed: 2026-08-18*
