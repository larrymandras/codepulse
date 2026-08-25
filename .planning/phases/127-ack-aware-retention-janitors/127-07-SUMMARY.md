---
phase: 127-ack-aware-retention-janitors
plan: 07
subsystem: testing
tags: [vitest, convex, mutation-testing, retention, janitor, carve-out]

# Dependency graph
requires:
  - phase: 127-04
    provides: "convex/inbox.test.ts carve-out tests for held/money exclusions"
  - phase: 127-05
    provides: "convex/ideation.test.ts carve-out tests for severity exclusion"
provides:
  - "Verification B's mutation-testing control: 3 of 4 guard-deletion flips confirmed load-bearing (held in shouldAutoClose, money in shouldAutoClose, severity in shouldAutoDismiss)"
  - "A confirmed gap: shouldDeleteClosed's held guard is NOT exercised by any test in convex/inbox.test.ts — deleting it left all 24 tests in the file green"
affects: ["127-08 (blocking human deploy) -- should NOT proceed until the shouldDeleteClosed gap is resolved, per this plan's own instructions", "127-04 (owns convex/inbox.test.ts and would own the fix)"]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Per the plan's explicit instruction ('If any flip does NOT turn the test red, stop... report which one... do not fix the test in this plan and do not proceed to plan 127-08'), Flip 4 (shouldDeleteClosed's held guard) is reported as a finding, not silently patched. No test file was edited."

patterns-established: []

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-08-25
---

# Phase 127 Plan 07: Verification B Mutation-Testing Control Summary

**3 of 4 carve-out guard deletions flip their test to a genuine assertion failure (held in shouldAutoClose, money in shouldAutoClose, severity in shouldAutoDismiss); the 4th (shouldDeleteClosed's held guard) does NOT — deleting it leaves the entire 24-test `convex/inbox.test.ts` file green, meaning that specific guard has zero test coverage today.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 1 of 2 (Task 2 is the blocking operator checkpoint, not self-approved)
- **Files modified (permanently):** 0 — `convex/inbox.ts` and `convex/ideation.ts` were each temporarily mutated and restored byte-for-byte via a file-copy backup, never via `git checkout --`

## Pre-flip `git status --porcelain`

```
(empty — clean working tree before any flip)
```

## Accomplishments

- Flips 1-3 confirmed load-bearing: each guard deletion produced a genuine `AssertionError` naming the exact carve-out test, not a compile/collection error.
- Flip 4 (shouldDeleteClosed's held guard, the delete-step predicate) did **not** flip any test — this is the single most valuable finding this plan can produce. Reported per the plan's own stop-and-report instruction rather than silently fixed.
- All files restored from file-copy backups (never `git checkout --`); `git diff --stat convex/inbox.ts convex/ideation.ts` is empty after every flip and at the end.
- `npm test` green against the fully restored source (one pre-existing, unrelated failure noted below, already logged in `deferred-items.md` by plans 127-04/127-05).

## The Four Flips

### Flip 1 — `held` guard in `shouldAutoClose` (`convex/inbox.ts`)

**Deleted line:** `if (row.itemType === "held") return false;` (was line 422, inside `shouldAutoClose`).

**Command:** `npx vitest run convex/inbox.test.ts -t "carve-out"`

**Result: RED.** Two named tests turned red with genuine assertion failures:

```
 ❯ |unit| convex/inbox.test.ts (24 tests | 2 failed | 20 skipped) 11ms
     × a held row survives BOTH steps while a same-age unacked card row is closed then deleted, in the same fixture 7ms
     × a held row WITH ackedAt set, 400 days old, is still untouched by both steps 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |unit| convex/inbox.test.ts > inbox janitor: carve-out — held excluded unconditionally, unacked card closed+deleted (D-03, paired same run) > a held row survives BOTH steps while a same-age unacked card row is closed then deleted, in the same fixture
AssertionError: expected 1800000000 to be undefined

- Expected:
undefined

+ Received:
1800000000

 ❯ convex/inbox.test.ts:526:27
    524|     const held = mock.getRow("held-1");
    525|     expect(held).toBeDefined();
    526|     expect(held.closedAt).toBeUndefined();
       |                           ^
    527|     expect(held.ackedAt).toBeUndefined();
    528|     expect(mock.rowExists("held-1")).toBe(true);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |unit| convex/inbox.test.ts > inbox janitor: carve-out — held excluded even when acked (unconditional, D-03/D-11) > a held row WITH ackedAt set, 400 days old, is still untouched by both steps
AssertionError: expected 1800000000 to be undefined

- Expected:
undefined

+ Received:
1800000000

 ❯ convex/inbox.test.ts:605:26
    603|     const row = mock.getRow("held-acked");
    604|     expect(row).toBeDefined();
    605|     expect(row.closedAt).toBeUndefined();
       |                          ^
    606|     expect(mock.rowExists("held-acked")).toBe(true);
    607|     expect(mock.patches.find((p) => p.id === "held-acked")).toBeUndefi…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed | 20 skipped (24)
```

**Restored.** `git diff --stat convex/inbox.ts` → empty. Re-run: `4 passed | 20 skipped (24)`.

---

### Flip 2 — `money` condition in `shouldAutoClose` (`convex/inbox.ts`)

**Deleted line:** `return row.ackedAt != null || row.priority !== "money";` replaced with `return true;` (the `held` guard above it was left intact per the plan's instruction, deleting only "the whole money condition so the predicate no longer distinguishes money at all").

**Command:** `npx vitest run convex/inbox.test.ts -t "carve-out"`

**Result: RED.** Two named tests turned red with genuine assertion failures:

```
 ❯ |unit| convex/inbox.test.ts (24 tests | 2 failed | 20 skipped) 8ms
     × an unacked money card stays untouched while a same-batch unacked non-money card IS closed and deleted 3ms
     × a human-acked money card is closed+deleted while a same-batch still-unacked money card stays untouched 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |unit| convex/inbox.test.ts > inbox janitor: carve-out — money blocks SILENT closure, a same-batch non-money card is the control (D-03) > an unacked money card stays untouched while a same-batch unacked non-money card IS closed and deleted
AssertionError: expected undefined to be defined
 ❯ convex/inbox.test.ts:549:22
    547|
    548|     const moneyRow = mock.getRow("money-unacked");
    549|     expect(moneyRow).toBeDefined();
       |                      ^
    550|     expect(moneyRow.closedAt).toBeUndefined();
    551|     expect(mock.rowExists("money-unacked")).toBe(true);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |unit| convex/inbox.test.ts > inbox janitor: carve-out — money's D-03 asymmetry: a human-acked money card IS closed and deleted > a human-acked money card is closed+deleted while a same-batch still-unacked money card stays untouched
AssertionError: expected undefined to be defined
 ❯ convex/inbox.test.ts:581:26
    579|
    580|     const stillUnacked = mock.getRow("money-still-unacked");
    581|     expect(stillUnacked).toBeDefined();
       |                          ^
    582|     expect(stillUnacked.closedAt).toBeUndefined();
    583|     expect(mock.rowExists("money-still-unacked")).toBe(true);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed | 20 skipped (24)
```

Note: `moneyRow`/`stillUnacked` came back `undefined` from `mock.getRow(...)` because with the guard gone, both money rows were closed AND deleted (past the grace window check inside `driveJanitorLifecycle`'s second phase) — the row no longer exists in the fixture to look up, which is itself the flipped outcome.

**Restored.** `git diff --stat convex/inbox.ts` → empty. Re-run: `4 passed | 20 skipped (24)`.

---

### Flip 3 — `severity` guard in `shouldAutoDismiss` (`convex/ideation.ts`)

**Deleted line:** `return row.severity !== "critical" && row.severity !== "high";` replaced with `return true;`

**Command:** `npx vitest run convex/ideation.test.ts -t "carve-out"`

**Result: RED.** Two named tests turned red with genuine assertion failures:

```
 ❯ |unit| convex/ideation.test.ts (14 tests | 2 failed | 11 skipped) 10ms
     × shouldAutoDismiss excludes critical and high; includes medium and low. shouldDeleteDismissed is unconditionally true 5ms
     × critical and high rows stay open through the dismissing step; the medium row is patched then, after the grace period, deleted 2ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |unit| convex/ideation.test.ts > ideation janitor — Verification B (carve-out): predicates > shouldAutoDismiss excludes critical and high; includes medium and low. shouldDeleteDismissed is unconditionally true
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ convex/ideation.test.ts:265:57
    263| describe("ideation janitor — Verification B (carve-out): predicates", …
    264|   it("shouldAutoDismiss excludes critical and high; includes medium an…
    265|     expect(shouldAutoDismiss({ severity: "critical" })).toBe(false);
       |                                                         ^
    266|     expect(shouldAutoDismiss({ severity: "high" })).toBe(false);
    267|     expect(shouldAutoDismiss({ severity: "medium" })).toBe(true);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |unit| convex/ideation.test.ts > ideation janitor — Verification B (carve-out): critical/high survive auto-dismiss while a same-batch medium row is dismissed and later deleted > critical and high rows stay open through the dismissing step; the medium row is patched then, after the grace period, deleted
AssertionError: expected "vi.fn()" to be called 1 times, but got 3 times
 ❯ convex/ideation.test.ts:292:19
    290|     await autoCloseAndPruneHandler(ctx, { step: "dismissing" }, nowSec…
    291|
    292|     expect(patch).toHaveBeenCalledTimes(1);
       |                   ^
    293|     expect(patch).toHaveBeenCalledWith("medium1", { dismissed: true, d…
    294|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed | 11 skipped (14)
```

(The one pass among the 3 "carve-out"-selected tests is the delete-step asymmetry test, which exercises `shouldDeleteDismissed` — untouched by this flip — not `shouldAutoDismiss`.)

**Restored.** `git diff --stat convex/ideation.ts` → empty. Re-run: `3 passed | 11 skipped (14)`.

---

### Flip 4 — `held` guard in `shouldDeleteClosed` (`convex/inbox.ts`) — DID NOT FLIP

**Deleted line:** `return row.itemType !== "held";` replaced with `return true;` (the DELETE-step predicate, distinct from Flip 1's CLOSE-step predicate).

**Command:** `npx vitest run convex/inbox.test.ts -t "carve-out"`, then the whole file for confirmation.

**Result: GREEN — the flip did NOT turn any test red.**

```
 RUN  v4.1.11 C:/Users/mandr/codepulse/.claude/worktrees/agent-ad62d68fe4a26e143


 Test Files  1 passed (1)
      Tests  4 passed | 20 skipped (24)
```

Broadened to the whole file (not just the `-t "carve-out"` selector) in case a non-carve-out-tagged test caught it:

```
 RUN  v4.1.11 C:/Users/mandr/codepulse/.claude/worktrees/agent-ad62d68fe4a26e143


 Test Files  1 passed (1)
      Tests  24 passed (24)
```

**All 24 tests in `convex/inbox.test.ts` stay green with this guard deleted.**

**Root cause (read, not fixed):** In the current test suite, no `held` row is ever seeded with a `closedAt` already set. `shouldAutoClose` (the CLOSE step's own guard, left intact for this flip) still excludes `held` from ever acquiring `closedAt` in the first place. The DELETE step's query is bounded by the `by_closedAt` index range (Verification A's structural exclusion), so a `held` row with no `closedAt` never enters the delete-step's raw query batch at all — `shouldDeleteClosed` is never even called on it in any existing fixture. The code comment at `convex/inbox.ts:427-432` explicitly frames this second guard as defense-in-depth ("kept as an explicit second guard here rather than relying solely on the invariant that a `held` row can never acquire a `closedAt` in the first place, so the two steps stay independently correct even if one of them is edited later") — but there is currently no test that would catch a regression in that specific defense-in-depth guard, because no fixture puts a `held` row into the state (`closedAt` set) that would exercise it.

**Restored.** `git diff --stat convex/inbox.ts` → empty. Re-run whole file: `24 passed (24)`.

---

## Post-flip verification

**Post-flip `git status --porcelain`:**
```
(empty — identical to pre-flip)
```

**`git diff --stat convex/inbox.ts convex/ideation.ts`:** empty (no output) — confirmed after Flip 4's restore.

**`npx vitest run convex/inbox.test.ts convex/ideation.test.ts`:** `2 passed (2 files) | 38 passed (38 tests)`.

**`npm test` (full suite):** `1 failed | 364 passed | 17 skipped (382 files)` / `5155 passed | 4 skipped | 195 todo (5354 tests)`. The one failing file is `src/components/voice/AvatarAura.browser.test.tsx`. **Correction to how this is characterized:** plans 127-04 and 127-05 both logged this as a pre-existing, unrelated repo defect attributed to commit `828a5b08` (Phase 193) — but `deferred-items.md`'s own top entry records that attribution as WRONG: the orchestrator measured this same test passing cleanly (`1 file passed, 3 tests passed`) on the merged main checkout at `ec4cdd4b`, with `npm test` fully green (0 failed). The likeliest explanation on file is contention between concurrent browser-mode (`@vitest/browser`) runs across worktrees, not a code defect — recorded there as a hypothesis, not a settled cause. This run (also inside a worktree) reproduces the same symptom, consistent with that hypothesis. Not re-logged as a fresh finding since `deferred-items.md` already carries the corrected account; not fixed (out of this plan's scope, and per the existing entry there is nothing to fix).

## Files Created/Modified

None permanently. `convex/inbox.ts` and `convex/ideation.ts` were each temporarily mutated (via Edit, restored via file-copy backup — never `git checkout --`) and are confirmed byte-identical to their pre-plan state.

## Decisions Made

Per the plan's explicit instruction, Flip 4's failure to turn red is reported as a finding rather than silently fixed in this plan: "Do not 'fix' the test in this plan and do not proceed to plan 127-08 — the failure belongs back in 127-04 or 127-05." No code or test file changes were made to close this gap.

## Deviations from Plan

**None in execution method.** The plan's own acceptance criteria for Task 1 ("All four guard deletions flip their corresponding assertion to red") were **not fully met** — 3 of 4 flipped, 1 did not. This is not a deviation from the plan's *procedure* (every step was followed exactly, including running the selector, then the whole file, before concluding); it is the outcome the plan explicitly anticipated and instructed how to handle ("If any flip does NOT turn the test red, stop... Report which one and what it did instead").

## Issues Encountered

**Flip 4 (shouldDeleteClosed's held guard) does not flip any existing test.** See the dedicated section above. This is the single most valuable finding of this plan: T-127-23's mitigation ("This plan IS the mitigation: four guard-deletion flips, each required to produce a named assertion failure. A flip that stays green fails the plan rather than being explained away") is only 3/4 satisfied. `convex/inbox.test.ts`'s existing carve-out fixtures never place a `held` row into a state where the delete-step predicate is actually exercised (i.e., with `closedAt` already set) — a future edit that drops `shouldDeleteClosed`'s `held` check would ship silently, caught by nothing in the current suite. This belongs back in plan 127-04 (owns `convex/inbox.test.ts`), as a new test seeding a `held` row with `closedAt` explicitly set (an otherwise-impossible-in-production but defense-in-depth-relevant state) and asserting it survives the delete step.

## User Setup Required

None.

## Next Phase Readiness

- **127-08 should NOT proceed as-is.** Per this plan's own instructions and the threat model's T-127-23 disposition, a flip that stays green is the plan failing to close its residual risk, not evidence to explain away. The `shouldDeleteClosed` held-guard gap should be closed (new test in `convex/inbox.test.ts`, likely a fast follow-up to 127-04) before treating Verification B as fully proven.
- 3 of the 4 carve-outs (held in the close step, money in the close step, severity in ideation's dismiss step) are confirmed load-bearing with genuine assertion-failure evidence above.
- Both mutated files are confirmed restored byte-for-byte; the working tree is clean; `npm test` is green modulo the one pre-existing, already-logged, unrelated failure.

## Self-Check

- `.planning/phases/127-ack-aware-retention-janitors/127-07-SUMMARY.md` — this file, written via the Write tool.
- `convex/inbox.ts` — confirmed byte-identical to pre-plan state (`git diff --stat convex/inbox.ts` empty).
- `convex/ideation.ts` — confirmed byte-identical to pre-plan state (`git diff --stat convex/ideation.ts` empty).
- No production commit hashes to verify (files_modified: [] — no code changes committed).

## Self-Check: PASSED

---
*Phase: 127-ack-aware-retention-janitors*
*Completed: 2026-08-25*

---

## Flip 4 gap CLOSED (orchestrator, same session, 2026-08-25)

Larry reviewed the checkpoint and chose "add the missing test now". The gap this plan found is
resolved; 127-08 is no longer blocked by it.

**Independent re-verification of the finding first.** Before acting, the orchestrator confirmed
the root cause against the code rather than accepting the report:
- `convex/inbox.ts:434-436` — `shouldDeleteClosed` is `return row.itemType !== "held";`, an
  explicit second guard whose own docstring says it is kept "rather than relying solely on the
  invariant".
- No fixture in `convex/inbox.test.ts` seeded a `held` row carrying `closedAt`; the
  "held excluded even when acked" test at :526 explicitly asserts held rows stay
  `closedAt: undefined`.
- `grep shouldDeleteClosed convex/inbox.test.ts` → no direct unit test.
All three confirmed. The finding was correct.

**The fix** — commit `9cd949fd`, `test(127-04): cover shouldDeleteClosed's held guard`, landing
in `convex/inbox.test.ts` per this plan's own routing (127-04 owns that file). It builds the one
fixture shape the file lacked: a `held` row that ALREADY carries `closedAt`, past the grace
window, paired with an identical non-held row.

The test asserts in three parts, and part (1) is what makes it discriminating:
1. BOTH rows are returned by the `by_closedAt` range. Without this, the survival assertion would
   pass even with the guard deleted — the same false pass this test exists to prevent.
2. Only the held row survives; it is not in `mock.deletes`.
3. The paired non-held row IS deleted — without this control, a handler that deletes nothing at
   all would satisfy (1) and (2).

**Flip 4 re-run, and it now flips.** The mutation was repeated with the guard replaced by
`return true;` (syntactically valid, so the red is an assertion failure and not a collection
error):

```
AssertionError: expected false to be true // Object.is equality
 ❯ convex/inbox.test.ts:650:46
    650|     expect(mock.rowExists("held-preclosed")).toBe(true);
 Test Files  1 failed (1)
      Tests  1 failed | 24 passed (25)
```

The janitor's own stdout in that run reads `acted on 2 row(s)` where a correct run acts on 1 —
the held row was deleted, which is precisely the production failure the guard prevents.
Note that the other 24 tests stayed GREEN under the mutation, independently reproducing this
plan's original finding.

**Isolation note.** Both the original four flips and this re-run were performed in throwaway git
worktrees, never in the shared checkout. This plan's threat model (T-127-24) manages the risk of
a concurrent session's `convex deploy` or `docker compose up --build` shipping deliberately
broken source by keeping each flip short; worktree isolation removes that risk instead of
managing it. The main checkout was verified unmutated during the flip (`git diff --stat
convex/inbox.ts` empty, zero mutation markers) and restored-green after
(`convex/inbox.ts:435` unchanged, 25/25 passing).

**Status:** Task 1 complete, gap closed. Task 2's operator checkpoint remains Larry's to sign off.
