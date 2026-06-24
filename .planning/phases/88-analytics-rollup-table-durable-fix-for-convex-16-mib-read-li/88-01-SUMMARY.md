---
phase: 88-analytics-rollup
plan: 01
subsystem: testing
tags: [convex, vitest, sankey, classifier, rollup, tdd, analytics]

# Dependency graph
requires:
  - phase: 88-RESEARCH
    provides: Validation Architecture (Nyquist invariants), OQ-2 (outcomeOf payload unused)
  - phase: 88-PATTERNS
    provides: extract-verbatim + mock-ctx.db + pure-logic vitest analogs
provides:
  - "convex/lib/sankeyClassify.ts — single shared source of categoryOf/outcomeOf (read + write paths)"
  - "convex/analyticsRollup.test.ts — write-path Nyquist gate (idempotency, no-key-counted, patch-or-insert, backfill count-equality)"
  - "convex/analytics.test.ts — read-path Nyquist gate (heatmap day/hour derivation, errorRateTrend missing-hour=0)"
  - "convex/aggregates.test.ts — extended with Phase 88 cron-removal-non-double-count + dataRetention-leaves-aggregates invariants"
  - "@vite-ignore non-literal dynamic-import RED-scaffold pattern for not-yet-built Convex modules"
affects: [88-02 (rollup write path), 88-04 (analytics read-path rewrite), analytics-rollup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared classifier module imported by both read and write paths (drift-proof, T-88-01)"
    - "RED-scaffold via @vite-ignore non-literal dynamic import + loose module type so a missing Convex module REDs dependent tests instead of erroring the file or breaking tsc"

key-files:
  created:
    - convex/lib/sankeyClassify.ts
    - convex/analyticsRollup.test.ts
    - convex/analytics.test.ts
  modified:
    - convex/analytics.ts
    - convex/aggregates.test.ts

key-decisions:
  - "Classifier extracted VERBATIM (case-sensitive .includes) per T-88-01; corrected the plan's case-insensitive outcomeOf test expectations to match the real verbatim behavior"
  - "RED Wave-1/Plan-04 tests use @vite-ignore non-literal dynamic import so the file compiles, tsc stays 0, and only the implementation-dependent tests fail"

patterns-established:
  - "Drift-proof shared classifier: convex/lib/sankeyClassify.ts is the SOLE categoryOf/outcomeOf source"
  - "RED-scaffold dynamic-import guard for cross-plan TDD on Convex modules"

requirements-completed: []  # AR-01/02/03 are phase-level and NOT satisfied by Plan 01 scaffolding — they complete in Plans 02–04.

# Metrics
duration: 7min
completed: 2026-06-24
---

# Phase 88 Plan 01: Sankey Classifier Extraction + Nyquist Test Scaffolds Summary

**Extracted categoryOf/outcomeOf into the shared drift-proof `convex/lib/sankeyClassify.ts` and stood up the three Nyquist test files (classifier + pure-math assertions GREEN; rollup/idempotency/aggregates-query assertions RED-pending Plans 02/04).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-24T12:43:08Z
- **Completed:** 2026-06-24T12:50:17Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `convex/lib/sankeyClassify.ts` is now the single source of `categoryOf`/`outcomeOf`; `analytics.ts` imports it and the local copies are gone — read/write sankey classification can no longer drift (Pitfall 2 / T-88-01 closed).
- Three Nyquist test files exist and run: classifier + heatmap/missing-hour pure-math assertions are GREEN now; the idempotency / no-key-counted / patch-or-insert / backfill-count-equality and aggregates-backed query assertions are RED-pending Wave 1 (Plan 02) and Plan 04, establishing the RED→GREEN target.
- Extended `aggregates.test.ts` with the Phase 88 cron-removal-non-double-count (D-02) and dataRetention-leaves-aggregates (D-12) invariants — no regression on the existing 22 tests.
- `npx tsc --noEmit` exits 0; full `convex/` suite: 496 passed, 6 deliberate RED, 0 unexpected failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract categoryOf/outcomeOf into convex/lib/sankeyClassify.ts** — `6a49542` (feat)
2. **Task 2: Scaffold convex/analyticsRollup.test.ts (write-path invariants)** — `c11c195` (test)
3. **Task 3: Scaffold convex/analytics.test.ts + extend convex/aggregates.test.ts (read-path + retention invariants)** — `e077a84` (test)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `convex/lib/sankeyClassify.ts` (created) — shared `categoryOf(eventType)`/`outcomeOf(eventType)`, verbatim branch logic, `payload` param dropped (OQ-2).
- `convex/analytics.ts` (modified) — imports the shared classifier; removed the two local `const` declarations; `toolFlowSankey` now calls `outcomeOf(e.eventType)`.
- `convex/analyticsRollup.test.ts` (created) — classifier (GREEN) + idempotency/patch-or-insert/backfill (RED-pending Plan 02).
- `convex/analytics.test.ts` (created) — heatmap + errorRateTrend missing-hour pure-math (GREEN) + aggregates-backed query derivation (RED-pending Plan 04).
- `convex/aggregates.test.ts` (modified) — appended `describe("Phase 88 — cron removal non-double-count invariant")` (2 new tests, GREEN).

## Decisions Made
- **Verbatim classifier preserved over the plan's behavior examples.** T-88-01 mandates byte-identical extraction. The plan's `<behavior>` examples (`outcomeOf("ToolError") === "Error"`) assumed case-INSENSITIVE matching, but the real code uses case-sensitive `.includes("error")`/`.includes("fail")`, so `"ToolError"`/`"PostToolUseFailure"` classify as `"Success"`. I kept the classifier verbatim and corrected the TEST expectations (assert `tool_error`/`tool_fail` → `"Error"`, plus a documented assertion that the capitalized forms → `"Success"`). Ástríðr emits lowercase snake_case event types (cf. categoryOf's `tool_`/`llm_`/`file_`/`agent_` prefixes), so the lowercase forms are the real-world inputs.
- **RED-scaffold pattern.** Vite statically resolves literal `import()` specifiers at transform time and a `typeof import("...")` annotation breaks `tsc` when the module is absent. Used a non-literal `@vite-ignore` dynamic import plus a loose local module type so the scaffold compiles, keeps tsc at 0, and only the implementation-dependent tests RED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected `outcomeOf` test expectations to match the verbatim classifier**
- **Found during:** Task 2 (analyticsRollup.test.ts classifier block)
- **Issue:** The plan's `<behavior>` examples asserted `outcomeOf("ToolError") === "Error"` and `outcomeOf("PostToolUseFailure") === "Error"`. The verbatim source (which T-88-01 requires preserving) uses case-sensitive `.includes("error")`/`.includes("fail")`, so those capitalized inputs actually return `"Success"`. Asserting the plan's values would have either failed the classifier gate or forced a forbidden change to the classifier logic.
- **Fix:** Kept `sankeyClassify.ts` byte-identical; rewrote the test to assert the real behavior — `tool_error`/`tool_fail` → `"Error"`, `hitl_review` → `"HITL"`, `Info` → `"Success"`, plus explicit documentation assertions that `"ToolError"`/`"PostToolUseFailure"` → `"Success"` under the case-sensitive classifier.
- **Files modified:** convex/analyticsRollup.test.ts
- **Verification:** `npx vitest run convex/analyticsRollup.test.ts -t "classifier"` → both classifier tests GREEN; `npx tsc --noEmit` exits 0.
- **Committed in:** c11c195 (Task 2 commit)

**2. [Rule 3 - Blocking] RED-scaffold that compiles: non-literal `@vite-ignore` dynamic import + loose module type**
- **Found during:** Task 2 (and reused in Task 3)
- **Issue:** A literal `await import("./analyticsRollup")` made Vite fail transform-time ("Failed to resolve import") and nuked the whole file (0 tests run); a `typeof import("./analyticsRollup")` annotation made `tsc --noEmit` exit 2. Both violate the plan's "file loads without compile/parse error" + "tsc exits 0" acceptance criteria for a not-yet-built module.
- **Fix:** Loaded the Wave-1/Plan-04 module behind a non-literal specifier (`"./mod" + ""`) with `/* @vite-ignore */`, caught at runtime to set the handle to `null`, and typed the handle with a local loose type instead of `typeof import(...)`. Dependent tests assert against the handle → they RED cleanly; the file compiles and tsc stays 0.
- **Files modified:** convex/analyticsRollup.test.ts, convex/analytics.test.ts
- **Verification:** `npx tsc --noEmit` exits 0; both test files load and collect tests; only implementation-dependent tests fail.
- **Committed in:** c11c195 (Task 2), e077a84 (Task 3)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary to honor the threat-model's verbatim-extraction constraint and the plan's own compile/tsc acceptance criteria. No scope creep — no production behavior changed; the classifier is byte-identical and all changes are test-side or the planned extraction.

## Issues Encountered
None beyond the two deviations above. The 6 RED tests in the full suite (4 in analyticsRollup.test.ts, 2 in analytics.test.ts) are the intended Plan-02/Plan-04 targets, not failures.

## Requirements Status
AR-01, AR-02, AR-03 are **phase-level** requirements spanning Plans 01–04. Plan 01 only scaffolds the test gates and extracts the classifier — it does NOT satisfy any of them (no rollup write path, no backfill, no `.take()` removal yet). They are intentionally left **not** marked complete; they complete at the end of the phase (Plan 04).

## User Setup Required
None - no external service configuration required. No deploy in this plan (Wave 0, pure code + tests).

## Next Phase Readiness
- Plan 02 (Wave 1) can implement `incrementEventBucket` / `incrementSankeyBuckets` + the `events.ingest` `idempotencyKey` dedup path against the now-existing RED tests in `analyticsRollup.test.ts` (RED→GREEN target ready).
- Plan 04 can rewrite the `analytics.ts` queries to read `aggregates`, turning the `analytics.test.ts` aggregates-backed-query tests GREEN; the shared classifier is already in place for the sankey read path.
- `convex/lib/sankeyClassify.ts` is the import target both downstream plans must use (no second copy).

## Self-Check: PASSED

- FOUND: convex/lib/sankeyClassify.ts
- FOUND: convex/analyticsRollup.test.ts
- FOUND: convex/analytics.test.ts
- FOUND (modified): convex/analytics.ts, convex/aggregates.test.ts
- FOUND commit: 6a49542 (Task 1)
- FOUND commit: c11c195 (Task 2)
- FOUND commit: e077a84 (Task 3)

---
*Phase: 88-analytics-rollup-table-durable-fix-for-convex-16-mib-read-li*
*Completed: 2026-06-24*
