---
phase: 125-signature-layers
plan: 02
subsystem: database
tags: [convex, runtime-events, bounded-read, vitest, dos-mitigation]

# Dependency graph
requires:
  - phase: 125-signature-layers (plan 01)
    provides: "no direct code dependency -- 125-01 built eventHue.ts/TOPIC_EVENT_MAP export/entry-chunk ratchet, none of which this query calls; sequencing only"
provides:
  - "listRecentRuntimeWindow -- fixed-60s-window, 500-row-capped, data-free runtime_events query in convex/events.ts, args: {} (no client-supplied window)"
  - "convex/eventsWindow.test.ts -- 7-case guard proving both bounds, projection, index usage, and refusal-to-widen independently, each mutation-proven"
affects: [125-09, 125-07, 126-page-body-and-convex-read-defect-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local per-test fake store recording withIndex's index name AND implementing both take(n) and collect() as real operations (not stubs) so mutation proofs demonstrate the actual behavioral defect rather than a TypeError that would mask it"
    - "exportArgs() read as the source of truth for a query's declared args shape, not a hand-typed literal or a source grep -- same idiom as governorDecisions.test.ts/controlVerbSwaps.test.ts"

key-files:
  created:
    - convex/eventsWindow.test.ts
  modified:
    - convex/events.ts

key-decisions:
  - "Seeded every fixture row with a data payload (mirroring the real runtime_events schema field) after the first mutation-proof attempt for case (c) silently passed -- with no extra field on any seeded row, spreading the whole row into the response leaked nothing to catch. Documented as a deviation below."
  - "Fixed withFrozenNow's async/finally ordering bug (finally ran before the wrapped async fn's promise settled, restoring the real clock mid-test) found while writing case (f)'s two-sequential-calls assertion -- documented as a deviation below."

patterns-established:
  - "Fake store implements .collect() alongside .take(n) so a .take->.collect mutation proof shows the real behavioral consequence (600 rows, untruncated) instead of an incomplete-stub TypeError."

requirements-completed: [SIGNAL-02]

# Metrics
duration: 25min
completed: 2026-08-24
---

# Phase 125 Plan 02: The Pulse ECG's One Bounded Read Summary

**`listRecentRuntimeWindow` in `convex/events.ts` -- a fixed-60s, 500-row-capped, `data`-free `runtime_events` read with no client-supplied window, backed by a 7-case guard (`convex/eventsWindow.test.ts`) that independently mutation-proves the time bound, the row cap, the projection, and the inability to widen from the client.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-24T08:55:00-04:00 (approx, first Read call)
- **Completed:** 2026-08-24T09:08:09-04:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- `listRecentRuntimeWindow` added to `convex/events.ts` immediately after `listRecentUnified`, exactly per the corrected `125-PATTERNS.md` shape and the plan's `<interfaces>` contract: `WINDOW_SEC = 60`, `MAX_ROWS = 500`, `args: {}`, range-bound `.withIndex("by_timestamp", ...)` + `.take(MAX_ROWS)`, projected to `{_id, eventType, timestamp}`, returns `{ rows, truncated }`.
- `convex/eventsWindow.test.ts` built a LOCAL fake store (not `events.test.ts`'s `makeEventsStore`, per the plan's own caveat that that harness is a role-match only) that records the literal index name passed to `withIndex` and implements `order`/`filter`/`take`/`collect` as real operations against seeded rows.
- All 7 required assertions present and green: (a) time bound with each excluded row (future, hour-old, just-past-60s, archived) asserted absent individually, (b) index name asserted as the literal `"by_timestamp"`, (c) projection asserted via exact `Object.keys`, (d) 600-row storm capped to exactly 500 with `truncated === true`, (e) the small boundary seed's `truncated === false` as (d)'s control, (f) the query's *actual* `exportArgs()`-derived validator has zero declared args (not merely no `windowSeconds` by name) and a caller-supplied `{ windowSeconds: 100000 }` call returns byte-identical rows to the `{}` call, (g) newest-first ordering.
- Three mutation proofs performed **separately** as the plan requires, each captured RED then reverted to a confirmed-clean `git diff` against the Task 1 commit:
  1. Dropped `.lte(...)` upper bound -> case (a)'s future-row assertion (`bogusFuture`, `re_6`) went RED, leaking the `now + 600` row into the result.
  2. `.take(MAX_ROWS)` -> `.collect()` -> case (d) went RED with the actual defect visible: 600 rows returned, expected 500.
  3. Mapper spread `{ ...r }` instead of the explicit projection -> case (c) went RED with `data` visible in the leaked key set.
- Full `npm test`: 355 files passed | 17 skipped, 4967 tests passed | 195 todo, 0 failed. `npx tsc --noEmit` exits 0. `git diff convex/schema.ts` is empty -- no schema or index change was made.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the fixed-window, row-capped runtime_events query** - `249c93c6` (feat)
2. **Task 2: Prove both bounds independently, plus the projection and the refusal to widen** - `4ed53190` (test)

_No TDD tasks in this plan -- both are `type="auto"` with `tdd` unset._

## Files Created/Modified

- `convex/events.ts` - added `WINDOW_SEC`/`MAX_ROWS` constants and `listRecentRuntimeWindow` (42 lines) immediately after `listRecentUnified`
- `convex/eventsWindow.test.ts` - the 7-case guard plus the local fake `runtime_events` store (created, 268 lines)

## Decisions Made

- **Read the query's real args validator via `exportArgs()`, not a source grep or a hand-typed literal.** The plan's task text said "read the registered function's `args` object rather than grepping the source" but didn't name the mechanism. `events.ts`'s sibling test files (`governorDecisions.test.ts`, `controlVerbSwaps.test.ts`, `messageRoutes.test.ts`) all use the same real (TypeScript-untyped) Convex runtime property `exportArgs()` to serialize the actual validator to JSON -- that's the house idiom, reused here rather than inventing a `.args`/`._args` guess.
- **Seeded every fixture row with a `data` field.** The plan's case (c) exists specifically so "a future edit that starts leaking `data` fails here" -- but the first draft of the fixture never gave any seeded row a `data` field, so mutation (3) (spread the whole row) passed silently the first time it was run (documented as a deviation below). Fixed by adding a `data: unknown` payload to every seeded row before re-running mutation (3), which then correctly went RED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `withFrozenNow`'s `finally` ran before the wrapped async call settled, silently restoring the real clock mid-test**
- **Found during:** Task 2, first run of case (f) (the two-sequential-calls assertion)
- **Issue:** `withFrozenNow` was originally written as `try { return fn(); } finally { Date.now = realDateNow; }` without `await`. Since an async `fn` only runs synchronously up to its first `await`, `return fn()` returns a pending promise immediately, and the `finally` block restores the real `Date.now` before that promise (and any second sequential call inside `fn`, such as case (f)'s baseline-then-override pair) actually resolves. First run: `baseline` (call 1) captured the frozen `NOW` correctly because it reads `Date.now()` synchronously before its own first `await`; `withBogusArg` (call 2) then read the just-restored REAL clock, producing an empty result set and failing the equality assertion with `expected [] to deeply equal [...]`.
- **Fix:** Changed the helper to `async function withFrozenNow<T>(fn) { ...; try { return await fn(); } finally { ...; } }` so the real-clock restore is deferred until the wrapped async body actually completes.
- **Files modified:** `convex/eventsWindow.test.ts`
- **Verification:** Re-ran `npx vitest run convex/eventsWindow.test.ts` -- all 7 cases passed, including case (f) with two sequential frozen-clock calls now both correct.
- **Committed in:** `4ed53190` (Task 2)

**2. [Rule 1 - Bug] The projection mutation proof (case c) initially had nothing to leak**
- **Found during:** Task 2, first mutation proof run for `{ ...r }`
- **Issue:** Every seeded row in `seedBoundarySet` and the 600-row storm loop originally carried only `{eventType, timestamp}` (plus `archived` on one row). Spreading the whole row (`{ ...r }`) into the response therefore still produced exactly `{_id, eventType, timestamp}` on every row that survived the `archived` filter -- the mutation was applied correctly to `events.ts`, but the fixture had no field beyond the projection's own keys for it to leak, so the test suite stayed green and the mutation proof was vacuous.
- **Fix:** Added a `data: unknown` field to every seeded row (mirroring the real `runtime_events` schema field the plan's own comment names as the thing that must never leak), matching the Row type. Re-ran the mutation: case (c) then failed correctly with `data` visible in `Object.keys(row)`.
- **Files modified:** `convex/eventsWindow.test.ts`
- **Verification:** Re-ran `npx vitest run convex/eventsWindow.test.ts` with the mutation active -- case (c) went RED (`expected [...data...] to deeply equal ["_id","eventType","timestamp"]`); reverted the mutation and re-ran -- all 7 green.
- **Committed in:** `4ed53190` (Task 2)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs in the test harness itself, found and fixed while proving the guard actually discriminates; neither touched `convex/events.ts`'s implementation)
**Impact on plan:** Both fixes made the mutation proofs the plan requires actually meaningful rather than accidentally vacuous or accidentally masked by an unrelated TypeError. No change to `listRecentRuntimeWindow`'s implementation or the plan's scope.

## Issues Encountered

- The Edit tool's exact-string match for reverting mutation (2) (`.take(MAX_ROWS)` restoration) initially matched 4 occurrences of the two-line pattern across the file (other `.filter(...).collect()` pairs exist elsewhere in `events.ts`, unrelated to this plan); resolved by widening the `old_string` to include the unique surrounding `.order("desc")` / trailing comment context so only the intended line changed. Confirmed via `git diff convex/events.ts` returning empty after all three mutations were reverted.

## User Setup Required

None - no external service configuration required. No deploy was performed (per the plan's `<verification>` section, deploying this function is plan 125-07's job).

## Next Phase Readiness

- `listRecentRuntimeWindow` is ready for plan 125-09 (Pulse ECG hero component) to consume as its one bounded backfill read.
- No blockers for downstream plans in this wave. `git diff convex/schema.ts` confirmed empty -- no self-hosted Convex schema deploy is triggered by this plan.

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*

## Self-Check: PASSED

Both created/modified files confirmed present and correct on disk (`convex/events.ts` diff empty against commit `249c93c6`; `convex/eventsWindow.test.ts` present, 268 lines per `git show --stat 4ed53190`). Both commit hashes (`249c93c6`, `4ed53190`) confirmed present via `git log --oneline --all | grep -E "249c93c6|4ed53190"`.
