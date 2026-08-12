---
phase: 112-telemetry-coverage-closure
plan: 02
subsystem: database
tags: [convex, schema, retention, telemetry]

# Dependency graph
requires:
  - phase: 112-telemetry-coverage-closure (plan 01)
    provides: astridr-repo contract corrections (does not touch CodePulse source; wave-1 concurrency, no code dependency)
provides:
  - "governorDecisions domain table in convex/schema.ts (emitter/priority/spoke/heldReason/timestamp, by_timestamp index)"
  - "messageRoutes domain table in convex/schema.ts (channel/profile/sender/sessionId/timestamp, by_timestamp + by_profile indexes)"
  - "both tables bounded in RETENTION_DAYS (governorDecisions: 30, messageRoutes: 90) with dated D-06 reasons"
  - "mutation-proven specific-value drift assertions in retention.test.ts for both new tables"
affects: [112-03, 112-04, 112-05, 112-06, 112-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pre-emptive RETENTION_DAYS bounding in the same commit that declares a domain table (D-06)", "optional sender/sessionId fields to avoid the Phase 108 TELE-02 null-rejection defect ahead of time"]

key-files:
  created: []
  modified:
    - "convex/schema.ts"
    - "convex/retention.ts"
    - "convex/retention.test.ts"

key-decisions:
  - "governorDecisions and messageRoutes fields/indexes/windows implemented exactly per the plan's <decided_shapes> (Claude's Discretion was already resolved at plan time) — no re-litigation."
  - "No ingest, no queries, no UI added — that is explicitly out of scope for 112-02 per the plan's Output section (plans 03/04/05)."

requirements-completed: [TELE-03]

# Metrics
duration: ~15min
completed: 2026-08-12
---

# Phase 112 Plan 02: Domain Tables + Retention Bounds (governorDecisions, messageRoutes) Summary

**Added the `governorDecisions` (D-04) and `messageRoutes` (D-13) domain tables to `convex/schema.ts` and bounded both in `RETENTION_DAYS` in the same change (D-06), with a mutation-proven specific-value drift test for each — no ingest, no queries, no UI.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 3 (`convex/schema.ts`, `convex/retention.ts`, `convex/retention.test.ts`)

## Accomplishments

- `governorDecisions` and `messageRoutes` declared in `convex/schema.ts`, both at two-space indentation, matching `retention.test.ts`'s `schemaTables` regex requirement — verified directly, not assumed.
- Both bounded in `RETENTION_DAYS` (`governorDecisions: 30`, `messageRoutes: 90`) with dated, reasoned in-line comments recording the phase/decision, measured volume, read-pattern tier, and pre-emptive-bounding rationale — before either table can grow.
- `retention.test.ts` extended with a specific-value `toHaveProperty` assertion for both new keys (not a generic loop), plus a `schemaTables` presence assertion proving the indentation requirement actually held.
- The new test was mutation-proven: `governorDecisions: 30` was deleted from `retention.ts`, the suite was run and observed RED (exactly the new assertion failed, 14/15 passed), the file was restored byte-identical from a backup, and the suite was re-run and observed GREEN (15/15).

## Task Commits

Each task was committed atomically, named paths only:

1. **Task 1: Add the governorDecisions and messageRoutes tables to convex/schema.ts** — `65a4870e` (feat)
2. **Task 2: Bound both tables in RETENTION_DAYS with dated in-line reasons (D-06)** — `bb3b4099` (feat)
3. **Task 3: Extend retention.test.ts with specific-value drift assertions, and observe them fail** — `4314916a` (test)

**Plan metadata:** recorded below (this SUMMARY.md + STATE.md + ROADMAP.md), committed separately per the sequential-executor instructions.

Each commit's `git show --stat HEAD` was read immediately after committing and confirmed to touch exactly the one intended file — no foreign files were swept in from the concurrent Phase 115 session.

## Files Created/Modified

- `convex/schema.ts` — added `governorDecisions` (emitter/priority/spoke/heldReason/timestamp, `by_timestamp` index) and `messageRoutes` (channel/profile/sender/sessionId/timestamp, `by_timestamp` + `by_profile` indexes) domain tables, inserted between `controlVerbSwaps` and the `GALDR PROMPT LIBRARY` banner. No existing table, index, or comment was modified — `git diff --numstat` showed 57 insertions, 0 deletions.
- `convex/retention.ts` — added `governorDecisions: 30` and `messageRoutes: 90` to `RETENTION_DAYS`, each with a dated D-06 in-line comment (measured volume, read-pattern tier, pre-emptive-bounding rationale), placed after `controlVerbSwaps: 30` and before the `aggregates` block. `git diff --numstat` showed 21 insertions, 0 deletions.
- `convex/retention.test.ts` — added two new `it(...)` blocks inside the `RETENTION_DAYS` describe: a specific-value drift assertion (`toHaveProperty("governorDecisions", 30)` / `toHaveProperty("messageRoutes", 90)`) and a `schemaTables` presence assertion for both names. `git diff --numstat` showed 17 insertions, 0 deletions.

## Task 3 Evidence — Mutation Proof (RED then GREEN, verbatim)

**Setup:** backed up `convex/retention.ts` to a scratchpad temp file before mutating, per the plan's "temporarily mutated then restored" instruction and this project's destructive-git-operation discipline (no `git checkout --` used for the restore, since the file had committed, in-flight content at that point in Task 3 that a checkout would have needed to match exactly anyway — a plain file-copy restore was used and then verified against `git diff --stat` returning empty).

**Mutation:** deleted the `governorDecisions: 30` line and its preceding 9-line D-06 comment block from `convex/retention.ts`.

**RED run** — `npx vitest run convex/retention.test.ts` against the mutated file:

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 ❯ convex/retention.test.ts (15 tests | 1 failed) 9ms
     × bounds governorDecisions (D-06) at 30 days and messageRoutes (D-06) at 90 days — Phase 112 tables must not silently become unbounded 3ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  convex/retention.test.ts > RETENTION_DAYS > bounds governorDecisions (D-06) at 30 days and messageRoutes (D-06) at 90 days — Phase 112 tables must not silently become unbounded
AssertionError: expected { runtime_events: 14, …(19) } to have property "governorDecisions" with value 30

- Expected:
30

+ Received:
undefined

 ❯ convex/retention.test.ts:78:28
     76|   // exactly that deletion, by name, at the specific values D-06 fixed.
     77|   it("bounds governorDecisions (D-06) at 30 days and messageRoutes (D-…
     78|     expect(RETENTION_DAYS).toHaveProperty("governorDecisions", 30);
       |                            ^
     79|     expect(RETENTION_DAYS).toHaveProperty("messageRoutes", 90);
     80|   });

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)
```

Exactly the new assertion failed (the `governorDecisions` half of it, first assertion in the block, `expect` throws before reaching the `messageRoutes` line) — no other test regressed, confirming the failure is specific and not a harness-wide break.

**Restore:** copied the backed-up file back over `convex/retention.ts`; `git diff --stat convex/retention.ts` returned empty output (exit 0, no lines), confirming the restored file is byte-identical to the Task 2 commit (`bb3b4099`).

**GREEN run** — `npx vitest run convex/retention.test.ts` after restore:

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  10:17:42
   Duration  845ms (transform 51ms, setup 79ms, import 52ms, tests 6ms, environment 596ms)
```

15/15 passed (13 pre-existing + 2 new). A green that was never observed going red is not a guard — this one was.

## Verification (plan's `<verification>` block, all 4 checks)

1. `npx tsc --noEmit` — exit 0 (run after Task 1 and again after Task 3; both clean).
2. `npx vitest run convex/retention.test.ts` — 15/15 passed (final state, after mutation-proof restore).
3. `grep -nE "^  (governorDecisions|messageRoutes): defineTable\(" convex/schema.ts` — returned exactly two lines:
   ```
   2190:  governorDecisions: defineTable({
   2220:  messageRoutes: defineTable({
   ```
4. The mutation proof above is quoted verbatim (RED and GREEN).

**Additional sanity check (not required by the plan, run as insurance):** `npx vitest run convex/` — full convex test directory, 77 files passed | 2 skipped, 1452 tests passed | 98 todo, 0 failed. No regression introduced by the schema/retention changes.

## Decisions Made

- Implemented `governorDecisions` and `messageRoutes` fields, indexes, and retention windows exactly per the plan's `<decided_shapes>` section (naming/columns/indexes/windows were already resolved as Claude's Discretion at plan time — this execution did not re-choose them).
- No ingest routing, no query functions, no UI component were added — explicitly out of scope per the plan's Output section, deferred to plans 03/04/05.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria were met without any Rule 1-4 auto-fix or architectural escalation.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. No `npx convex deploy` was run (operator-gated, reserved for plan 112-07 per the plan's explicit prohibition and this execution's standing verification-discipline instructions). The schema change is committed but NOT deployed — this is the correct end state for this plan.

## Next Phase Readiness

- Both domain tables exist in `convex/schema.ts` and are retention-bounded, ready for plan 112-03 (domain modules: `governorDecisions.ts`, `messageRoutes.ts` — write mutation + bounded read, per `112-PATTERNS.md` seam 2) to build against.
- Plan 112-04 (ingest routing dispatch case + resolver, including the mandatory `isOptionalString`/`normalizeOptional` null-carve-out for `held_reason` per D-14) is unblocked by this plan.
- Plan 112-05 (UI surface, `GovernorDecisionLog` component) and 112-06 (disposition const + drift guard) are unaffected by and do not depend on this plan beyond the schema/retention foundation now in place.
- No deploy was run; `npx convex deploy` remains reserved for plan 112-07 (`autonomous: false`, operator-gated, live proof).

---
*Phase: 112-telemetry-coverage-closure*
*Completed: 2026-08-12*

## Self-Check: PASSED

- `convex/schema.ts` — FOUND, contains `governorDecisions: defineTable(` and `messageRoutes: defineTable(` at two-space indentation (verified via grep, line 2190 and 2220).
- `convex/retention.ts` — FOUND, contains `governorDecisions: 30` and `messageRoutes: 90` with `2026-08-12` (2 occurrences) and `D-06` (6 occurrences).
- `convex/retention.test.ts` — FOUND, 15/15 tests passing including the two new assertions.
- Commit `65a4870e` — FOUND in `git log --oneline -5`.
- Commit `bb3b4099` — FOUND in `git log --oneline -5`.
- Commit `4314916a` — FOUND in `git log --oneline -5`.
- `.planning/phases/112-telemetry-coverage-closure/112-02-SUMMARY.md` — FOUND (this file).
