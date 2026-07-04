---
phase: 88-analytics-rollup
plan: 02
subsystem: backend
tags: [convex, rollup, aggregates, idempotency, occ, pagination, sankey, ingest]

# Dependency graph
requires:
  - phase: 88-01
    provides: "convex/lib/sankeyClassify.ts (categoryOf/outcomeOf) + RED write-path test scaffolds in analyticsRollup.test.ts"
  - phase: 88-RESEARCH
    provides: "Pitfall 1 (double-count window), Pattern 1 (OCC dedup), Pattern 3 (backfill action), Pattern 4 (paginated cost cron), D-02/D-03/D-04/D-05"
provides:
  - "events.idempotencyKey + by_idempotencyKey index (producer dedup)"
  - "convex/analyticsRollup.ts — incrementEventBucket, incrementSankeyBuckets, incrementBatch (internalMutation), backfillHistorical (action)"
  - "events.ingest extended: idempotencyKey dedup + ingest-time event/sankey bucket increments in one OCC mutation"
  - "computeHourly with event-count/error-count branches removed + paginated llmMetrics cost reads"
  - "idempotencyKey wired through both httpActions (ingest.ts, runtimeIngest.ts)"
affects: [88-03 (run backfillHistorical), 88-04 (analytics read-path rewrite reads these buckets), analytics-rollup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ingest-time rollup: aggregates buckets maintained inside the events.ingest OCC mutation (read-patch-or-insert, JS-side dimension match)"
    - "OCC idempotency dedup on by_idempotencyKey with early return; un-keyed events always counted (D-05)"
    - "Cursor-paginated cron reads (numItems 500) to stay under the 16 MiB/exec read limit"
    - "Explicit PaginationResult<Doc> annotation to break the ingest↔rollup type-inference cycle"

key-files:
  created: []
  modified:
    - convex/schema.ts
    - convex/analyticsRollup.ts
    - convex/events.ts
    - convex/aggregates.ts
    - convex/ingest.ts
    - convex/runtimeIngest.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "incrementBatch is internalMutation (T-88-03): a public increment endpoint would be unauthenticated tampering. Grep gate asserts incrementBatch=internalMutation (1) and =mutation (0)."
  - "Annotated backfillHistorical's runQuery result as PaginationResult<Doc<'events'>> to break a tsc TS7022 inference cycle (events.ingest imports the rollup helpers; listRecentPaginated lives in the same events module)."
  - "Ran `npx convex codegen` (offline binding generation + tsc) to regenerate _generated/api.d.ts so internal.analyticsRollup.incrementBatch type-resolves. This is codegen, NOT a deploy."

requirements-completed: []  # AR-01/AR-02 are phase-level; satisfied in full only at Plan 04. Plan 02 lands the write path.

# Metrics
duration: 7min
completed: 2026-06-24
---

# Phase 88 Plan 02: Analytics Rollup Write Path Summary

**Landed the entire rollup WRITE PATH atomically — idempotency-keyed dedup, ingest-time event/sankey bucket increments, cron event/error-count branch removal, paginated cron cost reads, the backfill action, and httpAction key pass-through — all in one Wave-1 plan so they deploy together with no double-count window (Pitfall 1).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-24T12:55:24Z
- **Completed:** 2026-06-24T13:02:21Z
- **Tasks:** 3
- **Files modified:** 7 (0 created — analyticsRollup.ts was created in Plan 01's scaffold space but is first implemented here; counted as modified against the repo + regenerated api.d.ts)

## Accomplishments
- `events.ingest` now dedups on `by_idempotencyKey` (early return) and, on a fresh insert, increments the `"events"` and two `"sankey_edge"` buckets — all inside ONE OCC mutation (D-01/D-04). Un-keyed events are always counted, never lossy-dropped (D-05).
- `convex/analyticsRollup.ts` implements `incrementEventBucket`, `incrementSankeyBuckets` (+ private `incrementSankeyEdge`) using the read-patch-or-insert idiom with **JS-side** dimension matching (Pitfall 3 — no object-equality filter on `dimensions`).
- `incrementBatch` is an **`internalMutation`** (T-88-03 — never a public increment endpoint); `backfillHistorical` is an `action` that cursor-loops `api.events.listRecentPaginated` (numItems 200) → `internal.analyticsRollup.incrementBatch` per page → `{ processed }`.
- `computeHourly` had its event-count and error-count aggregation branches **deleted** (D-02) — those are now ingest-time maintained, so the cron can no longer double-count (Pitfall 1, the phase's highest-risk correctness bug). Co-located in the same wave/deploy so no transition tick runs with both paths active (T-88-04).
- `computeHourly` cost read replaced the unbounded `llmMetrics.collect()` with a cursor-paginated loop (`LLM_PAGE_SIZE = 500`) so a high-volume hour can't trip the 16 MiB/exec read limit and silently fail the cron (D-03, T-88-05).
- `idempotencyKey = body/d.idempotencyKey ?? event_id` wired through both `ingest.ts` (buildIngest) and `runtimeIngest.ts` (gateway.routing_decision); neither httpAction writes `ctx.db` rollups (they aren't transactional).
- `npx tsc --noEmit` exits 0. Plan 02 target tests (analyticsRollup.test.ts 6/6 + aggregates.test.ts 24/24) all GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: idempotencyKey schema field + index; analyticsRollup increment helpers** — `034f576` (feat)
2. **Task 2: events.ingest dedup+increment; incrementBatch (internal) + backfillHistorical** — `b5a3350` (feat)
3. **Task 3: remove cron event/error branches; paginate cost reads; wire idempotencyKey through httpActions** — `4e8c2be` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `convex/schema.ts` (modified) — `events.idempotencyKey: v.optional(v.string())` + `.index("by_idempotencyKey", ["idempotencyKey"])`.
- `convex/analyticsRollup.ts` (implemented) — `incrementEventBucket`, `incrementSankeyBuckets`, private `incrementSankeyEdge`, `incrementBatch` (internalMutation), `backfillHistorical` (action).
- `convex/events.ts` (modified) — `ingest` extended: `idempotencyKey` arg + `by_idempotencyKey` early-return dedup + post-insert `incrementEventBucket`/`incrementSankeyBuckets`.
- `convex/aggregates.ts` (modified) — `computeHourly`: event-count + error-count branches removed (D-02); cost read paginated (D-03). `rollupDaily` + read queries unchanged.
- `convex/ingest.ts` (modified) — buildIngest passes `idempotencyKey` to `api.events.ingest`; no new `ctx.db` write.
- `convex/runtimeIngest.ts` (modified) — gateway.routing_decision case passes `idempotencyKey`.
- `convex/_generated/api.d.ts` (regenerated) — now includes the `analyticsRollup` module so `internal.analyticsRollup.incrementBatch` type-resolves.

## Decisions Made
- **`incrementBatch` declared `internalMutation`, not `mutation`** (T-88-03). A public increment endpoint would let any unauthenticated caller inflate the rollups. Asserted via grep gate: `incrementBatch = internalMutation` → 1, `incrementBatch = mutation\b` → 0.
- **Cost read paginated with a named `LLM_PAGE_SIZE = 500` const** (tunable per the plan) rather than a magic number, accumulating `page.page` until `page.isDone`.
- **Cron branches deleted, not feature-flagged.** D-02 + Convex per-deploy atomicity mean the only safe option is to remove the cron event/error aggregation in the same deploy that adds ingest-time increments. A flag would leave a double-count code path live.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Broke a tsc type-inference cycle in backfillHistorical**
- **Found during:** Task 2
- **Issue:** `events.ingest` now imports the rollup helpers from `analyticsRollup.ts`, and `backfillHistorical` (in the same `analyticsRollup.ts`) calls `ctx.runQuery(api.events.listRecentPaginated)`. The cross-module reference made TypeScript unable to infer `result`'s type (TS7022: "implicitly has type 'any' … referenced … in its own initializer"), which would have failed the plan's `tsc --noEmit exits 0` acceptance criterion.
- **Fix:** Imported `Doc` from `_generated/dataModel` and `PaginationResult` from `convex/server`, and annotated `const result: PaginationResult<Doc<"events">>`. This breaks the cycle and restores `e.eventType`/`e.toolName`/`e.timestamp` typing on the page rows.
- **Files modified:** convex/analyticsRollup.ts
- **Verification:** `npx tsc --noEmit` exits 0; backfill maps page rows with full typing.
- **Committed in:** b5a3350 (Task 2 commit)

**2. [Rule 3 - Blocking] Regenerated Convex bindings so the new module's internal reference resolves**
- **Found during:** Task 2
- **Issue:** `internal.analyticsRollup.incrementBatch` and `api.events.listRecentPaginated` typed against a stale `_generated/api.d.ts` that predated the new `analyticsRollup` module → `TS2339: Property 'analyticsRollup' does not exist`.
- **Fix:** Ran `npx convex codegen` (offline binding generation — bundles + generates `_generated/*` + runs `tsc`; it surfaced exactly the cycle in deviation #1, which I then fixed). Committed the regenerated `_generated/api.d.ts` with Task 2. This is **codegen, not a deploy** — no `npx convex deploy` / `npx convex run` was executed (those remain operator-gated Wave-2 steps).
- **Files modified:** convex/_generated/api.d.ts
- **Verification:** `grep analyticsRollup convex/_generated/api.d.ts` → 2; `npx tsc --noEmit` exits 0.
- **Committed in:** b5a3350 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both blocking). No architectural changes, no scope creep — both were mechanical TypeScript/codegen consequences of introducing a new cross-referenced Convex module.

## Known Stubs
None. All helpers are fully wired (events.ingest → increment helpers; backfill → incrementBatch). `backfillHistorical` exists but is intentionally NOT run here — running it is Plan 03 (operator-gated). That is by design per the plan, not a stub.

## Issues Encountered
- The full `convex/` suite shows **2 remaining RED tests** in `convex/analytics.test.ts` (`rewritten heatmap query reads aggregates buckets (Plan 04)` and `rewritten errorRateTrend query reads aggregates buckets (Plan 04)`). These are **explicitly Plan-04 read-path-rewrite targets** (documented as RED-pending Plan 04 in 88-01-SUMMARY) — they assert `analytics.activityHeatmapFromAggregates` / `errorRateTrendFromAggregates` which Plan 02 does not create. They are NOT regressions from this plan. Plan 01 left 6 deliberate RED; Plan 02 flipped the 4 write-path REDs GREEN, leaving these 2.

## Requirements Status
AR-01 and AR-02 are **phase-level** and span Plans 02–04. Plan 02 lands the write path (ingest-time buckets + dedup + backfill code + cron read-safety), but the requirements complete only when Plan 03 runs the backfill and Plan 04 rewrites the read path. Left **not** marked complete (matching Plan 01's treatment).

## User Setup Required
None for this plan. No deploy here. The Convex deploy (which applies the schema index + the atomic write-path swap) and the `backfillHistorical` run are operator-gated Wave-2 / Plan-03 steps driven by the orchestrator/operator.

## Next Phase Readiness
- **Plan 03** can deploy this wave (`npx convex deploy`) and then invoke `npx convex run analyticsRollup:backfillHistorical` to populate historical `"events"`/`"sankey_edge"` buckets from existing events. The index backfill completes on deploy before the action is callable (Convex guarantees ordering — Pitfall 6).
- **Plan 04** can rewrite `analytics.ts` queries to read the `"events"`/`"sankey_edge"` buckets these increments now produce, turning the 2 remaining `analytics.test.ts` Plan-04 RED tests GREEN.

## Self-Check: PASSED

- FOUND: convex/analyticsRollup.ts (incrementEventBucket, incrementSankeyBuckets, incrementBatch=internalMutation, backfillHistorical=action)
- FOUND: convex/schema.ts contains idempotencyKey + by_idempotencyKey
- FOUND: convex/events.ts ingest uses by_idempotencyKey + incrementEventBucket
- FOUND: convex/aggregates.ts has 0 `metric_type: "events"/"errors"` inserts in computeHourly + `.paginate(` cost read
- FOUND: convex/ingest.ts + convex/runtimeIngest.ts pass idempotencyKey
- FOUND commit: 034f576 (Task 1)
- FOUND commit: b5a3350 (Task 2)
- FOUND commit: 4e8c2be (Task 3)
- tsc --noEmit exits 0; analyticsRollup.test.ts 6/6 + aggregates.test.ts 24/24 GREEN

---
*Phase: 88-analytics-rollup-table-durable-fix-for-convex-16-mib-read-li*
*Completed: 2026-06-24*
