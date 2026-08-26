---
phase: 124-shell-information-architecture
plan: 01
subsystem: testing
tags: [vitest, navigation, regression-guard]

requires: []
provides:
  - "Criterion-3 route-set guard (`src/lib/__tests__/navRegistry.routes.test.ts`), proven with a
    three-case mutation proof, ready before plan 124-04 rewrites `navGroups`"
affects: [124-04, 124-shell-information-architecture]

tech-stack:
  added: []
  patterns:
    - "Golden fixture as a committed literal array, not a git-SHA read or relative ref"
    - "Mutation-proof discipline: apply one syntactically-valid mutation, run the guard, confirm a
      genuine assertion failure (not a collection error), revert, repeat"

key-files:
  created: [src/lib/__tests__/navRegistry.routes.test.ts]
  modified: []

key-decisions:
  - "Re-derived the live route set via a throwaway Vitest test (deleted before the real test was
    written) rather than trusting the plan's cross-check array; it matched exactly (44 items,
    identical sorted list) so no drift adjudication was needed."
  - "Reworded the file-header docstring to avoid the literal substring \"git show\" while still
    explaining why the fixture is not read from version control — the acceptance-criteria grep for
    that exact string does not distinguish code from an explanatory comment quoting it."

patterns-established:
  - "Mutation-proof for any golden-fixture guard: add / remove / rename-with-no-count-change, each
    reverted before the next, with the registry proven byte-identical via `git diff --exit-code` at
    the end."

requirements-completed: [SHELL-02]

duration: 25min
completed: 2026-08-21
---

# Phase 124 Plan 01: Route-Set Golden-Fixture Guard Summary

**Criterion-3 guard test (`navRegistry.routes.test.ts`) locking the 44-route sidebar `to` set
before the regroup, proven with a live add/remove/rename mutation run against the real registry.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 1 (created)

## Accomplishments
- Live-derived the current `navRegistry.ts` route set (44 items, 5 groups) via a throwaway Vitest
  test rather than trusting the plan's transcribed cross-check array — it matched exactly.
- Wrote `src/lib/__tests__/navRegistry.routes.test.ts` with `GOLDEN_ROUTE_SET` as a committed
  literal, asserting both `navItems` and the raw `navGroups` flatten (pre-dedup) match it, a
  self-check that the fixture has no internal duplicates, and a negative control proving a
  label+group change (exactly what D-05 and the 124-04 regroup will do) leaves the route set
  untouched.
- Ran the required three-case mutation proof directly against `src/lib/navRegistry.ts` — add,
  remove, and (the case that matters) a `to` rename with no count change — confirming each is a
  genuine route-set assertion failure, then reverted every mutation and confirmed the file is
  byte-identical to its pre-mutation state.

## Live Re-derivation (Task 1)

Ran a throwaway Vitest test importing `{ navGroups, navItems }` from `../navRegistry` and printing
the derivation (file deleted before the real test was committed — never part of any commit).
Verbatim output:

```
GROUP_COUNTS COMMAND:12 GRAPHS:7 AGENTS:5 OBSERVE:13 ACTIVITY:7
FLAT_FROM_GROUPS_COUNT 44
NAV_ITEMS_COUNT 44
FLAT_FROM_GROUPS_SORTED ["/","/alerts","/analytics","/automation","/bifrost","/briefings","/build","/capabilities","/channels/whatsapp","/chat","/config","/doc-comments","/dreaming","/executions","/forge","/galdr","/graphs","/hive","/hr/analytics","/hr/catalog","/hr/onboarding","/hr/roster","/hr/teams","/ideation","/inbox","/infrastructure","/insights","/knowledge-graph","/live-run","/loom","/mcp-inventory","/meeting-bot","/memory","/quality","/reminders","/security","/self-healing","/skills","/studio","/tasks","/tool-galaxy","/tools","/war-room","/workspace-map"]
NAV_ITEMS_SORTED ["/","/alerts","/analytics","/automation","/bifrost","/briefings","/build","/capabilities","/channels/whatsapp","/chat","/config","/doc-comments","/dreaming","/executions","/forge","/galdr","/graphs","/hive","/hr/analytics","/hr/catalog","/hr/onboarding","/hr/roster","/hr/teams","/ideation","/inbox","/infrastructure","/insights","/knowledge-graph","/live-run","/loom","/mcp-inventory","/meeting-bot","/memory","/quality","/reminders","/security","/self-healing","/skills","/studio","/tasks","/tool-galaxy","/tools","/war-room","/workspace-map"]
```

Count is 44, sorted list is byte-identical to the plan's `<interfaces>` cross-check array. No
drift — no adjudication needed. `GOLDEN_ROUTE_SET` in the committed test file was copied from this
`NAV_ITEMS_SORTED` output.

## Mutation Proof (Task 2, BLOCKING)

All three mutations applied one at a time directly to `src/lib/navRegistry.ts`, each run through
`npx vitest run src/lib/__tests__/navRegistry.routes.test.ts --reporter=verbose`, each reverted
before the next.

**Mutation 1 — ADD** (`{ to: "/mutation-probe", label: "Probe", icon: "grid", group: "OBSERVE" }`
inserted into the OBSERVE items array):
```
✓ the golden fixture itself holds no duplicate routes
× navItems (flattened, deduped) matches the golden route set
  → expected [ '/', '/alerts', '/analytics', …(42) ] to deeply equal [ … …(41) ]
  + "/mutation-probe" present in received, absent from golden
× navGroups flattened directly (before dedup) matches the golden route set  (same diff)
× a label-only rename does not move the route set (negative control)        (same diff)
3 failed | 1 passed (4)
```
Genuine assertion failure naming the route set (extra `/mutation-probe`), not a collection error.

**Mutation 2 — REMOVE** (deleted the `/alerts` item object from OBSERVE):
```
× navItems (flattened, deduped) matches the golden route set
  → expected [ '/', '/analytics', …(41) ] to deeply equal [ '/', '/alerts', '/analytics', …(41) ]
  - "/alerts" missing from received
× navGroups flattened directly (before dedup) matches the golden route set  (same diff)
× a label-only rename does not move the route set (negative control)        (same diff)
3 failed | 1 passed (4)
```
Genuine assertion failure (missing `/alerts`), not a collection error.

**Mutation 3 — RENAME `to`, no count change** (`/alerts` → `/alerts2`, label/icon/group untouched)
— the case that matters, since plan 124-04 renames labels without touching `to` values:
```
× navItems (flattened, deduped) matches the golden route set
  → expected [ Array(44) ] to deeply equal [ '/', '/alerts', '/analytics', …(41) ]
  - "/alerts" (removed)
  + "/alerts2" (added)
× navGroups flattened directly (before dedup) matches the golden route set  (same diff)
× a label-only rename does not move the route set (negative control)        (same diff)
3 failed | 1 passed (4)
```
The diff shows `/alerts2` present and `/alerts` absent at identical array length (44 both sides) —
proves the guard compares paths, not counts.

**Final revert check:**
```
$ git diff --exit-code -- src/lib/navRegistry.ts
(exit code: 0)
$ npx vitest run src/lib/__tests__/navRegistry.routes.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
```
Registry is byte-identical to its committed pre-mutation state; guard is green again. No changes
to `src/lib/navRegistry.ts` were left in the tree, so Task 2 produced no file diff to commit —
only Task 1's new test file was committed.

## Task Commits

1. **Task 1: Re-derive the live route set and write the golden-fixture test** - `d24998a2` (test)
2. **Task 2: BLOCKING mutation-proof — three cases, one at a time** - no commit (mutations applied
   and reverted in-place per the plan's own instruction: "Do not leave any mutation in the tree";
   `git diff --exit-code -- src/lib/navRegistry.ts` confirmed above, exit 0)

**Plan metadata:** this summary's own commit (below)

## Files Created/Modified
- `src/lib/__tests__/navRegistry.routes.test.ts` - Criterion-3 route-set golden-fixture guard: 4
  assertions (navItems match, raw navGroups match, fixture self-check, label-rename negative
  control), 44-entry `GOLDEN_ROUTE_SET` literal.

## Decisions Made
- Re-derived the route set live rather than trusting the plan's transcribed cross-check array
  (plan-is-a-draft discipline) — confirmed identical, so used the plan's array verbatim for
  `GOLDEN_ROUTE_SET` since the live derivation matched it exactly.
- Reworded the docstring to avoid the literal substring "git show" (see Deviations) so the
  acceptance-criteria grep measures what it intends to measure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance-criteria grep false-positive from explanatory comment**
- **Found during:** Task 1, immediately after first writing the test file
- **Issue:** The plan's acceptance criteria require `grep -cF "git show" ... ` to return 0,
  proving the fixture isn't sourced via a git read. My first draft's file-header docstring
  explained the design choice by naming the alternative it deliberately avoids ("not a `git show
  <sha>:...` read"), which is a comment, not code — but a plain grep can't distinguish the two, so
  it returned 1 and would have failed the plan's own acceptance gate.
- **Fix:** Reworded the docstring to describe the same rejected alternative ("no git-object lookup,
  no relative ref like `HEAD~1` or `main`") without using the literal substring "git show".
  Meaning is unchanged; the grep now returns 0.
- **Files modified:** `src/lib/__tests__/navRegistry.routes.test.ts`
- **Verification:** Re-ran `grep -cF "git show" src/lib/__tests__/navRegistry.routes.test.ts` → 0;
  re-ran the test suite → still 4/4 passing.
- **Committed in:** `d24998a2` (Task 1 commit — caught before the first commit, so no separate fix
  commit was needed)

---

**Total deviations:** 1 auto-fixed (1 bug, self-inflicted acceptance-criteria false-positive,
caught pre-commit)
**Impact on plan:** No scope change. The guard's actual behavior (never reads git state) was
correct throughout; only the comment's wording changed.

## Issues Encountered
None beyond the deviation above.

## Shared-Checkout Check

`git show --stat HEAD` after the Task 1 commit showed exactly one file
(`src/lib/__tests__/navRegistry.routes.test.ts`, 116 insertions) — no files from a concurrent
session were swept in. `git diff --cached --name-only` was run and read before staging, and only
the intended path was staged (`git add src/lib/__tests__/navRegistry.routes.test.ts`, never `-A`
or `.`).

## Next Phase Readiness
The route-set guard is committed and green against the pre-regroup registry, with all three
required mutation cases proven to fail for the right reason and the label-rename negative control
proven to pass. Plan 124-04 (the `navGroups` regroup) can now proceed — any accidental route
change during that rewrite will fail this guard immediately. No blockers.

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
